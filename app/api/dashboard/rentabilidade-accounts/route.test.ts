/** @vitest-environment node */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
  getUserFromRequest: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    company: { findMany: vi.fn() },
    accountMapping: { findMany: vi.fn() },
    importBatch: { findMany: vi.fn() },
  },
}));

function request(companyId = "c1") {
  return new NextRequest(
    `http://localhost/api/dashboard/rentabilidade-accounts?companyId=${companyId}&year=2026&from=01&to=03`,
  );
}

describe("GET /api/dashboard/rentabilidade-accounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("returns account-level net yield using the authorized company data", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1", role: "ADMIN" } as never);
    vi.mocked(prisma.company.findMany).mockResolvedValue([{ id: "c1", name: "Empresa 1" }] as never);
    vi.mocked(prisma.accountMapping.findMany).mockResolvedValue([
      {
        dashboardField: "RENDIMENTO_BRUTO",
        matchType: "PREFIX",
        codes: ["4.1.3"],
        valueColumn: "credito",
        aggregation: "SUM",
      },
      {
        dashboardField: "IOF_IRRF",
        matchType: "LIST",
        codes: ["3.2.2.05.004"],
        valueColumn: "debito",
        aggregation: "ABS_SUM",
      },
    ] as never);
    vi.mocked(prisma.importBatch.findMany).mockResolvedValue([
      {
        companyId: "c1",
        referenceMonth: "2026-01",
        ledgerEntries: [
          {
            accountCode: "4.1.3.01",
            accountName: "Rendimentos",
            debit: 0,
            credit: 100,
            balance: 0,
            rawJson: null,
          },
          {
            accountCode: "3.2.2.05.004",
            accountName: "IRRF",
            debit: 15,
            credit: 0,
            balance: 0,
            rawJson: null,
          },
        ],
      },
    ] as never);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.companies).toEqual([
      {
        companyId: "c1",
        companyName: "Empresa 1",
        accounts: [
          expect.objectContaining({
            accountCode: "3.2.2.05.004",
            months: {
              "2026-01": { grossYield: 0, taxWithheld: 15, netYield: -15 },
            },
          }),
          expect.objectContaining({
            accountCode: "4.1.3.01",
            months: {
              "2026-01": { grossYield: 100, taxWithheld: 0, netYield: 100 },
            },
          }),
        ],
      },
    ]);
  });
});
