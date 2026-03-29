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
  const session = await getSession(request);
  const isAuthenticated = Boolean(session?.sub);
  const isProtectedPath = pathname === "/" || pathname.startsWith("/app");
  const isAdminPage = pathname.startsWith("/app/admin");

  if (isProtectedPath && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    const nextPath = `${pathname}${search}`;
    loginUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isAdminPage && session?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/app/:path*", "/login"],
};
