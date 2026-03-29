import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await getUserFromRequest(request);
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
