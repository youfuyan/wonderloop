"use client";

import { useEffect, useRef, useState } from "react";
import { shouldPauseAt } from "@wonderloop/core";
import type {
  PlayerLanguageMode,
  PlayerPlan,
  PlayerSegment,
  SegmentBoundary
} from "@wonderloop/core";

import { getBrowserSupabase } from "../auth/session";

type EpisodePlayerProps = {
  episodeId: string;
  languageMode: PlayerLanguageMode;
  onSegmentBoundary?: (boundary: SegmentBoundary) => void;
};

type AudioUrlResponse = {
  audioUrl: string;
  plan: PlayerPlan;
};

type PlayerStatus = "idle" | "loading" | "ready" | "error";

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
  languageMode,
  onSegmentBoundary
}: EpisodePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const handledBoundariesRef = useRef<Set<string>>(new Set());
  const pendingResumeAtRef = useRef<number | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [plan, setPlan] = useState<PlayerPlan | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
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
    onSegmentBoundary?.(boundary);
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

    if (pendingResumeAtRef.current !== null) {
      audio.currentTime = pendingResumeAtRef.current;
      pendingResumeAtRef.current = null;
    }

    audio.playbackRate = playbackRate;
    await audio.play();
    setIsPlaying(true);
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

  const progressPercent =
    plan === null ? 0 : clamp((currentTime / plan.durationSec) * 100, 0, 100);

  return (
    <section className="episodePlayer" aria-label="Episode player">
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
