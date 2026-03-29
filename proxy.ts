import { jwtVerify, JWTPayload } from "jose";
import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "dash_contabil_session";

type SessionPayload = JWTPayload & {
  sub: string;
  email: string;
  role: "ADMIN" | "CLIENT";
};

async function getSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "");
    const { payload } = await jwtVerify<SessionPayload>(token, secret, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch {
    return null;
  }
}

export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Health check — confirms proxy is running
  if (pathname === "/_proxy-check") {
    return NextResponse.json({ ok: true, ts: Date.now(), region: process.env.VERCEL_REGION ?? "unknown" });
  }

  let session: SessionPayload | null = null;
  let sessionError: string | null = null;
  try {
    session = await getSession(request);
  } catch (err) {
    sessionError = err instanceof Error ? err.message : String(err);
  }

  const isAuthenticated = Boolean(session?.sub);
  const isProtectedPath = pathname === "/" || pathname.startsWith("/app");
  const isAdminPage = pathname.startsWith("/app/admin");

  console.log(
    `[proxy] ${request.method} ${pathname} | authenticated=${isAuthenticated} role=${session?.role ?? "none"} jwtSecret=${Boolean(process.env.JWT_SECRET)} hasCookie=${Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value)}${sessionError ? ` sessionError=${sessionError}` : ""}`
  );

  if (isProtectedPath && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    const nextPath = `${pathname}${search}`;
    loginUrl.searchParams.set("next", nextPath);
    console.log(`[proxy] -> redirect to /login (unauthenticated)`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && isAuthenticated) {
    console.log(`[proxy] -> redirect to / (already authenticated)`);
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isAdminPage && session?.role !== "ADMIN") {
    console.log(`[proxy] -> redirect to / (not admin)`);
    return NextResponse.redirect(new URL("/", request.url));
  }

  console.log(`[proxy] -> next()`);
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|public/).*)",
  ],
};
