import { hasTodaySessionProgress } from "./today";
import { isDailySessionLoopComplete } from "./loop";
import type { DailySession } from "./loop";

export type CalendarDayState = "none" | "listened" | "partial" | "complete";

export type CalendarDay = {
  date: string;
  dayOfMonth: number;
  inMonth: boolean;
  state: CalendarDayState;
};

export type CalendarSession = Partial<DailySession> & {
  sessionDate: string;
};

export type CalendarQuestion = {
  date: string;
  id: string;
};

export function getCalendarSessionState(
  session: Partial<DailySession> | null
): CalendarDayState {
  if (session === null || !hasTodaySessionProgress(session)) {
    return "none";
  }

  if (isDailySessionLoopComplete(session)) {
    return "complete";
  }

  const listenedOnly =
    session.listened === true &&
    session.predict_choice === null &&
    session.answered_think !== true &&
    session.taught_back !== true &&
    session.asked_new_question !== true;

  return listenedOnly ? "listened" : "partial";
}

export function getMonthRange(month: string): { end: string; start: string } {
  const start = parseMonthStart(month);
  const end = new Date(start);
  end.setUTCMonth(start.getUTCMonth() + 1);
  end.setUTCDate(end.getUTCDate() - 1);

  return {
    end: formatUtcDate(end),
    start: formatUtcDate(start)
  };
}

export function getAdjacentMonth(month: string, deltaMonths: number): string {
  const date = parseMonthStart(month);
  date.setUTCMonth(date.getUTCMonth() + deltaMonths);
  return formatMonth(date);
}

export function buildCalendarMonth(
  month: string,
  sessions: readonly CalendarSession[]
): CalendarDay[] {
  const { start, end } = getMonthRange(month);
  const gridStart = parseUtcDate(start);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());
  const gridEnd = parseUtcDate(end);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - gridEnd.getUTCDay()));
  const sessionsByDate = new Map(
    sessions.map((session) => [session.sessionDate, session])
  );
  const days: CalendarDay[] = [];

  for (
    const date = new Date(gridStart);
    date <= gridEnd;
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    const dateString = formatUtcDate(date);
    days.push({
      date: dateString,
      dayOfMonth: date.getUTCDate(),
      inMonth: dateString >= start && dateString <= end,
      state: getCalendarSessionState(sessionsByDate.get(dateString) ?? null)
    });
  }

  return days;
}

export function summarizeCalendarMonth(
  sessions: readonly CalendarSession[],
  questions: readonly CalendarQuestion[]
): { completedLoops: number; questionCount: number } {
  return {
    completedLoops: sessions.filter((session) => isDailySessionLoopComplete(session))
      .length,
    questionCount: questions.length
  };
}

export function toMonthString(dateString: string): string {
  return dateString.slice(0, 7);
}

function parseMonthStart(month: string): Date {
  return parseUtcDate(`${month}-01`);
}

function parseUtcDate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function formatMonth(date: Date): string {
  return formatUtcDate(date).slice(0, 7);
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
