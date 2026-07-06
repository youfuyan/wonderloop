"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { t } from "@wonderloop/core";
import type { MessageKey } from "@wonderloop/core";
import type { Database } from "@wonderloop/api-client";

import { BilingualCopy } from "../auth/bilingual-copy";
import {
  getBrowserSupabase,
  markAuthenticated,
  markOnboardingComplete
} from "../auth/session";

type AgeBand = Database["public"]["Enums"]["age_band"];
type LanguageMode = Database["public"]["Enums"]["language_mode"];
type ChildProfile = Database["public"]["Tables"]["child_profiles"]["Row"];
type FamilySettings = Pick<
  Database["public"]["Tables"]["families"]["Row"],
  "id" | "language_pref" | "timezone"
>;
type OnboardingStep = "language" | "children" | "timezone";

const languageOptions: { value: LanguageMode; key: MessageKey }[] = [
  { value: "bilingual", key: "languageBilingual" },
  { value: "en", key: "languageEnglish" },
  { value: "zh", key: "languageChinese" }
];

const ageBandOptions: AgeBand[] = ["5-6", "6-8", "5-8"];

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>("language");
  const [family, setFamily] = useState<FamilySettings | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [languagePref, setLanguagePref] = useState<LanguageMode>("bilingual");
  const [timezone, setTimezone] = useState("America/Los_Angeles");
  const [childNickname, setChildNickname] = useState("");
  const [childAgeBand, setChildAgeBand] = useState<AgeBand>("5-8");
  const [statusKey, setStatusKey] = useState<MessageKey | null>(null);

  const supabase = useMemo(() => {
    try {
      return getBrowserSupabase();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detectedTimezone.length > 0) {
      setTimezone(detectedTimezone);
    }

    if (supabase === null) {
      setStatusKey("somethingWentWrong");
      return;
    }

    void supabase.auth.getSession().then(async ({ data }) => {
      if (data.session === null) {
        router.replace("/login?next=/onboarding");
        return;
      }

      markAuthenticated(data.session.expires_at);
      setUserId(data.session.user.id);

      const { data: familyRow, error: familyError } = await supabase
        .from("families")
        .select("id, language_pref, timezone")
        .single();

      if (familyError !== null) {
        setStatusKey("somethingWentWrong");
        return;
      }

      setFamily(familyRow);
      setLanguagePref(familyRow.language_pref);
      setTimezone(familyRow.timezone);

      const { data: childRows, error: childrenError } = await supabase
        .from("child_profiles")
        .select("id, family_id, nickname, age_band, created_at")
        .order("created_at", { ascending: true });

      if (childrenError !== null) {
        setStatusKey("somethingWentWrong");
        return;
      }

      setChildren(childRows);
    });
  }, [router, supabase]);

  async function saveLanguage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (supabase === null || family === null) {
      setStatusKey("somethingWentWrong");
      return;
    }

    const { error } = await supabase
      .from("families")
      .update({ language_pref: languagePref })
      .eq("id", family.id);

    if (error !== null) {
      setStatusKey("somethingWentWrong");
      return;
    }

    setStatusKey(null);
    setStep("children");
  }

  async function addChild(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (supabase === null || family === null) {
      setStatusKey("somethingWentWrong");
      return;
    }

    if (children.length >= 4) {
      setStatusKey("childLimitReached");
      return;
    }

    const nickname = childNickname.trim();
    if (nickname.length === 0) {
      return;
    }

    const { data, error } = await supabase
      .from("child_profiles")
      .insert({
        age_band: childAgeBand,
        family_id: family.id,
        nickname
      })
      .select("id, family_id, nickname, age_band, created_at")
      .single();

    if (error !== null) {
      setStatusKey("somethingWentWrong");
      return;
    }

    setChildren([...children, data]);
    setChildNickname("");
    setStatusKey(null);
  }

  async function saveTimezone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (supabase === null || family === null || userId === null) {
      setStatusKey("somethingWentWrong");
      return;
    }

    const { error } = await supabase
      .from("families")
      .update({ timezone: timezone.trim() })
      .eq("id", family.id);

    if (error !== null) {
      setStatusKey("somethingWentWrong");
      return;
    }

    markOnboardingComplete(userId);
    router.replace("/today");
  }

  return (
    <section className="authPanel onboardingPanel">
      {step === "language" ? (
        <form className="authForm" onSubmit={(event) => void saveLanguage(event)}>
          <div className="authHeader">
            <h1>
              <BilingualCopy messageKey="onboardingLanguageTitle" />
            </h1>
          </div>
          <label>
            <span>
              <BilingualCopy messageKey="languageLabel" />
            </span>
            <select
              onChange={(event) => {
                setLanguagePref(event.target.value as LanguageMode);
              }}
              value={languagePref}
            >
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t("zh", option.key)} / {t("en", option.key)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">
            <BilingualCopy messageKey="next" />
          </button>
        </form>
      ) : null}

      {step === "children" ? (
        <div className="authForm">
          <div className="authHeader">
            <h1>
              <BilingualCopy messageKey="onboardingChildrenTitle" />
            </h1>
            <p>
              <BilingualCopy messageKey="onboardingChildrenHelp" />
            </p>
          </div>

          <div className="childList">
            {children.map((child) => (
              <div className="childRow" key={child.id}>
                <strong>{child.nickname}</strong>
                <span>{child.age_band}</span>
              </div>
            ))}
          </div>

          <form className="childForm" onSubmit={(event) => void addChild(event)}>
            <label>
              <span>
                <BilingualCopy messageKey="childNickname" />
              </span>
              <input
                maxLength={20}
                onChange={(event) => {
                  setChildNickname(event.target.value);
                }}
                placeholder={t("en", "childNicknamePlaceholder")}
                type="text"
                value={childNickname}
              />
            </label>
            <label>
              <span>
                <BilingualCopy messageKey="childAgeBand" />
              </span>
              <select
                onChange={(event) => {
                  setChildAgeBand(event.target.value as AgeBand);
                }}
                value={childAgeBand}
              >
                {ageBandOptions.map((ageBand) => (
                  <option key={ageBand} value={ageBand}>
                    {ageBand}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={children.length >= 4} type="submit">
              <BilingualCopy messageKey="addChild" />
            </button>
          </form>

          <div className="buttonRow">
            <button
              className="secondaryAction"
              onClick={() => {
                setStep("timezone");
                setStatusKey(null);
              }}
              type="button"
            >
              <BilingualCopy messageKey="onboardingSkipChildren" />
            </button>
            <button
              onClick={() => {
                setStep("timezone");
                setStatusKey(null);
              }}
              type="button"
            >
              <BilingualCopy messageKey="next" />
            </button>
          </div>
        </div>
      ) : null}

      {step === "timezone" ? (
        <form className="authForm" onSubmit={(event) => void saveTimezone(event)}>
          <div className="authHeader">
            <h1>
              <BilingualCopy messageKey="onboardingTimezoneTitle" />
            </h1>
            <p>
              <BilingualCopy messageKey="onboardingTimezoneHelp" />
            </p>
          </div>
          <label>
            <span>
              <BilingualCopy messageKey="timezoneLabel" />
            </span>
            <input
              onChange={(event) => {
                setTimezone(event.target.value);
              }}
              required
              type="text"
              value={timezone}
            />
          </label>
          <button type="submit">
            <BilingualCopy messageKey="onboardingComplete" />
          </button>
        </form>
      ) : null}

      {statusKey !== null ? (
        <p className="formMessage" role="status">
          {t("zh", statusKey)} / {t("en", statusKey)}
        </p>
      ) : null}
    </section>
  );
}
