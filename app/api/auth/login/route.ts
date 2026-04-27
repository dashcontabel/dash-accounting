import bcrypt from "bcryptjs";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  checkLoginRateLimit,
  clearLoginRateLimit,
  signToken,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuditAction, writeAuditLog } from "@/lib/audit";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
});

function getRateLimitKey(request: NextRequest, email?: string) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";
  return `${ip}:${email ?? "unknown"}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsedBody = loginSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Dados de login inválidos." },
        { status: 400 },
      );
    }

    const rateLimitKey = getRateLimitKey(request, parsedBody.data.email);
    const rateLimit = checkLoginRateLimit(rateLimitKey);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em instantes." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        email: parsedBody.data.email,
        status: "ACTIVE",
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Email ou senha inválidos." },
        { status: 401 },
      );
    }

    const passwordMatches = await bcrypt.compare(
      parsedBody.data.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      return NextResponse.json(
        { error: "Email ou senha inválidos." },
        { status: 401 },
      );
    }

    clearLoginRateLimit(rateLimitKey);

    const token = await signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      },
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    writeAuditLog({
      userId: user.id,
      action: AuditAction.LOGIN,
      entity: "User",
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
    });

    return response;
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json(
      { error: "Não foi possível realizar login." },
      { status: 500 },
    );
  }
}
