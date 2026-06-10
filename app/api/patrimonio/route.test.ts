/** @vitest-environment node */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { GET, POST } from "./route";

vi.mock("@/lib/auth/request", () => ({
  getUserFromRequest: vi.fn(),
}));

vi.mock("@/lib/auth/admin-guard", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  AuditAction: {
    PATRIMONIO_CREATE: "PATRIMONIO_CREATE",
  },
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    userCompany: { findMany: vi.fn() },
    group: { findUnique: vi.fn() },
    patrimonioAsset: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe("GET /api/patrimonio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("groups assets by sections and appends calculated total instead of persisted total", async () => {
    const { getUserFromRequest } = await import("@/lib/auth/request");
    const { prisma } = await import("@/lib/prisma");

    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1", role: "ADMIN" } as never);
    vi.mocked(prisma.patrimonioAsset.findMany).mockResolvedValue([
      {
        id: "s1",
        groupId: "g1",
        sectionId: null,
        referenceMonth: "2026-01",
        label: "Ativos Financeiros",
        sublabel: null,
        rowType: "SECTION",
        economico: null,
        financeiro: null,
        sortOrder: 10,
        createdAt: new Date("2026-01-01"),
      },
      {
        id: "a1",
        groupId: "g1",
        sectionId: "s1",
        referenceMonth: "2026-01",
        label: "Aplicacao",
        sublabel: null,
        rowType: "ASSET",
        economico: "10",
        financeiro: "5",
        sortOrder: 20,
        createdAt: new Date("2026-01-02"),
      },
      {
        id: "manual-total",
        groupId: "g1",
        sectionId: null,
        referenceMonth: "2026-01",
        label: "Total do Patrimonio",
        sublabel: null,
        rowType: "TOTAL",
        economico: "999",
        financeiro: "999",
        sortOrder: 999,
        createdAt: new Date("2026-01-03"),
      },
      {
        id: "legacy-produced",
        groupId: "g1",
        sectionId: null,
        referenceMonth: "2026-01",
        label: "Patrimonio Produzido",
        sublabel: null,
        rowType: "SUBTOTAL",
        economico: "100",
        financeiro: null,
        sortOrder: 30,
        createdAt: new Date("2026-01-04"),
      },
      {
        id: "a2",
        groupId: "g1",
        sectionId: null,
        referenceMonth: "2026-01",
        label: "A Receber",
        sublabel: null,
        rowType: "ASSET",
        economico: "2",
        financeiro: null,
        sortOrder: 40,
        createdAt: new Date("2026-01-05"),
      },
    ] as never);

    const request = new NextRequest("http://localhost/api/patrimonio?groupId=g1&month=2026-01");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.assets.map((row: { id: string }) => row.id)).toEqual([
      "s1",
      "a1",
      "legacy-produced",
      "a2",
      "__total__",
    ]);
    expect(body.assets[2]).toMatchObject({ rowType: "SUBTOTAL", economico: 10, financeiro: 5 });
    expect(body.assets.at(-1)).toMatchObject({
      rowType: "TOTAL",
      economico: 12,
      financeiro: 5,
    });
  });
});

describe("POST /api/patrimonio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new section and links the new asset to it", async () => {
    const { requireAdmin } = await import("@/lib/auth/admin-guard");
    const { prisma } = await import("@/lib/prisma");

    vi.mocked(requireAdmin).mockResolvedValue({
      admin: { id: "admin-id", email: "admin@test.com", role: "ADMIN" },
      errorResponse: null,
    } as never);
    vi.mocked(prisma.group.findUnique).mockResolvedValue({ id: "g1" } as never);
    (prisma.$transaction as unknown as Mock).mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        patrimonioAsset: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ sortOrder: 100 }),
          create: vi
            .fn()
            .mockResolvedValueOnce({ id: "s2" })
            .mockResolvedValueOnce({
              id: "a2",
              groupId: "g1",
              sectionId: "s2",
              referenceMonth: "2026-02",
              label: "Cotas",
            }),
        },
      }),
    );

    const request = new NextRequest("http://localhost/api/patrimonio", {
      method: "POST",
      body: JSON.stringify({
        groupId: "g1",
        referenceMonth: "2026-02",
        label: "Cotas PETRA",
        rowType: "ASSET",
        newSectionName: "Cotas Patrimoniais",
        economico: 10,
        financeiro: 5,
        sortOrder: 20,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.asset.sectionId).toBe("s2");
  });
});
