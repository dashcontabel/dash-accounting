/** @vitest-environment node */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE } from "./route";

vi.mock("@/lib/auth", () => ({
  getUserFromRequest: vi.fn(),
}));

vi.mock("@/lib/company-access", () => ({
  assertCompanyAccess: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(),
  AuditAction: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    importBatch: {
      findUnique: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    dashboardMonthlySummary: { deleteMany: vi.fn() },
    company: { update: vi.fn() },
  },
}));

// ── helpers ───────────────────────────────────────────────────────────────────

function makeRequest(id: string) {
  return new NextRequest(`http://localhost/api/imports/${id}`, { method: "DELETE" });
}

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DELETE /api/imports/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    vi.mocked(getUserFromRequest).mockResolvedValue(null as never);

    const res = await DELETE(makeRequest("b1"), makeContext("b1"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when user not found in db", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null as never);

    const res = await DELETE(makeRequest("b1"), makeContext("b1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user role is CLIENT", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1", role: "CLIENT" } as never);

    const res = await DELETE(makeRequest("b1"), makeContext("b1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when batch does not exist", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1", role: "ADMIN" } as never);
    vi.mocked(prisma.importBatch.findUnique).mockResolvedValue(null as never);

    const res = await DELETE(makeRequest("nonexistent"), makeContext("nonexistent"));
    expect(res.status).toBe(404);
  });

  it("returns 403 when admin does not have access to the batch's company", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { assertCompanyAccess } = await import("@/lib/company-access");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1", role: "ADMIN" } as never);
    vi.mocked(prisma.importBatch.findUnique).mockResolvedValue({
      id: "b1",
      companyId: "c-other",
      referenceMonth: "2026-03",
    } as never);
    vi.mocked(assertCompanyAccess).mockRejectedValue(new Error("Access denied"));

    const res = await DELETE(makeRequest("b1"), makeContext("b1"));
    expect(res.status).toBe(403);
  });

  it("deletes batch and bumps Company.updatedAt", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { assertCompanyAccess } = await import("@/lib/company-access");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1", role: "ADMIN" } as never);
    vi.mocked(prisma.importBatch.findUnique).mockResolvedValue({
      id: "b1",
      companyId: "c1",
      referenceMonth: "2026-03",
    } as never);
    vi.mocked(assertCompanyAccess).mockResolvedValue(undefined as never);
    vi.mocked(prisma.importBatch.delete).mockResolvedValue({} as never);
    // No remaining batches for the month
    vi.mocked(prisma.importBatch.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.dashboardMonthlySummary.deleteMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.company.update).mockResolvedValue({} as never);

    const res = await DELETE(makeRequest("b1"), makeContext("b1"));

    expect(res.status).toBe(204);
    expect(prisma.importBatch.delete).toHaveBeenCalledWith({ where: { id: "b1" } });
    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { updatedAt: expect.any(Date) },
    });
  });

  it("removes DashboardMonthlySummary when it is the last batch for that month", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { assertCompanyAccess } = await import("@/lib/company-access");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1", role: "ADMIN" } as never);
    vi.mocked(prisma.importBatch.findUnique).mockResolvedValue({
      id: "b1",
      companyId: "c1",
      referenceMonth: "2026-03",
    } as never);
    vi.mocked(assertCompanyAccess).mockResolvedValue(undefined as never);
    vi.mocked(prisma.importBatch.delete).mockResolvedValue({} as never);
    vi.mocked(prisma.importBatch.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.dashboardMonthlySummary.deleteMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.company.update).mockResolvedValue({} as never);

    await DELETE(makeRequest("b1"), makeContext("b1"));

    expect(prisma.dashboardMonthlySummary.deleteMany).toHaveBeenCalledWith({
      where: { companyId: "c1", referenceMonth: "2026-03" },
    });
  });

  it("keeps DashboardMonthlySummary when other batches exist for the same month", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { assertCompanyAccess } = await import("@/lib/company-access");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1", role: "ADMIN" } as never);
    vi.mocked(prisma.importBatch.findUnique).mockResolvedValue({
      id: "b1",
      companyId: "c1",
      referenceMonth: "2026-03",
    } as never);
    vi.mocked(assertCompanyAccess).mockResolvedValue(undefined as never);
    vi.mocked(prisma.importBatch.delete).mockResolvedValue({} as never);
    // There is still another batch for this month
    vi.mocked(prisma.importBatch.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.company.update).mockResolvedValue({} as never);

    await DELETE(makeRequest("b1"), makeContext("b1"));

    expect(prisma.dashboardMonthlySummary.deleteMany).not.toHaveBeenCalled();
  });

  it("always bumps Company.updatedAt regardless of summary deletion", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { assertCompanyAccess } = await import("@/lib/company-access");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1", role: "ADMIN" } as never);
    vi.mocked(prisma.importBatch.findUnique).mockResolvedValue({
      id: "b2",
      companyId: "c2",
      referenceMonth: "2026-01",
    } as never);
    vi.mocked(assertCompanyAccess).mockResolvedValue(undefined as never);
    vi.mocked(prisma.importBatch.delete).mockResolvedValue({} as never);
    // Other batch still exists — summary is kept
    vi.mocked(prisma.importBatch.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.company.update).mockResolvedValue({} as never);

    await DELETE(makeRequest("b2"), makeContext("b2"));

    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: "c2" },
      data: { updatedAt: expect.any(Date) },
    });
  });
});
