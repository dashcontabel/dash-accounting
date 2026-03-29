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

vi.mock("@/lib/csv", () => ({
  parseLedgerCsvBuffer: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
    },
    importBatch: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ledgerEntry: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe("POST /api/imports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns idempotent true when checksum already exists", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "u1",
      role: "ADMIN",
    } as never);
    vi.mocked(prisma.importBatch.findUnique).mockResolvedValue({
      id: "b1",
      status: "SUCCESS",
      companyId: "c1",
      referenceMonth: "2026-02",
      checksum: "abc",
      createdAt: new Date(),
    } as never);

    const formData = new FormData();
    formData.append("companyId", "c1");
    formData.append("referenceMonth", "2026-02");
    formData.append("file", new File(["codigo;nome;debito;credito;saldo"], "x.csv"));

    const request = new NextRequest("http://localhost/api/imports", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.idempotent).toBe(true);
  });

  it("creates batch and ledger entries for new file", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { parseLedgerCsvBuffer } = await import("@/lib/csv");
    const { prisma } = await import("@/lib/prisma");

    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "u1",
      role: "ADMIN",
    } as never);
    vi.mocked(prisma.importBatch.findUnique)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({
        id: "b2",
        status: "SUCCESS",
        companyId: "c1",
        referenceMonth: "2026-02",
        checksum: "hash",
        totalRows: 1,
        processedRows: 1,
        totalsJson: { rows: 1 },
        createdAt: new Date(),
      } as never);
    vi.mocked(prisma.importBatch.create).mockResolvedValue({ id: "b2" } as never);
    vi.mocked(parseLedgerCsvBuffer).mockResolvedValue({
      entries: [
        {
          accountCode: "1",
          accountName: "Caixa",
          debit: 10,
          credit: 2,
          balance: 8,
          rawJson: {},
        },
      ],
      totals: { rows: 1, totalDebit: 10, totalCredit: 2 },
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: never) =>
      callback({
        ledgerEntry: { createMany: vi.fn() },
        importBatch: { update: vi.fn() },
      }),
    );

    const formData = new FormData();
    formData.append("companyId", "c1");
    formData.append("referenceMonth", "2026-02");
    formData.append("file", new File(["codigo;nome;debito;credito;saldo\n1;Caixa;10;2;8"], "x.csv"));

    const request = new NextRequest("http://localhost/api/imports", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.idempotent).toBe(false);
  });
});
