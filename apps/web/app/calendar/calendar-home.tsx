"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  buildCalendarMonth,
  getAdjacentMonth,
  getMonthRange,
  getZonedDateString,
  summarizeCalendarMonth,
  toMonthString
} from "@wonderloop/core";
import type { CalendarDayState } from "@wonderloop/core";
import type { Database } from "@wonderloop/api-client";

import { getBrowserSupabase, markAuthenticated } from "../auth/session";

type FamilyRow = Pick<Database["public"]["Tables"]["families"]["Row"], "timezone">;
type CalendarSession = {
  answered_think: boolean;
  asked_new_question: boolean;
  episodeTitleEn: string;
  episodeTitleZh: string;
  id: string;
  listened: boolean;
  predict_choice: string | null;
  sessionDate: string;
  taught_back: boolean;
};
type CalendarQuestion = {
  date: string;
  episodeId: string | null;
  id: string;
  questionText: string;
};
type LoadStatus = "loading" | "ready" | "error";

const navItems = [
  { href: "/today", label: "今日", labelEn: "Today" },
  { href: "/calendar", label: "日历", labelEn: "Calendar" },
  { href: "/questions", label: "问题本", labelEn: "Questions" },
  { href: "/settings", label: "设置", labelEn: "Settings" }
] as const;

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function CalendarHome() {
  const [family, setFamily] = useState<FamilyRow | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [questions, setQuestions] = useState<CalendarQuestion[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sessions, setSessions] = useState<CalendarSession[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");

  const supabase = useMemo(() => {
    try {
      return getBrowserSupabase();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (supabase === null) {
      setStatus("error");
      return;
    }

    const client = supabase;
    let cancelled = false;

    async function loadFamily() {
      const { data: authData } = await client.auth.getSession();
      if (authData.session === null) {
        window.location.assign("/login?next=/calendar");
        return;
      }

      markAuthenticated(authData.session.expires_at);

      const { data, error } = await client.from("families").select("timezone").single();

      if (error !== null) {
        setStatus("error");
        return;
      }

      if (!cancelled) {
        const familyToday = getZonedDateString(new Date(), data.timezone);
        setFamily(data);
        setMonth(toMonthString(familyToday));
      }
    }

    void loadFamily().catch(() => {
      if (!cancelled) {
        setStatus("error");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (supabase === null || family === null || month === null) {
      return;
    }

    const client = supabase;
    const currentFamily = family;
    const currentMonth = month;
    const { start, end } = getMonthRange(currentMonth);
    let cancelled = false;

    async function loadMonth() {
      setStatus("loading");
      setSessions([]);
      setQuestions([]);
      setSelectedDate(null);

      const [sessionResult, questionResult] = await Promise.all([
        client
          .from("daily_sessions")
          .select(
            "id, session_date, episode_id, listened, predict_choice, answered_think, taught_back, asked_new_question, episode_catalog(title_en, title_zh)"
          )
          .gte("session_date", start)
          .lte("session_date", end)
          .order("session_date", { ascending: true }),
        client
          .from("child_questions")
          .select("id, created_at, episode_id, question_text")
          .gte("created_at", `${shiftDate(start, -1)}T00:00:00.000Z`)
          .lt("created_at", `${shiftDate(end, 2)}T00:00:00.000Z`)
          .order("created_at", { ascending: true })
      ]);

      if (sessionResult.error !== null || questionResult.error !== null) {
        setStatus("error");
        return;
      }

      if (!cancelled) {
        const nextSessions = normalizeSessionRows(sessionResult.data);
        const nextQuestions = normalizeQuestionRows(
          questionResult.data,
          currentFamily.timezone,
          currentMonth
        );
        setSessions(nextSessions);
        setQuestions(nextQuestions);
        setSelectedDate(null);
        setStatus("ready");
      }
    }

    void loadMonth().catch(() => {
      if (!cancelled) {
        setStatus("error");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [family, month, supabase]);

  const days = month === null ? [] : buildCalendarMonth(month, sessions);
  const summary = summarizeCalendarMonth(sessions, questions);
  const selectedSession =
    selectedDate === null
      ? null
      : (sessions.find((session) => session.sessionDate === selectedDate) ?? null);
  const selectedQuestions =
    selectedDate === null
      ? []
      : questions.filter((question) => question.date === selectedDate);

  return (
    <main className="calendarShell">
      <section className="calendarContent" aria-label="Curiosity calendar">
        <header className="calendarHeader">
          <div>
            <p>好奇心日历</p>
            <h1>{formatMonthTitle(month)}</h1>
            <span>Growth record, not attendance.</span>
          </div>
          <div className="monthControls">
            <button
              onClick={() => {
                setMonth((current) =>
                  current === null ? current : getAdjacentMonth(current, -1)
                );
              }}
              type="button"
            >
              Prev
            </button>
            <button
              onClick={() => {
                setMonth((current) =>
                  current === null ? current : getAdjacentMonth(current, 1)
                );
              }}
              type="button"
            >
              Next
            </button>
          </div>
        </header>

        <section className="calendarSummary" aria-label="Monthly summary">
          <strong>本月完整循环 {summary.completedLoops} 次</strong>
          <span>Recorded {summary.questionCount} new questions</span>
        </section>

        {status === "loading" ? (
          <p className="calendarMessage">正在整理这个月的好奇记录...</p>
        ) : null}
        {status === "error" ? (
          <p className="calendarMessage">日历暂时加载失败，请稍后再试。</p>
        ) : null}

        <section className="calendarCard" aria-label="Month view">
          <div className="calendarWeekdays" aria-hidden="true">
            {weekdays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendarGrid">
            {days.map((day) => (
              <button
                className={`calendarDay calendarDay-${day.state}`}
                data-outside-month={!day.inMonth}
                disabled={!day.inMonth}
                key={day.date}
                onClick={() => {
                  if (day.inMonth) {
                    setSelectedDate(day.date);
                  }
                }}
                type="button"
              >
                <span>{day.dayOfMonth}</span>
                <CalendarStateMark state={day.state} />
              </button>
            ))}
          </div>
        </section>

        <div className="calendarLegend" aria-label="Calendar legend">
          <span>
            <i className="legendComplete" /> 完整循环
          </span>
          <span>
            <i className="legendPartial" /> 部分完成
          </span>
          <span>
            <i className="legendListened" /> 仅收听
          </span>
        </div>
      </section>

      {selectedDate !== null ? (
        <DayDrawer
          date={selectedDate}
          questions={selectedQuestions}
          session={selectedSession}
          onClose={() => {
            setSelectedDate(null);
          }}
        />
      ) : null}

      <nav className="bottomNav" aria-label="Primary">
        {navItems.map((item) => (
          <Link
            aria-current={item.href === "/calendar" ? "page" : undefined}
            href={item.href}
            key={item.href}
          >
            <span>{item.label}</span>
            <small>{item.labelEn}</small>
          </Link>
        ))}
      </nav>
    </main>
  );
}

function CalendarStateMark({ state }: { state: CalendarDayState }) {
  return <span aria-hidden="true" className={`calendarMark calendarMark-${state}`} />;
}

function DayDrawer({
  date,
  onClose,
  questions,
  session
}: {
  date: string;
  onClose: () => void;
  questions: CalendarQuestion[];
  session: CalendarSession | null;
}) {
  return (
    <aside className="dayDrawer" aria-label="Day details">
      <button aria-label="Close details" onClick={onClose} type="button">
        Close
      </button>
      <p>{date}</p>
      <h2>
        {session === null
          ? "这天没有播放记录"
          : `${session.episodeTitleZh} / ${session.episodeTitleEn}`}
      </h2>
      <ul className="segmentChecklist">
        {completedSegments(session).map((segment) => (
          <li key={segment}>✓ {segment}</li>
        ))}
        {session === null || completedSegments(session).length === 0 ? (
          <li>还没有完成的环节</li>
        ) : null}
      </ul>
      <div className="drawerQuestions">
        <h3>孩子的新问题</h3>
        {questions.length === 0 ? <p>这天没有记录新问题。</p> : null}
        {questions.map((question) => (
          <p key={question.id}>{question.questionText}</p>
        ))}
      </div>
    </aside>
  );
}

function completedSegments(session: CalendarSession | null): string[] {
  if (session === null) {
    return [];
  }

  const segments: string[] = [];
  if (session.listened) {
    segments.push("听故事");
  }
  if (session.predict_choice !== null) {
    segments.push("猜一猜");
  }
  if (session.answered_think) {
    segments.push("想一想");
  }
  if (session.taught_back) {
    segments.push("讲给爸妈听");
  }
  if (session.asked_new_question) {
    segments.push("提出新问题");
  }
  return segments;
}

function normalizeSessionRows(value: unknown): CalendarSession[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((row) => {
    if (!isRecord(row)) {
      return [];
    }

    const catalog = row.episode_catalog;
    if (
      typeof row.id !== "string" ||
      typeof row.session_date !== "string" ||
      typeof row.listened !== "boolean" ||
      typeof row.answered_think !== "boolean" ||
      typeof row.taught_back !== "boolean" ||
      typeof row.asked_new_question !== "boolean" ||
      (row.predict_choice !== null && typeof row.predict_choice !== "string")
    ) {
      return [];
    }

    const title = normalizeCatalogTitle(catalog);
    return [
      {
        answered_think: row.answered_think,
        asked_new_question: row.asked_new_question,
        episodeTitleEn: title.en,
        episodeTitleZh: title.zh,
        id: row.id,
        listened: row.listened,
        predict_choice: row.predict_choice,
        sessionDate: row.session_date,
        taught_back: row.taught_back
      }
    ];
  });
}

function normalizeQuestionRows(
  value: unknown,
  timeZone: string,
  month: string
): CalendarQuestion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((row) => {
    if (
      !isRecord(row) ||
      typeof row.id !== "string" ||
      typeof row.created_at !== "string" ||
      typeof row.question_text !== "string" ||
      (row.episode_id !== null && typeof row.episode_id !== "string")
    ) {
      return [];
    }

    const date = getZonedDateString(new Date(row.created_at), timeZone);
    if (toMonthString(date) !== month) {
      return [];
    }

    return [
      {
        date,
        episodeId: row.episode_id,
        id: row.id,
        questionText: row.question_text
      }
    ];
  });
}

function normalizeCatalogTitle(value: unknown): { en: string; zh: string } {
  if (Array.isArray(value)) {
    return normalizeCatalogTitle((value as readonly unknown[])[0]);
  }

  const catalog = value;
  if (
    isRecord(catalog) &&
    typeof catalog.title_en === "string" &&
    typeof catalog.title_zh === "string"
  ) {
    return { en: catalog.title_en, zh: catalog.title_zh };
  }

  return { en: "Episode", zh: "每日一集" };
}

function formatMonthTitle(month: string | null): string {
  if (month === null) {
    return "Calendar";
  }

  const [year, monthNumber] = month.split("-");
  if (year === undefined || monthNumber === undefined) {
    return month;
  }

  return `${year} · ${monthNumber}`;
}

function shiftDate(dateString: string, deltaDays: number): string {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
