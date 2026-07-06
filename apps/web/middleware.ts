import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const authCookieName = "wonderloop-auth";
const onboardingCookieName = "wonderloop-onboarding";
const guardedPaths = ["/onboarding", "/today", "/calendar", "/questions", "/settings"];
const onboardingRequiredPaths = ["/today", "/calendar", "/questions", "/settings"];

function startsWithPath(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isGuarded = guardedPaths.some((path) => startsWithPath(pathname, path));
  const hasAuth = request.cookies.get(authCookieName)?.value === "1";
  const hasOnboarding = request.cookies.get(onboardingCookieName)?.value === "complete";

  if (pathname === "/login" && hasAuth) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = hasOnboarding ? "/today" : "/onboarding";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (isGuarded && !hasAuth) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  const needsOnboarding = onboardingRequiredPaths.some((path) =>
    startsWithPath(pathname, path)
  );

  if (hasAuth && needsOnboarding && !hasOnboarding) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/onboarding";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/onboarding/:path*",
    "/today/:path*",
    "/calendar/:path*",
    "/questions/:path*",
    "/settings/:path*"
  ]
};
