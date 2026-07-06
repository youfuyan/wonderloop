"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { t } from "@wonderloop/core";
import type { MessageKey } from "@wonderloop/core";

import { BilingualCopy } from "../auth/bilingual-copy";
import {
  getBrowserSupabase,
  hasCompletedOnboarding,
  markAuthenticated
} from "../auth/session";

type LoginState = "idle" | "submitting" | "sent" | "redirecting" | "error";

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

    function routeAfterSignIn(userId: string) {
      if (hasCompletedOnboarding(userId)) {
        router.replace(nextPath);
        return;
      }

      router.replace("/onboarding");
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session === null) {
        return;
      }

      markAuthenticated(data.session.expires_at);
      setLoginState("redirecting");
      routeAfterSignIn(data.session.user.id);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session === null) {
        return;
      }

      markAuthenticated(session.expires_at);
      setLoginState("redirecting");
      routeAfterSignIn(session.user.id);
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
