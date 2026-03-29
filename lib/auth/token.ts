import { JWTPayload, SignJWT, jwtVerify } from "jose";

type Role = "ADMIN" | "CLIENT";

export const AUTH_COOKIE_NAME = "dash_contabil_session";
const TOKEN_EXPIRATION = "7d";

export type SessionPayload = JWTPayload & {
  sub: string;
  email: string;
  role: Role;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not set.");
  }

  return new TextEncoder().encode(secret);
}

export async function signToken(payload: {
  sub: string;
  email: string;
  role: Role;
}) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRATION)
    .sign(getJwtSecret());
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, getJwtSecret(), {
      algorithms: ["HS256"],
    });
    return payload;
  } catch {
    return null;
  }
}
