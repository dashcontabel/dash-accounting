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

vi.mock("@/lib/xlsx", () => ({
  parseXlsxBuffer: vi.fn(),
  applyAccountMappings: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    importBatch: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    accountMapping: { findMany: vi.fn() },
    dashboardMonthlySummary: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

describe("POST /api/imports/xlsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates batch and returns summary", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { parseXlsxBuffer, applyAccountMappings } = await import("@/lib/xlsx");
    const { prisma } = await import("@/lib/prisma");

    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1", role: "ADMIN" } as never);
    vi.mocked(prisma.importBatch.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.importBatch.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.importBatch.create).mockResolvedValue({ id: "b1" } as never);
    vi.mocked(prisma.accountMapping.findMany).mockResolvedValue([] as never);
    vi.mocked(parseXlsxBuffer).mockReturnValue({
      rows: [{ accountCode: "1.1.01.01", description: "Banco", values: { saldo_atual: 100, saldo_anterior: 0, debito: 0, credito: 0 } }],
      detectedColumns: { accountCodeIndex: 0, descriptionIndex: 1, valueColumnIndexes: { saldo_atual: 2 } },
    } as never);
    vi.mocked(applyAccountMappings).mockReturnValue({
      summary: { SD_BANCARIO: 100 },
      mappedAccountCodes: ["1.1.01.01"],
      unmappedAccounts: [],
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: never) =>
      callback({
        ledgerEntry: { deleteMany: vi.fn(), createMany: vi.fn() },
        dashboardMonthlySummary: { upsert: vi.fn() },
        unmappedAccount: { deleteMany: vi.fn(), createMany: vi.fn() },
        importBatch: { update: vi.fn() },
      }),
    );

    const formData = new FormData();
    formData.append("companyId", "c1");
    formData.append("referenceMonth", "2026-02");
    formData.append("file", new File(["dummy"], "balancete.xlsx"));

    const request = new NextRequest("http://localhost/api/imports/xlsx", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.batchId).toBe("b1");
    expect(body.summary).toEqual({ SD_BANCARIO: 100 });
  });
});
