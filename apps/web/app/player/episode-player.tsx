"use client";

import { useEffect, useRef, useState } from "react";
import {
  advance,
  deriveSessionUpdate,
  isLoopComplete,
  restoreLoopStateFromSession,
  shouldPauseAt
} from "@wonderloop/core";
import type {
  DailySession,
  EpisodeContent,
  EpisodeSegment,
  LoopEvent,
  LoopState,
  PlayerLanguageMode,
  PlayerPlan,
  PlayerSegment,
  SegmentBoundary
} from "@wonderloop/core";

import { getBrowserSupabase } from "../auth/session";
import { LoopCards, segmentForCard } from "./loop-cards";

type EpisodePlayerProps = {
  episodeId: string;
  episodeContent?: Pick<EpisodeContent, "bilingual_bridge" | "segments">;
  initialSession?: Partial<DailySession>;
  languageMode: PlayerLanguageMode;
  onNewQuestionSubmitted?: (questionText: string) => void;
  onSegmentBoundary?: (boundary: SegmentBoundary) => void;
  onSessionUpdate?: (update: Partial<DailySession>, event: LoopEvent) => void;
};

type AudioUrlResponse = {
  audioUrl: string;
  plan: PlayerPlan;
};

type PlayerStatus = "idle" | "loading" | "ready" | "error";
type LoopCardStatus =
  | "predict_paused"
  | "think_paused"
  | "teach_back_paused"
  | "new_question_paused"
  | "completed";

const playerSegmentTypes = [
  "hook",
  "predict",
  "story",
  "think",
  "teach_back",
  "new_question"
] as const;

export function EpisodePlayer({
  episodeId,
  episodeContent,
  initialSession,
  languageMode,
  onNewQuestionSubmitted,
  onSessionUpdate,
  onSegmentBoundary
}: EpisodePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const handledBoundariesRef = useRef<Set<string>>(new Set());
  const pendingResumeAtRef = useRef<number | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopState, setLoopState] = useState<LoopState>(() =>
    restoreLoopStateFromSession(initialSession ?? {})
  );
  const [plan, setPlan] = useState<PlayerPlan | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [segmentCard, setSegmentCard] = useState<EpisodeSegment | null>(null);
  const [status, setStatus] = useState<PlayerStatus>("idle");

  useEffect(() => {
    const controller = new AbortController();

    async function loadAudioUrl() {
      setStatus("loading");
      setPlan(null);
      setAudioUrl(null);
      handledBoundariesRef.current = new Set();
      pendingResumeAtRef.current = null;

      try {
        const supabase = getBrowserSupabase();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;

        if (token === undefined) {
          setStatus("error");
          return;
        }

        const response = await fetch("/api/audio-url", {
          body: JSON.stringify({ episodeId, languageMode }),
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          method: "POST",
          signal: controller.signal
        });

        if (!response.ok) {
          setStatus("error");
          return;
        }

        const responseBody: unknown = await response.json();
        const parsedResponse = parseAudioUrlResponse(responseBody);
        if (parsedResponse === null) {
          setStatus("error");
          return;
        }

        setAudioUrl(parsedResponse.audioUrl);
        setCurrentTime(0);
        setPlan(parsedResponse.plan);
        setStatus("ready");
      } catch {
        if (!controller.signal.aborted) {
          setStatus("error");
        }
      }
    }

    void loadAudioUrl();

    return () => {
      controller.abort();
    };
  }, [episodeId, languageMode]);

  useEffect(() => {
    setLoopState(restoreLoopStateFromSession(initialSession ?? {}));
    setSegmentCard(null);
  }, [episodeId, initialSession]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio !== null) {
      audio.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (audio === null || plan === null) {
      return;
    }

    if (audio.currentTime >= plan.durationSec) {
      audio.pause();
      audio.currentTime = plan.durationSec;
      setCurrentTime(plan.durationSec);
      setIsPlaying(false);
      return;
    }

    setCurrentTime(audio.currentTime);
    const boundary = shouldPauseAt(plan, audio.currentTime);
    if (boundary === null) {
      return;
    }

    const boundaryKey = `${String(boundary.segmentIndex)}:${String(boundary.at)}`;
    if (handledBoundariesRef.current.has(boundaryKey)) {
      return;
    }

    handledBoundariesRef.current.add(boundaryKey);
    pendingResumeAtRef.current = boundary.resumeAt;
    audio.pause();
    audio.currentTime = boundary.at;
    setCurrentTime(boundary.at);
    setIsPlaying(false);
    if (episodeContent !== undefined) {
      const loopEvent: LoopEvent = {
        type: "SEGMENT_END",
        segmentType: boundary.segmentType
      };
      const nextState = applyLoopEvent(loopEvent);
      setSegmentCard(
        nextState.status === "completed"
          ? null
          : segmentForCard(episodeContent.segments, boundary.segmentType)
      );
    }
    onSegmentBoundary?.(boundary);
  }

  async function startPlayback() {
    const audio = audioRef.current;
    if (audio === null || plan === null) {
      return;
    }

    if (pendingResumeAtRef.current !== null) {
      audio.currentTime = pendingResumeAtRef.current;
      pendingResumeAtRef.current = null;
    }

    audio.playbackRate = playbackRate;
    await audio.play();
    setIsPlaying(true);
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (audio === null || plan === null) {
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    if (episodeContent !== undefined && loopState.status === "idle") {
      applyLoopEvent({ type: "RESUME" });
    }

    await startPlayback();
  }

  function seekBy(deltaSeconds: number) {
    const audio = audioRef.current;
    if (audio === null || plan === null) {
      return;
    }

    const nextTime = clamp(audio.currentTime + deltaSeconds, 0, plan.durationSec);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  function handleCardAnswer(payload?: {
    predictChoice?: string;
    questionText?: string;
  }) {
    if (
      loopState.status === "new_question_paused" &&
      (payload?.questionText === undefined || payload.questionText.length === 0)
    ) {
      handleCardSkip();
      return;
    }

    const loopEvent: LoopEvent =
      payload?.predictChoice === undefined
        ? { type: "ANSWER_SUBMITTED" }
        : {
            type: "ANSWER_SUBMITTED",
            predictChoice: payload.predictChoice
          };
    const nextState = applyLoopEvent(loopEvent);

    if (
      loopState.status === "new_question_paused" &&
      payload?.questionText !== undefined &&
      payload.questionText.length > 0
    ) {
      onNewQuestionSubmitted?.(payload.questionText);
    }

    setSegmentCard(null);
    if (nextState.status !== "completed") {
      void startPlayback();
    }
  }

  function handleCardSkip() {
    const nextState = applyLoopEvent({ type: "SKIP" });

    setSegmentCard(null);
    if (nextState.status !== "completed") {
      void startPlayback();
    }
  }

  function applyLoopEvent(event: LoopEvent): LoopState {
    const update = deriveSessionUpdate(loopState, event);
    if (hasSessionUpdate(update)) {
      onSessionUpdate?.(update, event);
    }

    const nextState = advance(loopState, event);
    setLoopState(nextState);
    return nextState;
  }

  const progressPercent =
    plan === null ? 0 : clamp((currentTime / plan.durationSec) * 100, 0, 100);
  const cardStatus = getLoopCardStatus(loopState, episodeContent !== undefined);

  return (
    <section className="episodePlayer" aria-label="Episode player">
      {episodeContent !== undefined && cardStatus !== null ? (
        <LoopCards
          bridge={episodeContent.bilingual_bridge}
          languageMode={languageMode}
          segment={segmentCard}
          status={cardStatus}
          onAnswer={handleCardAnswer}
          onSkip={handleCardSkip}
        />
      ) : null}

      {audioUrl !== null ? (
        <audio
          onEnded={() => {
            setIsPlaying(false);
          }}
          onPause={() => {
            setIsPlaying(false);
          }}
          onPlay={() => {
            setIsPlaying(true);
          }}
          onTimeUpdate={handleTimeUpdate}
          preload="metadata"
          ref={audioRef}
          src={audioUrl}
        />
      ) : null}

      <div className="playerTimeline" aria-hidden="true">
        {plan?.segments.map((segment) => (
          <span
            className={`playerSegment playerSegment-${segment.type}`}
            key={`${String(segment.index)}-${segment.type}`}
            style={{
              left: formatPercent((segment.start / plan.durationSec) * 100),
              width: formatPercent(
                ((segment.end - segment.start) / plan.durationSec) * 100
              )
            }}
          />
        ))}
        <span
          className="playerProgress"
          style={{ width: formatPercent(progressPercent) }}
        />
      </div>

      <div className="playerControls">
        <button
          aria-label={isPlaying ? "Pause / 暂停" : "Play / 播放"}
          disabled={status !== "ready"}
          onClick={() => void togglePlayback()}
          type="button"
        >
          {isPlaying ? "II" : ">"}
        </button>
        <button
          aria-label="Back 10 seconds / 后退 10 秒"
          disabled={status !== "ready"}
          onClick={() => {
            seekBy(-10);
          }}
          type="button"
        >
          -10
        </button>
        <button
          aria-label="Forward 10 seconds / 前进 10 秒"
          disabled={status !== "ready"}
          onClick={() => {
            seekBy(10);
          }}
          type="button"
        >
          +10
        </button>
        <label className="playerRate">
          <span>Speed / 语速</span>
          <select
            onChange={(event) => {
              setPlaybackRate(Number(event.target.value));
            }}
            value={String(playbackRate)}
          >
            <option value="0.8">0.8x</option>
            <option value="1">1x</option>
          </select>
        </label>
      </div>

      <p className="playerStatus" role="status">
        {status === "loading" ? "Loading audio / 正在加载音频" : null}
        {status === "error" ? "Audio unavailable / 音频暂不可用" : null}
        {status === "ready" && plan !== null
          ? `${formatTime(currentTime)} / ${formatTime(plan.durationSec)}`
          : null}
      </p>
    </section>
  );
}

function parseAudioUrlResponse(value: unknown): AudioUrlResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.audioUrl !== "string" || !isPlayerPlan(value.plan)) {
    return null;
  }

  return {
    audioUrl: value.audioUrl,
    plan: value.plan
  };
}

function isPlayerPlan(value: unknown): value is PlayerPlan {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.access === "full" || value.access === "story_only") &&
    (value.audioLanguage === "en" || value.audioLanguage === "zh") &&
    typeof value.audioPath === "string" &&
    isFiniteNumber(value.durationSec) &&
    (value.languageMode === "en" ||
      value.languageMode === "zh" ||
      value.languageMode === "bilingual") &&
    isFiniteNumber(value.pauseToleranceSec) &&
    Array.isArray(value.segments) &&
    value.segments.every(isPlayerSegment)
  );
}

function isPlayerSegment(value: unknown): value is PlayerSegment {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isPlayerSegmentType(value.type) &&
    isFiniteNumber(value.start) &&
    isFiniteNumber(value.end) &&
    isFiniteNumber(value.index) &&
    typeof value.pauseAfter === "boolean"
  );
}

function isPlayerSegmentType(value: unknown): value is PlayerSegment["type"] {
  return (
    typeof value === "string" &&
    playerSegmentTypes.some((segmentType) => segmentType === value)
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasSessionUpdate(update: Partial<DailySession>): boolean {
  return Object.keys(update).length > 0;
}

function getLoopCardStatus(
  loopState: LoopState,
  hasEpisodeContent: boolean
): LoopCardStatus | null {
  if (!hasEpisodeContent) {
    return null;
  }

  if (
    loopState.status === "predict_paused" ||
    loopState.status === "think_paused" ||
    loopState.status === "teach_back_paused" ||
    loopState.status === "new_question_paused"
  ) {
    return loopState.status;
  }

  if (loopState.status === "completed" && isLoopComplete(loopState)) {
    return "completed";
  }

  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes)}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatPercent(percent: number): string {
  return `${percent.toFixed(4)}%`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
