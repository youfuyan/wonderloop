"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { t } from "@wonderloop/core";
import type { MessageKey } from "@wonderloop/core";

import { BilingualCopy } from "../auth/bilingual-copy";
import {
  getBrowserSupabase,
  markAuthenticated,
  markOnboardingComplete,
  markOnboardingIncomplete
} from "../auth/session";

type LoginState = "idle" | "submitting" | "sent" | "redirecting" | "error";

const allowedNextPaths = new Set(["/today", "/calendar", "/questions", "/settings"]);

function safeNextPath(nextPath: string): string {
  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/today";
  }

  const pathname = nextPath.split(/[?#]/, 1)[0] ?? "/today";
  return allowedNextPaths.has(pathname) ? nextPath : "/today";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [loginState, setLoginState] = useState<LoginState>("idle");

  const supabase = useMemo(() => {
    try {
      return getBrowserSupabase();
    } catch {
      return null;
    }
  }, []);

  const nextPath = searchParams.get("next") ?? "/today";

  useEffect(() => {
    if (supabase === null) {
      setLoginState("error");
      return;
    }

    const client = supabase;

    async function routeAfterSignIn() {
      const { data, error } = await client
        .from("families")
        .select("onboarding_completed_at")
        .single();

      if (error === null && data.onboarding_completed_at !== null) {
        markOnboardingComplete();
        router.replace(safeNextPath(nextPath));
        return;
      }

      markOnboardingIncomplete();
      router.replace("/onboarding");
    }

    void client.auth.getSession().then(({ data }) => {
      if (data.session === null) {
        return;
      }

      markAuthenticated(data.session.expires_at);
      setLoginState("redirecting");
      void routeAfterSignIn();
    });

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((_event, session) => {
      if (session === null) {
        return;
      }

      markAuthenticated(session.expires_at);
      setLoginState("redirecting");
      void routeAfterSignIn();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [nextPath, router, supabase]);

  async function handleMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (supabase === null) {
      setLoginState("error");
      return;
    }

    setLoginState("submitting");
    const redirectTo = `${window.location.origin}/login?next=${encodeURIComponent(
      nextPath
    )}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectTo }
    });

    setLoginState(error === null ? "sent" : "error");
  }

  async function handleGoogleSignIn() {
    if (supabase === null) {
      setLoginState("error");
      return;
    }

    setLoginState("submitting");
    const redirectTo = `${window.location.origin}/login?next=${encodeURIComponent(
      nextPath
    )}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });

    if (error !== null) {
      setLoginState("error");
    }
  }

  const statusKey: MessageKey | null =
    loginState === "sent"
      ? "authCheckEmail"
      : loginState === "redirecting"
        ? "authRedirecting"
        : loginState === "error"
          ? "somethingWentWrong"
          : null;

  return (
    <section className="authPanel" aria-labelledby="login-title">
      <div className="authHeader">
        <h1 id="login-title">
          <BilingualCopy messageKey="authLoginTitle" />
        </h1>
        <p>
          <BilingualCopy messageKey="authLoginSubtitle" />
        </p>
      </div>

      <form className="authForm" onSubmit={(event) => void handleMagicLink(event)}>
        <label>
          <span>
            <BilingualCopy messageKey="authEmailLabel" />
          </span>
          <input
            autoComplete="email"
            inputMode="email"
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            placeholder={t("en", "authEmailPlaceholder")}
            required
            type="email"
            value={email}
          />
        </label>
        <button disabled={loginState === "submitting"} type="submit">
          <BilingualCopy messageKey="authMagicLinkButton" />
        </button>
      </form>

      <button
        className="secondaryAction"
        disabled={loginState === "submitting"}
        onClick={() => void handleGoogleSignIn()}
        type="button"
      >
        <BilingualCopy messageKey="authGoogleButton" />
      </button>

      {statusKey !== null ? (
        <p className="formMessage" role="status">
          {t("zh", statusKey)} / {t("en", statusKey)}
        </p>
      ) : null}
    </section>
  );
}
