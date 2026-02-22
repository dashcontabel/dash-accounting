import { NextRequest } from "next/server";

import { AUTH_COOKIE_NAME, verifyToken } from "./token";

function readCookieFromHeader(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [rawName, ...rawValue] = cookie.trim().split("=");
    if (rawName === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
}

export async function getUserFromRequest(request: NextRequest | Request) {
  const token =
    request instanceof NextRequest
      ? request.cookies.get(AUTH_COOKIE_NAME)?.value ?? null
      : readCookieFromHeader(request.headers.get("cookie"), AUTH_COOKIE_NAME);

  if (!token) {
    return null;
  }

  return verifyToken(token);
}
