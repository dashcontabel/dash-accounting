/** @vitest-environment node */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
  getUserFromRequest: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
    },
    company: {
      findMany: vi.fn(),
    },
    userCompany: {
      findMany: vi.fn(),
    },
  },
}));

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns admin companies and validates active company cookie", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");

    vi.mocked(getUserFromRequest).mockResolvedValue({
      sub: "admin-id",
      email: "admin@dashcontabil.com",
      role: "ADMIN",
    } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "admin-id",
      email: "admin@dashcontabil.com",
      name: null,
      role: "ADMIN",
      status: "ACTIVE",
    } as never);
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { id: "c1", name: "Empresa 1", groupId: "g1" },
      { id: "c2", name: "Empresa 2", groupId: "g1" },
    ] as never);

    const request = new NextRequest("http://localhost/api/auth/me", {
      headers: {
        cookie: "active_company_id=c2",
      },
    });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.allowedCompanies).toHaveLength(2);
    expect(body.activeCompanyId).toBe("c2");
  });

  it("returns only linked companies for client and reads active cookie", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");

    vi.mocked(getUserFromRequest).mockResolvedValue({
      sub: "client-id",
      email: "client@dashcontabil.com",
      role: "CLIENT",
    } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "client-id",
      email: "client@dashcontabil.com",
      name: null,
      role: "CLIENT",
      status: "ACTIVE",
    } as never);
    vi.mocked(prisma.userCompany.findMany).mockResolvedValue([
      { company: { id: "c1", name: "Empresa 1", groupId: "g1" } },
    ] as never);

    const request = new NextRequest("http://localhost/api/auth/me", {
      headers: {
        cookie: "active_company_id=c1",
      },
    });
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.allowedCompanies).toEqual([
      { id: "c1", name: "Empresa 1", groupId: "g1" },
    ]);
    expect(body.activeCompanyId).toBe("c1");
  });
});
