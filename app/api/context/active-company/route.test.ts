/** @vitest-environment node */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getUserFromRequest: vi.fn(),
}));

vi.mock("@/lib/company-access", () => ({
  assertCompanyAccess: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
    },
  },
}));

describe("POST /api/context/active-company", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows ADMIN to set active company cookie", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");

    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "admin-id" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "admin-id",
      role: "ADMIN",
    } as never);

    const request = new NextRequest("http://localhost/api/context/active-company", {
      method: "POST",
      body: JSON.stringify({ companyId: "c1" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("active_company_id=c1");
  });

  it("allows CLIENT to set active company cookie when company is allowed", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");

    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "client-id" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "client-id",
      role: "CLIENT",
    } as never);

    const request = new NextRequest("http://localhost/api/context/active-company", {
      method: "POST",
      body: JSON.stringify({ companyId: "c1" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("active_company_id=c1");
  });
});
