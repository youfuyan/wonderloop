"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import { createWonderLoopClient } from "@wonderloop/api-client";
import type { Database } from "@wonderloop/api-client";

type LanguagePref = Database["public"]["Enums"]["language_mode"];
type Source = "xiaohongshu" | "wechat" | "school" | "friend" | "other";
type SubmitState =
  "idle" | "submitting" | "success" | "duplicate" | "error" | "missingConfig";

const languageOptions: { value: LanguagePref; label: string }[] = [
  { value: "bilingual", label: "Bilingual / 双语" },
  { value: "en", label: "English" },
  { value: "zh", label: "中文" }
];

const sourceOptions: { value: Source; label: string }[] = [
  { value: "xiaohongshu", label: "Xiaohongshu / 小红书" },
  { value: "wechat", label: "WeChat / 微信" },
  { value: "school", label: "School / 学校" },
  { value: "friend", label: "Friend / 朋友" },
  { value: "other", label: "Other / 其他" }
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function messageForState(state: SubmitState): string {
  switch (state) {
    case "success":
      return "You are on the list. 已加入候补名单。";
    case "duplicate":
      return "This email is already on the list. 这个邮箱已经在名单里。";
    case "error":
      return "Something went wrong. Please try again. 提交失败，请再试一次。";
    case "missingConfig":
      return "Waitlist is not configured yet. 候补名单暂未配置。";
    case "idle":
    case "submitting":
      return "";
  }
}

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [languagePref, setLanguagePref] = useState<LanguagePref>("bilingual");
  const [source, setSource] = useState<Source>("friend");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  const supabase = useMemo(() => {
    if (supabaseUrl === undefined || supabaseAnonKey === undefined) {
      return null;
    }

    return createWonderLoopClient(supabaseUrl, supabaseAnonKey);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (supabase === null) {
      setSubmitState("missingConfig");
      return;
    }

    setSubmitState("submitting");
    const { error } = await supabase.from("waitlist").insert({
      email: email.trim().toLowerCase(),
      language_pref: languagePref,
      source
    });

    if (error === null) {
      setSubmitState("success");
      setEmail("");
      return;
    }

    if (error.code === "23505") {
      setSubmitState("duplicate");
      return;
    }

    setSubmitState("error");
  }

  const message = messageForState(submitState);

  return (
    <form
      className="waitlistForm"
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      <label>
        <span>Email</span>
        <input
          autoComplete="email"
          inputMode="email"
          onChange={(event) => {
            setEmail(event.target.value);
          }}
          placeholder="parent@example.com"
          required
          type="email"
          value={email}
        />
      </label>

      <label>
        <span>Language / 语言</span>
        <select
          onChange={(event) => {
            setLanguagePref(event.target.value as LanguagePref);
          }}
          value={languagePref}
        >
          {languageOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Source / 来源</span>
        <select
          onChange={(event) => {
            setSource(event.target.value as Source);
          }}
          value={source}
        >
          {sourceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button disabled={submitState === "submitting"} type="submit">
        {submitState === "submitting" ? "Joining..." : "Join / 加入"}
      </button>

      {message.length > 0 ? (
        <p className="formMessage" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
