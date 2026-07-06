"use client";

import { createWonderLoopClient } from "@wonderloop/api-client";

export const authCookieName = "wonderloop-auth";
export const onboardingCookieName = "wonderloop-onboarding";

const oneYearSeconds = 60 * 60 * 24 * 365;

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie = `${name}=${value}; path=/; max-age=${String(
    maxAgeSeconds
  )}; SameSite=Lax`;
}

function expireCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

export function getBrowserSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl === undefined || supabaseAnonKey === undefined) {
    throw new Error("Missing public Supabase configuration.");
  }

  return createWonderLoopClient(supabaseUrl, supabaseAnonKey);
}

export function markAuthenticated(expiresAt?: number) {
  const maxAge =
    expiresAt === undefined
      ? oneYearSeconds
      : Math.max(60, expiresAt - Math.floor(Date.now() / 1000));

  setCookie(authCookieName, "1", maxAge);
}

export function markOnboardingComplete() {
  setCookie(onboardingCookieName, "complete", oneYearSeconds);
}

export function markOnboardingIncomplete() {
  expireCookie(onboardingCookieName);
}

export function clearAuthCookies() {
  expireCookie(authCookieName);
  expireCookie(onboardingCookieName);
}
