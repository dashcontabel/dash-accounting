/** @vitest-environment node */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { POST } from "./route";

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
    group: { findFirst: vi.fn() },
    patrimonioAsset: {
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe("POST /api/patrimonio/copy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks copy when target month already has patrimonio data", async () => {
    const { requireAdmin } = await import("@/lib/auth/admin-guard");
    const { prisma } = await import("@/lib/prisma");

    vi.mocked(requireAdmin).mockResolvedValue({
      admin: { id: "admin-id", email: "admin@test.com", role: "ADMIN" },
      errorResponse: null,
    } as never);
    vi.mocked(prisma.group.findFirst).mockResolvedValue({ id: "g1" } as never);
    (prisma.$transaction as unknown as Mock).mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        patrimonioAsset: {
          count: vi.fn().mockResolvedValue(1),
        },
      }),
    );

    const request = new NextRequest("http://localhost/api/patrimonio/copy", {
      method: "POST",
      body: JSON.stringify({
        groupId: "g1",
        sourceMonth: "2025-12",
        targetMonth: "2026-01",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("Ja existe patrimonio cadastrado");
  });

  it("copies sections and assets to an empty target month", async () => {
    const { requireAdmin } = await import("@/lib/auth/admin-guard");
    const { prisma } = await import("@/lib/prisma");
    const create = vi
      .fn()
      .mockResolvedValueOnce({ id: "new-section" })
      .mockResolvedValueOnce({ id: "new-produced-section" })
      .mockResolvedValueOnce({ id: "new-asset" })
      .mockResolvedValueOnce({ id: "new-produced-asset" });

    vi.mocked(requireAdmin).mockResolvedValue({
      admin: { id: "admin-id", email: "admin@test.com", role: "ADMIN" },
      errorResponse: null,
    } as never);
    vi.mocked(prisma.group.findFirst).mockResolvedValue({ id: "g1" } as never);
    (prisma.$transaction as unknown as Mock).mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        patrimonioAsset: {
          count: vi.fn().mockResolvedValue(0),
          findMany: vi.fn().mockResolvedValue([
            {
              id: "s1",
              sectionId: null,
              label: "Ativos Financeiros",
              sublabel: null,
              rowType: "SECTION",
              economico: null,
              financeiro: null,
              sortOrder: 10,
            },
            {
              id: "a1",
              sectionId: "s1",
              label: "Aplicacao",
              sublabel: null,
              rowType: "ASSET",
              economico: "10",
              financeiro: "5",
              sortOrder: 20,
            },
            {
              id: "legacy-produced",
              sectionId: null,
              label: "Patrimonio Produzido",
              sublabel: null,
              rowType: "SUBTOTAL",
              economico: "100",
              financeiro: null,
              sortOrder: 30,
            },
            {
              id: "a2",
              sectionId: null,
              label: "A Receber",
              sublabel: null,
              rowType: "ASSET",
              economico: "2",
              financeiro: null,
              sortOrder: 40,
            },
          ]),
          create,
        },
      }),
    );

    const request = new NextRequest("http://localhost/api/patrimonio/copy", {
      method: "POST",
      body: JSON.stringify({
        groupId: "g1",
        sourceMonth: "2025-12",
        targetMonth: "2026-01",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({ copied: true, sectionsCopied: 2, assetsCopied: 2 });
    expect(create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          rowType: "SUBTOTAL",
          economico: "100",
        }),
      }),
    );
    expect(create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sectionId: "new-produced-section",
          referenceMonth: "2026-01",
        }),
      }),
    );
  });
});
