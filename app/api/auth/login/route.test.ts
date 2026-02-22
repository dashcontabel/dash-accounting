/** @vitest-environment node */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  AUTH_COOKIE_NAME: "dash_contabil_session",
  checkLoginRateLimit: vi.fn(() => ({ allowed: true, retryAfterSeconds: 0 })),
  clearLoginRateLimit: vi.fn(),
  signToken: vi.fn(async () => "signed-jwt"),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
    },
  },
}));

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 and sets auth cookie on valid credentials", async () => {
    const { prisma } = await import("@/lib/prisma");
    const bcrypt = await import("bcryptjs");
    const mockedFindFirst = vi.mocked(prisma.user.findFirst);
    const mockedCompare = vi.mocked(bcrypt.default.compare);

    mockedFindFirst.mockResolvedValue({
      id: "u1",
      email: "admin@dashcontabil.com",
      name: null,
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash: "hashed",
    } as never);
    mockedCompare.mockResolvedValue(true as never);

    const request = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@dashcontabil.com",
        password: "change-this-password",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.user.email).toBe("admin@dashcontabil.com");
    expect(response.headers.get("set-cookie")).toContain("dash_contabil_session=");
  });

  it("returns 401 for invalid credentials", async () => {
    const { prisma } = await import("@/lib/prisma");
    const mockedFindFirst = vi.mocked(prisma.user.findFirst);
    mockedFindFirst.mockResolvedValue(null as never);

    const request = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@dashcontabil.com",
        password: "wrong-password",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Email ou senha inválidos.");
  });
});
