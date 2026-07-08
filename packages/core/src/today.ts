import { restoreLoopStateFromSession } from "./loop";
import type { DailySession, LoopStatus } from "./loop";

export type TodayCatalogEpisode = {
  id: string;
  publishDate: string;
};

export type TodayEpisodeSelection<T extends TodayCatalogEpisode> = {
  episode: T;
  isFallback: boolean;
};

export type TodayCardState =
  | { kind: "not_started" }
  | { kind: "in_progress"; status: LoopStatus }
  | { kind: "completed" };

export function getZonedDateString(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  }).formatToParts(date);

  const year = getDatePart(parts, "year");
  const month = getDatePart(parts, "month");
  const day = getDatePart(parts, "day");

  return `${year}-${month}-${day}`;
}

export function getWeekDateStrings(today: string): string[] {
  const start = parseUtcDate(today);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return formatUtcDate(date);
  });
}

export function selectTodayEpisode<T extends TodayCatalogEpisode>(
  episodes: readonly T[],
  today: string
): TodayEpisodeSelection<T> | null {
  const exact = episodes.find((episode) => episode.publishDate === today);
  if (exact !== undefined) {
    return { episode: exact, isFallback: false };
  }

  const fallback = [...episodes]
    .filter((episode) => episode.publishDate < today)
    .sort((left, right) => right.publishDate.localeCompare(left.publishDate))[0];

  return fallback === undefined ? null : { episode: fallback, isFallback: true };
}

export function getTodayCardState(
  session: Partial<DailySession> | null
): TodayCardState {
  if (session === null || !hasTodaySessionProgress(session)) {
    return { kind: "not_started" };
  }

  const loopState = restoreLoopStateFromSession(session);
  if (loopState.status === "completed") {
    return { kind: "completed" };
  }

  return { kind: "in_progress", status: loopState.status };
}

export function hasTodaySessionProgress(
  session: Partial<DailySession> | null
): boolean {
  if (session === null) {
    return false;
  }

  return (
    session.listened === true ||
    (session.predict_choice !== undefined && session.predict_choice !== null) ||
    session.answered_think === true ||
    session.taught_back === true ||
    session.asked_new_question === true
  );
}

function getDatePart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
): string {
  const part = parts.find((item) => item.type === type);
  if (part === undefined) {
    throw new Error(`Missing ${type} date part.`);
  }

  return part.value;
}

function parseUtcDate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
