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
    razaoEntry: { findMany: vi.fn() },
    companySetting: { findUnique: vi.fn() },
  },
}));

function razaoEntry(overrides: Record<string, unknown>) {
  return {
    referenceMonth: "2026-04",
    entryDate: new Date("2026-04-10"),
    accountCode: "1.1.30.001",
    accountName: "Agil",
    costCenter: "Placa - ADM",
    lot: "1900",
    description: "VR REF A ALUGUEL AGIL",
    debit: 0,
    credit: 0,
    ...overrides,
  };
}

describe("GET /api/dashboard/tenants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tenant payment status calculated from Razao receivable entries", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");

    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1", role: "ADMIN" } as never);
    vi.mocked(prisma.companySetting.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.razaoEntry.findMany).mockResolvedValue([
      razaoEntry({ lot: "p1", debit: 1000 }),
      razaoEntry({
        lot: "p1",
        accountCode: "4.1.10.200.3",
        accountName: "LOCACAO DE IMOVEIS",
        credit: 1000,
      }),
      razaoEntry({
        lot: "b1",
        entryDate: new Date("2026-04-20"),
        credit: 400,
      }),
      razaoEntry({
        lot: "b1",
        entryDate: new Date("2026-04-20"),
        accountCode: "1.1.10.200.2",
        accountName: "BANCO DO BRASIL",
        debit: 400,
      }),
    ] as never);

    const request = new NextRequest("http://localhost/api/dashboard/tenants?companyId=c1&year=2026");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.hasTenantData).toBe(true);
    expect(body.hasTenantPaymentData).toBe(true);
    expect(body.paymentCostCenters).toEqual(["Placa - ADM"]);
    expect(body.paymentCompetencies).toEqual(["2026-04"]);
    expect(body.items).toEqual([
      expect.objectContaining({
        key: "agil",
        description: "AGIL",
        payment: expect.objectContaining({
          provisioned: 1000,
          paid: 400,
          openBalance: 600,
          status: "PARTIAL",
          monthly: [
            expect.objectContaining({
              referenceMonth: "2026-04",
              costCenter: "Placa - ADM",
              provisioned: 1000,
              paid: 400,
              openBalance: 600,
              status: "PARTIAL",
            }),
          ],
        }),
      }),
    ]);
  });

  it("returns an empty payload when the company has no Razao entries for the year", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");

    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1", role: "ADMIN" } as never);
    vi.mocked(prisma.companySetting.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.razaoEntry.findMany).mockResolvedValue([] as never);

    const request = new NextRequest("http://localhost/api/dashboard/tenants?companyId=c1&year=2026");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      hasTenantData: false,
      hasTenantPaymentData: false,
      year: "2026",
      companyId: "c1",
      totalMonths: 0,
      costCenters: [],
      paymentCostCenters: [],
      paymentCompetencies: [],
      items: [],
    });
  });

  it("filters tenant cards by company display settings", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");

    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1", role: "CLIENT" } as never);
    vi.mocked(prisma.companySetting.findUnique).mockResolvedValue({
      value: { mode: "SELECTED", visibleTenantKeys: ["barbaralima"] },
    } as never);
    vi.mocked(prisma.razaoEntry.findMany).mockResolvedValue([
      razaoEntry({
        accountCode: "4.1.10.200.3",
        accountName: "LOCACAO DE IMOVEIS",
        description: "VR REF A ALUGUEL AGIL",
        credit: 1000,
      }),
      razaoEntry({
        accountCode: "4.1.10.200.3",
        accountName: "LOCACAO DE IMOVEIS",
        description: "VR REF A ALUGUEL BARBARA LIMA",
        credit: 800,
      }),
    ] as never);

    const request = new NextRequest("http://localhost/api/dashboard/tenants?companyId=c1&year=2026");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toEqual(expect.objectContaining({ key: "barbaralima", description: "BARBARA LIMA" }));
  });
});
