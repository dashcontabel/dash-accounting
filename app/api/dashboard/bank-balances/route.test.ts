/** @vitest-environment node */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

vi.mock("@/lib/auth", () => ({ getUserFromRequest: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    company: { findMany: vi.fn() },
    dashboardMonthlySummary: { findMany: vi.fn() },
    accountMapping: { findMany: vi.fn() },
    importBatch: { findMany: vi.fn() },
  },
}));

function request(companyId = "c1", endMonth = "2026-07") {
  return new NextRequest(
    `http://localhost/api/dashboard/bank-balances?companyId=${companyId}&endMonth=${endMonth}`,
  );
}

describe("GET /api/dashboard/bank-balances", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when the request is not authenticated", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    vi.mocked(getUserFromRequest).mockResolvedValue(null as never);

    expect((await GET(request())).status).toBe(401);
  });

  it("returns 403 when the user cannot access the requested company", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1", role: "CLIENT" } as never);
    vi.mocked(prisma.company.findMany).mockResolvedValue([] as never);

    expect((await GET(request("restricted"))).status).toBe(403);
  });

  it("uses the last accounted month at or before the requested period end", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1", role: "ADMIN" } as never);
    vi.mocked(prisma.company.findMany).mockResolvedValue([{ id: "c1", name: "Empresa 1" }] as never);
    vi.mocked(prisma.dashboardMonthlySummary.findMany).mockResolvedValue([
      { companyId: "c1", referenceMonth: "2026-07", dataJson: { FATURAMENTO: 900 } },
      { companyId: "c1", referenceMonth: "2026-06", dataJson: { SD_BANCARIO: 300 } },
      { companyId: "c1", referenceMonth: "2026-05", dataJson: { SD_BANCARIO: 250 } },
    ] as never);
    vi.mocked(prisma.accountMapping.findMany).mockResolvedValue([
      {
        dashboardField: "SD_BANCARIO",
        matchType: "PREFIX",
        codes: ["1.1.1"],
        valueColumn: "saldo_atual",
        aggregation: "SUM",
      },
    ] as never);
    vi.mocked(prisma.importBatch.findMany).mockResolvedValue([
      {
        companyId: "c1",
        referenceMonth: "2026-06",
        ledgerEntries: [
          {
            accountCode: "1.1.1.02.001",
            accountName: "Banco do Brasil",
            debit: 0,
            credit: 0,
            balance: 300,
            rawJson: null,
          },
        ],
      },
    ] as never);

    const response = await GET(request("c1", "2026-07"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.companies).toEqual([
      {
        companyId: "c1",
        companyName: "Empresa 1",
        referenceMonth: "2026-06",
        total: 300,
        accounts: [
          { accountCode: "1.1.1.02.001", accountName: "Banco do Brasil", balance: 300 },
        ],
      },
    ]);
    expect(prisma.importBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "DONE",
          OR: [{ companyId: "c1", referenceMonth: "2026-06" }],
        },
      }),
    );
  });
});
