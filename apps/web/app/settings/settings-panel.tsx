"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { t } from "@wonderloop/core";
import type { MessageKey } from "@wonderloop/core";
import type { Database } from "@wonderloop/api-client";

import { BilingualCopy } from "../auth/bilingual-copy";
import {
  clearAuthCookies,
  getBrowserSupabase,
  markAuthenticated
} from "../auth/session";

type AgeBand = Database["public"]["Enums"]["age_band"];
type LanguageMode = Database["public"]["Enums"]["language_mode"];
type ChildProfile = Database["public"]["Tables"]["child_profiles"]["Row"];
type FamilySettings = Pick<
  Database["public"]["Tables"]["families"]["Row"],
  "id" | "language_pref" | "timezone"
>;

const languageOptions: { value: LanguageMode; key: MessageKey }[] = [
  { value: "bilingual", key: "languageBilingual" },
  { value: "en", key: "languageEnglish" },
  { value: "zh", key: "languageChinese" }
];

const ageBandOptions: AgeBand[] = ["5-6", "6-8", "5-8"];

export function SettingsPanel() {
  const router = useRouter();
  const [family, setFamily] = useState<FamilySettings | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
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
    if (supabase === null) {
      setStatusKey("somethingWentWrong");
      return;
    }

    void supabase.auth.getSession().then(async ({ data }) => {
      if (data.session === null) {
        router.replace("/login?next=/settings");
        return;
      }

      markAuthenticated(data.session.expires_at);

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

  async function saveFamily(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (supabase === null || family === null) {
      setStatusKey("somethingWentWrong");
      return;
    }

    const { error } = await supabase
      .from("families")
      .update({ language_pref: languagePref, timezone: timezone.trim() })
      .eq("id", family.id);

    setStatusKey(error === null ? "saved" : "somethingWentWrong");
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
      .insert({ age_band: childAgeBand, family_id: family.id, nickname })
      .select("id, family_id, nickname, age_band, created_at")
      .single();

    if (error !== null) {
      setStatusKey("somethingWentWrong");
      return;
    }

    setChildren([...children, data]);
    setChildNickname("");
    setStatusKey("saved");
  }

  async function updateChild(child: ChildProfile) {
    if (supabase === null) {
      setStatusKey("somethingWentWrong");
      return;
    }

    const { error } = await supabase
      .from("child_profiles")
      .update({ age_band: child.age_band, nickname: child.nickname.trim() })
      .eq("id", child.id);

    setStatusKey(error === null ? "saved" : "somethingWentWrong");
  }

  async function deleteChild(childId: string) {
    if (supabase === null) {
      setStatusKey("somethingWentWrong");
      return;
    }

    const { error } = await supabase.from("child_profiles").delete().eq("id", childId);

    if (error !== null) {
      setStatusKey("somethingWentWrong");
      return;
    }

    setChildren(children.filter((child) => child.id !== childId));
    setStatusKey("saved");
  }

  async function deleteAccount() {
    if (supabase === null) {
      setStatusKey("somethingWentWrong");
      return;
    }

    const confirmed = window.confirm(
      `${t("zh", "deleteAccountConfirm")}\n${t("en", "deleteAccountConfirm")}`
    );

    if (!confirmed) {
      return;
    }

    const deleteResult = await supabase.functions.invoke<{ ok: boolean }>(
      "delete-account",
      {
        method: "POST"
      }
    );

    if (deleteResult.error !== null) {
      setStatusKey("deleteAccountError");
      return;
    }

    await supabase.auth.signOut();
    clearAuthCookies();
    router.replace("/login");
  }

  function updateChildField(
    childId: string,
    update: Pick<ChildProfile, "age_band"> | Pick<ChildProfile, "nickname">
  ) {
    setChildren(
      children.map((child) => (child.id === childId ? { ...child, ...update } : child))
    );
  }

  return (
    <section className="authPanel settingsPanel" aria-labelledby="settings-title">
      <div className="authHeader">
        <h1 id="settings-title">
          <BilingualCopy messageKey="familySettings" />
        </h1>
        <p>
          <BilingualCopy messageKey="settingsSubtitle" />
        </p>
      </div>

      <form className="authForm" onSubmit={(event) => void saveFamily(event)}>
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
          <BilingualCopy messageKey="save" />
        </button>
      </form>

      <div className="settingsSection">
        <h2>
          <BilingualCopy messageKey="childProfiles" />
        </h2>
        <div className="childEditorList">
          {children.map((child) => (
            <form
              className="childForm childEditor"
              key={child.id}
              onSubmit={(event) => {
                event.preventDefault();
                void updateChild(child);
              }}
            >
              <label>
                <span>
                  <BilingualCopy messageKey="childNickname" />
                </span>
                <input
                  maxLength={20}
                  onChange={(event) => {
                    updateChildField(child.id, { nickname: event.target.value });
                  }}
                  type="text"
                  value={child.nickname}
                />
              </label>
              <label>
                <span>
                  <BilingualCopy messageKey="childAgeBand" />
                </span>
                <select
                  onChange={(event) => {
                    updateChildField(child.id, {
                      age_band: event.target.value as AgeBand
                    });
                  }}
                  value={child.age_band}
                >
                  {ageBandOptions.map((ageBand) => (
                    <option key={ageBand} value={ageBand}>
                      {ageBand}
                    </option>
                  ))}
                </select>
              </label>
              <div className="buttonRow">
                <button type="submit">
                  <BilingualCopy messageKey="updateChild" />
                </button>
                <button
                  className="secondaryAction dangerText"
                  onClick={() => void deleteChild(child.id)}
                  type="button"
                >
                  <BilingualCopy messageKey="deleteChild" />
                </button>
              </div>
            </form>
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
      </div>

      <div className="dangerZone">
        <p>
          <BilingualCopy messageKey="settingsDeleteHelp" />
        </p>
        <button
          className="dangerButton"
          onClick={() => void deleteAccount()}
          type="button"
        >
          <BilingualCopy messageKey="deleteAccount" />
        </button>
      </div>

      {statusKey !== null ? (
        <p className="formMessage" role="status">
          {t("zh", statusKey)} / {t("en", statusKey)}
        </p>
      ) : null}
    </section>
  );
}
