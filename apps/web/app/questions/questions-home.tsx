"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { buildQuestionBookExport, isValidQuestionText } from "@wonderloop/core";
import type { Database } from "@wonderloop/api-client";

import { getBrowserSupabase, markAuthenticated } from "../auth/session";

type ChildProfile = Pick<
  Database["public"]["Tables"]["child_profiles"]["Row"],
  "id" | "nickname"
>;
type FamilyRow = Pick<Database["public"]["Tables"]["families"]["Row"], "id">;
type QuestionEntry = {
  childNickname: string | null;
  childProfileId: string | null;
  createdAt: string;
  episodeTitleEn: string | null;
  episodeTitleZh: string | null;
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

export function QuestionsHome() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [family, setFamily] = useState<FamilyRow | null>(null);
  const [newChildId, setNewChildId] = useState<string | null>(null);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [questions, setQuestions] = useState<QuestionEntry[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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

    async function loadQuestionBook() {
      const { data: authData } = await client.auth.getSession();
      if (authData.session === null) {
        window.location.assign("/login?next=/questions");
        return;
      }

      markAuthenticated(authData.session.expires_at);

      const [familyResult, childResult, questionResult] = await Promise.all([
        client.from("families").select("id").single(),
        client
          .from("child_profiles")
          .select("id, nickname")
          .order("created_at", { ascending: true }),
        client
          .from("child_questions")
          .select(
            "id, child_profile_id, question_text, created_at, child_profiles(nickname), episode_catalog(title_en, title_zh)"
          )
          .order("created_at", { ascending: false })
      ]);

      if (
        familyResult.error !== null ||
        childResult.error !== null ||
        questionResult.error !== null
      ) {
        setStatus("error");
        return;
      }

      if (!cancelled) {
        setFamily(familyResult.data);
        setChildren(childResult.data);
        setNewChildId(childResult.data[0]?.id ?? null);
        setQuestions(normalizeQuestionRows(questionResult.data));
        setStatus("ready");
      }
    }

    void loadQuestionBook().catch(() => {
      if (!cancelled) {
        setStatus("error");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function addQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (supabase === null || family === null || !isValidQuestionText(newQuestionText)) {
      return;
    }

    const trimmedQuestion = newQuestionText.trim();
    const { data, error } = await supabase
      .from("child_questions")
      .insert({
        child_profile_id: newChildId,
        episode_id: null,
        family_id: family.id,
        question_text: trimmedQuestion
      })
      .select(
        "id, child_profile_id, question_text, created_at, child_profiles(nickname), episode_catalog(title_en, title_zh)"
      )
      .single();

    if (error !== null) {
      setStatusMessage("问题暂时没有保存成功，请稍后再试。");
      return;
    }

    const normalizedQuestion = normalizeQuestionRow(data);
    if (normalizedQuestion === null) {
      setStatusMessage("问题已保存，但列表暂时没有刷新成功。");
      return;
    }

    setQuestions((current) => [normalizedQuestion, ...current]);
    setNewQuestionText("");
    setStatusMessage(null);
  }

  async function saveEdit(questionId: string) {
    if (supabase === null || !isValidQuestionText(editText)) {
      return;
    }

    const trimmedQuestion = editText.trim();
    const { data, error } = await supabase
      .from("child_questions")
      .update({ question_text: trimmedQuestion })
      .eq("id", questionId)
      .select(
        "id, child_profile_id, question_text, created_at, child_profiles(nickname), episode_catalog(title_en, title_zh)"
      )
      .single();

    if (error !== null) {
      setStatusMessage("问题暂时没有更新成功，请稍后再试。");
      return;
    }

    const normalizedQuestion = normalizeQuestionRow(data);
    if (normalizedQuestion === null) {
      setStatusMessage("问题已更新，但列表暂时没有刷新成功。");
      return;
    }

    setQuestions((current) =>
      current.map((question) =>
        question.id === questionId ? normalizedQuestion : question
      )
    );
    setEditingId(null);
    setEditText("");
    setStatusMessage(null);
  }

  async function deleteQuestion(questionId: string) {
    if (supabase === null) {
      return;
    }

    const confirmed = window.confirm("确定删除这个问题吗？\nDelete this question?");
    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from("child_questions")
      .delete()
      .eq("id", questionId);

    if (error !== null) {
      setStatusMessage("问题暂时没有删除成功，请稍后再试。");
      return;
    }

    setQuestions((current) => current.filter((question) => question.id !== questionId));
    setStatusMessage(null);
  }

  function exportQuestions() {
    const text = buildQuestionBookExport(
      questions.map((question) => ({
        childNickname: question.childNickname,
        createdAt: question.createdAt,
        episodeTitle: formatEpisodeTitle(question),
        questionText: question.questionText
      }))
    );
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "wonderloop-question-book.txt";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  }

  return (
    <main className="questionsShell">
      <section className="questionsContent" aria-label="Question book">
        <header className="questionsHeader">
          <div>
            <p>问题本</p>
            <h1>孩子的好问题</h1>
            <span>Every why is worth keeping.</span>
          </div>
          <button
            disabled={questions.length === 0}
            onClick={exportQuestions}
            type="button"
          >
            Export TXT
          </button>
        </header>

        <section className="questionStats" aria-label="Question statistics">
          <strong>累计 {questions.length} 个问题</strong>
          <span>Total questions saved</span>
        </section>

        <form
          className="questionComposer"
          onSubmit={(event) => void addQuestion(event)}
        >
          <label>
            <span>手动新增 / Add a question</span>
            <textarea
              maxLength={300}
              onChange={(event) => {
                setNewQuestionText(event.target.value);
              }}
              placeholder="孩子今天问了什么？"
              value={newQuestionText}
            />
          </label>
          <div className="questionComposerActions">
            <label>
              <span>孩子 / Child</span>
              <select
                onChange={(event) => {
                  setNewChildId(
                    event.target.value.length === 0 ? null : event.target.value
                  );
                }}
                value={newChildId ?? ""}
              >
                <option value="">Family</option>
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.nickname}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={!isValidQuestionText(newQuestionText)} type="submit">
              Save
            </button>
          </div>
          <p>{newQuestionText.trim().length}/300</p>
        </form>

        {status === "loading" ? (
          <p className="questionsMessage">正在打开问题本...</p>
        ) : null}
        {status === "error" ? (
          <p className="questionsMessage">问题本暂时加载失败，请稍后再试。</p>
        ) : null}
        {statusMessage !== null ? (
          <p className="questionsMessage">{statusMessage}</p>
        ) : null}

        {status === "ready" && questions.length === 0 ? <QuestionEmptyState /> : null}

        <section className="questionList" aria-label="Saved questions">
          {questions.map((question) => (
            <article className="questionItem" key={question.id}>
              {editingId === question.id ? (
                <EditQuestionForm
                  value={editText}
                  onCancel={() => {
                    setEditingId(null);
                    setEditText("");
                  }}
                  onChange={setEditText}
                  onSave={() => void saveEdit(question.id)}
                />
              ) : (
                <>
                  <p>{question.questionText}</p>
                  <div className="questionMeta">
                    <span>{formatDate(question.createdAt)}</span>
                    <span>{formatEpisodeTitle(question) ?? "Life question"}</span>
                    {question.childNickname !== null ? (
                      <strong>{question.childNickname}</strong>
                    ) : null}
                  </div>
                  <div className="questionActions">
                    <button
                      onClick={() => {
                        setEditingId(question.id);
                        setEditText(question.questionText);
                      }}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void deleteQuestion(question.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </article>
          ))}
        </section>
      </section>

      <nav className="bottomNav" aria-label="Primary">
        {navItems.map((item) => (
          <Link
            aria-current={item.href === "/questions" ? "page" : undefined}
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

function QuestionEmptyState() {
  return (
    <section className="questionEmpty">
      <h2>孩子的第一个“为什么”，值得被记住</h2>
      <p>可以从每天的好奇心循环里保存，也可以随手记录生活里的问题。</p>
    </section>
  );
}

function EditQuestionForm({
  onCancel,
  onChange,
  onSave,
  value
}: {
  onCancel: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
  value: string;
}) {
  return (
    <div className="editQuestionForm">
      <textarea
        maxLength={300}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        value={value}
      />
      <span>{value.trim().length}/300</span>
      <div className="questionActions">
        <button disabled={!isValidQuestionText(value)} onClick={onSave} type="button">
          Save
        </button>
        <button onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </div>
  );
}

function normalizeQuestionRows(value: unknown): QuestionEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((row) => {
    const question = normalizeQuestionRow(row);
    return question === null ? [] : [question];
  });
}

function normalizeQuestionRow(value: unknown): QuestionEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.question_text !== "string" ||
    typeof value.created_at !== "string" ||
    (value.child_profile_id !== null && typeof value.child_profile_id !== "string")
  ) {
    return null;
  }

  const child = normalizeChild(value.child_profiles);
  const episode = normalizeEpisode(value.episode_catalog);
  return {
    childNickname: child?.nickname ?? null,
    childProfileId: value.child_profile_id,
    createdAt: value.created_at,
    episodeTitleEn: episode?.titleEn ?? null,
    episodeTitleZh: episode?.titleZh ?? null,
    id: value.id,
    questionText: value.question_text
  };
}

function normalizeChild(value: unknown): { nickname: string } | null {
  const child = Array.isArray(value) ? (value as readonly unknown[])[0] : value;
  return isRecord(child) && typeof child.nickname === "string"
    ? { nickname: child.nickname }
    : null;
}

function normalizeEpisode(value: unknown): { titleEn: string; titleZh: string } | null {
  const episode = Array.isArray(value) ? (value as readonly unknown[])[0] : value;
  return isRecord(episode) &&
    typeof episode.title_en === "string" &&
    typeof episode.title_zh === "string"
    ? { titleEn: episode.title_en, titleZh: episode.title_zh }
    : null;
}

function formatEpisodeTitle(question: QuestionEntry): string | null {
  if (question.episodeTitleZh === null || question.episodeTitleEn === null) {
    return null;
  }

  return `${question.episodeTitleZh} / ${question.episodeTitleEn}`;
}

function formatDate(value: string): string {
  return value.slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
