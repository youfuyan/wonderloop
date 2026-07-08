"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  EpisodeContentSchema,
  getTodayCardState,
  getWeekDateStrings,
  getZonedDateString,
  hasTodaySessionProgress,
  isDailySessionLoopComplete,
  selectTodayEpisode
} from "@wonderloop/core";
import type {
  DailySession,
  EpisodeContent,
  LoopStatus,
  PlayerLanguageMode,
  RecallPlan
} from "@wonderloop/core";
import {
  claimUnstartedSessionChildProfile,
  getOrCreateSession,
  getRecentRecallPlan,
  type Database
} from "@wonderloop/api-client";

import { getBrowserSupabase, markAuthenticated } from "../auth/session";
import { EpisodePlayer } from "../player/episode-player";

type FamilyRow = Pick<
  Database["public"]["Tables"]["families"]["Row"],
  "id" | "language_pref" | "timezone"
>;
type ChildProfile = Database["public"]["Tables"]["child_profiles"]["Row"];
type DailySessionRow = Database["public"]["Tables"]["daily_sessions"]["Row"];
type CatalogRow = Database["public"]["Views"]["episode_catalog"]["Row"];
type CatalogSelectionRow = Pick<
  CatalogRow,
  "duration" | "id" | "is_free" | "publish_date" | "title_en" | "title_zh"
>;
type TodayEpisode = {
  durationSec: number | null;
  id: string;
  isFree: boolean;
  publishDate: string;
  titleEn: string;
  titleZh: string;
};
type LoadStatus = "loading" | "ready" | "error";
type PlayerAccessState = "closed" | "loading" | "full" | "story_only" | "error";

const navItems = [
  { href: "/today", label: "今日", labelEn: "Today" },
  { href: "/calendar", label: "日历", labelEn: "Calendar" },
  { href: "/questions", label: "问题本", labelEn: "Questions" },
  { href: "/settings", label: "设置", labelEn: "Settings" }
] as const;

export function TodayHome() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [episode, setEpisode] = useState<TodayEpisode | null>(null);
  const [family, setFamily] = useState<FamilyRow | null>(null);
  const [isFallbackEpisode, setIsFallbackEpisode] = useState(false);
  const [playerAccess, setPlayerAccess] = useState<PlayerAccessState>("closed");
  const [playerContent, setPlayerContent] = useState<EpisodeContent | null>(null);
  const [playerRecallPlan, setPlayerRecallPlan] = useState<RecallPlan | null>(null);
  const [questionSaveFailed, setQuestionSaveFailed] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [session, setSession] = useState<DailySessionRow | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [today, setToday] = useState<string | null>(null);
  const [weekCompleteDates, setWeekCompleteDates] = useState<Set<string>>(
    () => new Set()
  );

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

    async function loadToday() {
      const { data: authData } = await client.auth.getSession();
      if (authData.session === null) {
        window.location.assign("/login?next=/today");
        return;
      }

      markAuthenticated(authData.session.expires_at);

      const { data: familyRow, error: familyError } = await client
        .from("families")
        .select("id, language_pref, timezone")
        .single();

      if (familyError !== null) {
        setStatus("error");
        return;
      }

      const familyToday = getZonedDateString(new Date(), familyRow.timezone);
      const { data: childRows, error: childrenError } = await client
        .from("child_profiles")
        .select("id, family_id, nickname, age_band, created_at")
        .order("created_at", { ascending: true });

      if (childrenError !== null) {
        setStatus("error");
        return;
      }

      const { data: catalogRows, error: catalogError } = await client
        .from("episode_catalog")
        .select("id, title_en, title_zh, is_free, publish_date, duration")
        .lte("publish_date", familyToday)
        .order("publish_date", { ascending: false })
        .limit(14);

      if (catalogError !== null) {
        setStatus("error");
        return;
      }

      const episodes = catalogRows.flatMap(normalizeCatalogRow);
      const selection = selectTodayEpisode(episodes, familyToday);

      if (cancelled) {
        return;
      }

      setChildren(childRows);
      setEpisode(selection?.episode ?? null);
      setFamily(familyRow);
      setIsFallbackEpisode(selection?.isFallback ?? false);
      setSelectedChildId(childRows[0]?.id ?? null);
      setToday(familyToday);
      setStatus("ready");
    }

    void loadToday().catch(() => {
      if (!cancelled) {
        setStatus("error");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (supabase === null || episode === null || today === null) {
      return;
    }

    const client = supabase;
    const currentEpisode = episode;
    const currentToday = today;
    let cancelled = false;

    async function loadSessionState() {
      const { data: sessionRow, error: sessionError } = await client
        .from("daily_sessions")
        .select("*")
        .eq("episode_id", currentEpisode.id)
        .maybeSingle();

      if (sessionError !== null) {
        setStatus("error");
        return;
      }

      const weekDates = getWeekDateStrings(currentToday);
      const { data: weekRows, error: weekError } = await client
        .from("daily_sessions")
        .select("session_date, loop_complete")
        .gte("session_date", weekDates[0] ?? currentToday)
        .lte("session_date", weekDates[6] ?? currentToday)
        .eq("loop_complete", true);

      if (weekError !== null) {
        setStatus("error");
        return;
      }

      if (!cancelled) {
        setSession(sessionRow);
        if (sessionRow !== null && hasTodaySessionProgress(sessionRow)) {
          setSelectedChildId(sessionRow.child_profile_id);
        }
        setWeekCompleteDates(new Set(weekRows.map((row) => row.session_date)));
      }
    }

    void loadSessionState().catch(() => {
      if (!cancelled) {
        setStatus("error");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [episode, selectedChildId, supabase, today]);

  useEffect(() => {
    if (session?.loop_complete === true) {
      setWeekCompleteDates((current) => new Set([...current, session.session_date]));
    }
  }, [session?.loop_complete, session?.session_date]);

  async function openEpisode() {
    if (supabase === null || episode === null || family === null || today === null) {
      return;
    }

    setPlayerAccess("loading");
    setPlayerContent(null);
    setPlayerRecallPlan(null);
    setQuestionSaveFailed(false);

    try {
      const nextSession = await getOrCreateSession(supabase, {
        childProfileId: selectedChildId,
        episodeId: episode.id,
        languageMode: family.language_pref,
        sessionDate: today
      });
      const claimedSession = await claimUnstartedSessionChildProfile(
        supabase,
        nextSession,
        selectedChildId
      );
      const [{ data, error }, recallPlan] = await Promise.all([
        supabase.rpc("get_full_episode", { p_episode_id: episode.id }),
        getRecentRecallPlan(supabase, today)
      ]);

      if (error !== null || data === null) {
        setPlayerAccess("error");
        setSession(claimedSession);
        return;
      }

      const episodeAccess = parseEpisodeAccess(data);
      setSession(claimedSession);
      setPlayerRecallPlan(recallPlan);

      if (episodeAccess?.access === "full") {
        setPlayerContent(episodeAccess.content);
        setPlayerAccess("full");
        return;
      }

      if (episodeAccess?.access === "story_only") {
        setPlayerAccess("story_only");
        return;
      }

      setPlayerAccess("error");
    } catch {
      setPlayerAccess("error");
    }
  }

  function applySessionUpdate(update: Partial<DailySession>) {
    setSession((current) =>
      current === null ? current : mergeSessionUpdate(current, update)
    );
  }

  function saveNewQuestion(questionText: string) {
    if (supabase === null || family === null || episode === null) {
      return;
    }

    const trimmedQuestion = questionText.trim();
    if (trimmedQuestion.length === 0) {
      return;
    }

    void (async () => {
      try {
        const { error } = await supabase.from("child_questions").insert({
          child_profile_id: session?.child_profile_id ?? selectedChildId,
          episode_id: episode.id,
          family_id: family.id,
          question_text: trimmedQuestion
        });

        if (error !== null) {
          setQuestionSaveFailed(true);
        }
      } catch {
        setQuestionSaveFailed(true);
      }
    })();
  }

  const weekDates = today === null ? [] : getWeekDateStrings(today);
  const cardState = getTodayCardState(session);
  const sessionHasProgress = hasTodaySessionProgress(session);
  const selectedChild = children.find((child) => child.id === selectedChildId) ?? null;
  const languageMode: PlayerLanguageMode = family?.language_pref ?? "bilingual";

  return (
    <main className="todayShell">
      <section className="todayContent" aria-label="Today">
        <header className="todayHeader">
          <div>
            <p>WonderLoop</p>
            <h1>今天好奇什么？</h1>
            <span>What are we wondering today?</span>
          </div>
          <label className="childSelector">
            <span>孩子 / Child</span>
            <select
              onChange={(event) => {
                setSelectedChildId(
                  event.target.value === "" ? null : event.target.value
                );
                setPlayerAccess("closed");
              }}
              disabled={sessionHasProgress}
              value={selectedChildId ?? ""}
            >
              {children.length === 0 ? <option value="">Family</option> : null}
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.nickname}
                </option>
              ))}
            </select>
          </label>
        </header>

        {status === "loading" ? (
          <p className="todayMessage">正在准备今日一集...</p>
        ) : null}
        {status === "error" ? (
          <p className="todayMessage">今天页面暂时加载失败，请稍后再试。</p>
        ) : null}

        {status === "ready" ? (
          <>
            <article className="todayMainCard">
              <div className="todayCardTopline">
                <span>{isFallbackEpisode ? "最近一集" : "今日一集"}</span>
                {episode?.isFree === true ? (
                  <strong>Free</strong>
                ) : (
                  <strong>Member</strong>
                )}
              </div>

              {episode === null ? (
                <div className="todayEmpty">
                  <h2>今天还没有可播放的一集</h2>
                  <p>No published episode is available yet.</p>
                </div>
              ) : (
                <>
                  <div className="todayTitleBlock">
                    <h2>{episode.titleZh}</h2>
                    <p>{episode.titleEn}</p>
                    <span>{formatDuration(episode.durationSec)}</span>
                  </div>

                  {isFallbackEpisode ? (
                    <p className="todayNotice">
                      今天的内容还在路上，先听最近发布的一集。
                    </p>
                  ) : null}

                  <TodayStateBadge state={cardState} />

                  {cardState.kind === "completed" ? (
                    <div className="todayCompleteMark" aria-label="Completed">
                      <strong>✓</strong>
                      <span>明天见 / See you tomorrow</span>
                    </div>
                  ) : (
                    <button
                      className="todayPlayButton"
                      disabled={playerAccess === "loading"}
                      onClick={() => void openEpisode()}
                      type="button"
                    >
                      {cardState.kind === "not_started"
                        ? "播放 / Play"
                        : "继续 / Continue"}
                    </button>
                  )}
                </>
              )}
            </article>

            <section className="weekProgressCard" aria-labelledby="week-progress-title">
              <div>
                <h2 id="week-progress-title">本周进度</h2>
                <p>Completed loops this week</p>
              </div>
              <div className="weekDots" aria-label="Weekly completed days">
                {weekDates.map((date) => (
                  <span
                    className={weekCompleteDates.has(date) ? "isComplete" : ""}
                    key={date}
                    title={date}
                  />
                ))}
              </div>
            </section>

            {selectedChild !== null ? (
              <p className="todayChildNote">
                {sessionHasProgress
                  ? `当前会话归属给 ${selectedChild.nickname}。`
                  : `当前会话会归属给 ${selectedChild.nickname}。`}
              </p>
            ) : null}
            {questionSaveFailed ? (
              <p className="todayMessage">
                新问题暂时没有保存成功，请稍后在问题本里补记。
              </p>
            ) : null}

            {playerAccess === "loading" ? (
              <p className="todayMessage">正在打开播放器...</p>
            ) : null}
            {playerAccess === "error" ? (
              <p className="todayMessage">这一集暂时无法打开，请稍后再试。</p>
            ) : null}
            {playerAccess === "story_only" ? <UpgradeHint /> : null}
            {playerAccess === "full" &&
            episode !== null &&
            session !== null &&
            playerContent !== null ? (
              <EpisodePlayer
                episodeContent={playerContent}
                episodeId={episode.id}
                initialSession={session}
                languageMode={languageMode}
                recallPlan={playerRecallPlan}
                sessionId={session.id}
                onNewQuestionSubmitted={saveNewQuestion}
                onSessionUpdate={applySessionUpdate}
              />
            ) : null}
          </>
        ) : null}
      </section>

      <nav className="bottomNav" aria-label="Primary">
        {navItems.map((item) => (
          <Link
            aria-current={item.href === "/today" ? "page" : undefined}
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

function TodayStateBadge({ state }: { state: ReturnType<typeof getTodayCardState> }) {
  if (state.kind === "not_started") {
    return <p className="todayState">未开始 / Not started</p>;
  }

  if (state.kind === "completed") {
    return <p className="todayState">已完成 / Completed</p>;
  }

  return (
    <p className="todayState">
      继续 · {segmentLabel(state.status)} / Continue · {segmentLabelEn(state.status)}
    </p>
  );
}

function UpgradeHint() {
  return (
    <section className="upgradeHint" aria-label="Membership required">
      <h2>会员内容</h2>
      <p>这一集需要会员收听完整音频。Phase 2 前先放一个了解会员入口。</p>
      <Link href="/settings">了解会员 / Learn about membership</Link>
    </section>
  );
}

function normalizeCatalogRow(row: CatalogSelectionRow): TodayEpisode[] {
  if (
    row.id === null ||
    row.publish_date === null ||
    row.title_en === null ||
    row.title_zh === null ||
    row.is_free === null
  ) {
    return [];
  }

  return [
    {
      durationSec: parseDuration(row.duration),
      id: row.id,
      isFree: row.is_free,
      publishDate: row.publish_date,
      titleEn: row.title_en,
      titleZh: row.title_zh
    }
  ];
}

function parseEpisodeAccess(
  value: unknown
): { access: "full"; content: EpisodeContent } | { access: "story_only" } | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.access === "story_only") {
    return { access: "story_only" };
  }

  if (value.access !== "full") {
    return null;
  }

  const parsedContent = EpisodeContentSchema.safeParse(value.content);
  return parsedContent.success ? { access: "full", content: parsedContent.data } : null;
}

function parseDuration(value: unknown): number | null {
  if (!isRecord(value)) {
    return null;
  }

  const durations = [value.en, value.zh].filter(
    (duration): duration is number => typeof duration === "number"
  );
  if (durations.length === 0) {
    return null;
  }

  return Math.max(...durations);
}

function formatDuration(durationSec: number | null): string {
  if (durationSec === null) {
    return "5-8 min";
  }

  return `${String(Math.ceil(durationSec / 60))} min`;
}

function segmentLabel(status: LoopStatus): string {
  switch (status) {
    case "predict_paused":
      return "猜一猜环节";
    case "think_paused":
      return "想一想环节";
    case "teach_back_paused":
      return "讲给爸妈听";
    case "new_question_paused":
      return "提出新问题";
    default:
      return "播放中";
  }
}

function segmentLabelEn(status: LoopStatus): string {
  switch (status) {
    case "predict_paused":
      return "Predict";
    case "think_paused":
      return "Think";
    case "teach_back_paused":
      return "Teach back";
    case "new_question_paused":
      return "Ask";
    default:
      return "Playing";
  }
}

function mergeSessionUpdate(
  current: DailySessionRow,
  update: Partial<DailySession>
): DailySessionRow {
  const next = { ...current, ...update };
  const loopComplete = isDailySessionLoopComplete(next);

  return {
    ...next,
    completed_at: loopComplete
      ? (next.completed_at ?? new Date().toISOString())
      : next.completed_at,
    loop_complete: loopComplete
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
