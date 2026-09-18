/** @vitest-environment node */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
  getUserFromRequest: vi.fn(),
}));

vi.mock("@/lib/company-access", () => ({
  assertCompanyAccess: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    accountMapping: { findMany: vi.fn() },
    razaoEntry: { findMany: vi.fn(), count: vi.fn() },
  },
}));

describe("GET /api/dashboard/transactions", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getUserFromRequest } = await import("@/lib/auth");
    const { assertCompanyAccess } = await import("@/lib/company-access");
    const { prisma } = await import("@/lib/prisma");

    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "user-1" } as never);
    vi.mocked(assertCompanyAccess).mockResolvedValue(undefined);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "user-1", role: "CLIENT" } as never);
    vi.mocked(prisma.razaoEntry.findMany).mockResolvedValue([]);
    vi.mocked(prisma.razaoEntry.count).mockResolvedValue(0);
  });

  it("excludes specifically mapped expense accounts from the other-expenses detail", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.accountMapping.findMany).mockResolvedValue([
      { matchType: "PREFIX", codes: ["3.2.2.03"] },
      { matchType: "LIST", codes: ["3.2.2.05.004"] },
    ] as never);

    const request = new NextRequest(
      "http://localhost/api/dashboard/transactions"
      + "?companyId=company-1"
      + "&referenceMonth=2026-07"
      + "&accountCode=3"
      + "&excludeDashboardField=IMPOSTOS"
      + "&excludeDashboardField=IOF_IRRF",
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(prisma.accountMapping.findMany).toHaveBeenCalledWith({
      where: {
        dashboardField: { in: ["IMPOSTOS", "IOF_IRRF"] },
        isCalculated: false,
      },
      select: { matchType: true, codes: true },
    });
    const expectedWhere = {
      companyId: "company-1",
      referenceMonth: "2026-07",
      accountCode: { startsWith: "3" },
      NOT: {
        OR: [
          { accountCode: { startsWith: "3.2.2.03" } },
          { accountCode: { equals: "3.2.2.05.004" } },
        ],
      },
    };
    expect(prisma.razaoEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    );
    expect(prisma.razaoEntry.count).toHaveBeenCalledWith({ where: expectedWhere });
  });
});
