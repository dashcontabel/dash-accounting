/** @vitest-environment node */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

vi.mock("@/lib/auth/admin-guard", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    company: {
      count: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed"),
  },
}));

describe("admin users route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies access when not admin", async () => {
    const { requireAdmin } = await import("@/lib/auth/admin-guard");
    vi.mocked(requireAdmin).mockResolvedValue({
      admin: null,
      errorResponse: new Response(JSON.stringify({ error: "Acesso negado." }), {
        status: 403,
      }) as never,
    });

    const response = await GET(new NextRequest("http://localhost/api/admin/users"));
    expect(response.status).toBe(403);
  });

  it("creates client with company links", async () => {
    const { requireAdmin } = await import("@/lib/auth/admin-guard");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(requireAdmin).mockResolvedValue({
      admin: { id: "a1", email: "admin@x.com", role: "ADMIN" },
      errorResponse: null,
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.company.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "u1",
      email: "client@x.com",
      name: null,
      role: "CLIENT",
      status: "ACTIVE",
    } as never);

    const request = new NextRequest("http://localhost/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: "client@x.com",
        password: "12345678",
        role: "CLIENT",
        status: "ACTIVE",
        companyIds: ["c1"],
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });
});
