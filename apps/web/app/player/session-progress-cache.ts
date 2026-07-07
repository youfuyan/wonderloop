"use client";

import { restoreLoopStateFromSession } from "@wonderloop/core";
import type { DailySession, LoopState } from "@wonderloop/core";

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export type CachedSessionProgress = {
  currentTime: number;
  episodeId: string;
  loopState: LoopState;
  savedAt: string;
};

const progressCachePrefix = "wonderloop.sessionProgress.v1";

export function saveSessionProgress(
  progress: Omit<CachedSessionProgress, "savedAt">,
  storage = getBrowserStorage()
): void {
  if (storage === null || progress.currentTime < 0) {
    return;
  }

  storage.setItem(
    progressCacheKey(progress.episodeId),
    JSON.stringify({
      ...progress,
      savedAt: new Date().toISOString()
    })
  );
}

export function loadSessionProgress(
  episodeId: string,
  storage = getBrowserStorage()
): CachedSessionProgress | null {
  if (storage === null) {
    return null;
  }

  const rawProgress = storage.getItem(progressCacheKey(episodeId));
  if (rawProgress === null) {
    return null;
  }

  const parsed = parseJson(rawProgress);
  if (!isRecord(parsed) || parsed.episodeId !== episodeId) {
    return null;
  }

  if (typeof parsed.currentTime !== "number" || parsed.currentTime < 0) {
    return null;
  }

  if (typeof parsed.savedAt !== "string" || !isRecord(parsed.loopState)) {
    return null;
  }

  return {
    currentTime: parsed.currentTime,
    episodeId,
    loopState: restoreCachedLoopState(parsed.loopState),
    savedAt: parsed.savedAt
  };
}

export function clearSessionProgress(
  episodeId: string,
  storage = getBrowserStorage()
): void {
  storage?.removeItem(progressCacheKey(episodeId));
}

export function resumePromptText(progress: CachedSessionProgress): string {
  return `Continue previous session? Start from '${loopStatusLabel(
    progress.loopState.status
  )}' / 继续上次？从「${loopStatusLabelZh(progress.loopState.status)}」环节开始`;
}

function restoreCachedLoopState(value: Record<string, unknown>): LoopState {
  const session: Partial<DailySession> = {
    answered_think: value.answeredThink === true,
    asked_new_question: value.askedNewQuestion === true,
    listened: value.listened === true,
    predict_choice:
      typeof value.predictChoice === "string" ? value.predictChoice : null,
    recall_answered: value.recallAnswered === true,
    taught_back: value.taughtBack === true
  };
  const restored = restoreLoopStateFromSession(session);

  return isLoopStatus(value.status) ? { ...restored, status: value.status } : restored;
}

function isLoopStatus(value: unknown): value is LoopState["status"] {
  return (
    value === "idle" ||
    value === "hook_playing" ||
    value === "predict_paused" ||
    value === "story_playing" ||
    value === "think_paused" ||
    value === "teach_back_paused" ||
    value === "new_question_paused" ||
    value === "completed"
  );
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function loopStatusLabel(status: LoopState["status"]): string {
  switch (status) {
    case "predict_paused":
      return "Predict";
    case "think_paused":
      return "Think";
    case "teach_back_paused":
      return "Teach Back";
    case "new_question_paused":
      return "New Question";
    case "completed":
      return "Complete";
    case "hook_playing":
    case "story_playing":
    case "idle":
      return "Today";
  }
}

function loopStatusLabelZh(status: LoopState["status"]): string {
  switch (status) {
    case "predict_paused":
      return "猜一猜";
    case "think_paused":
      return "想一想";
    case "teach_back_paused":
      return "讲一讲";
    case "new_question_paused":
      return "新问题";
    case "completed":
      return "完成";
    case "hook_playing":
    case "story_playing":
    case "idle":
      return "今日";
  }
}

function progressCacheKey(episodeId: string): string {
  return `${progressCachePrefix}:${episodeId}`;
}

function getBrowserStorage(): StorageLike | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
