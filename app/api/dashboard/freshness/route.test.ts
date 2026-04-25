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
  },
}));

// ── helpers ───────────────────────────────────────────────────────────────────

function makeRequest(companyIds: string[]) {
  const params = new URLSearchParams();
  for (const id of companyIds) params.append("companyId", id);
  return new NextRequest(`http://localhost/api/dashboard/freshness?${params.toString()}`);
}

const NOW = new Date("2026-04-25T10:00:00.000Z");
const EARLIER = new Date("2026-04-25T09:00:00.000Z");

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/dashboard/freshness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    vi.mocked(getUserFromRequest).mockResolvedValue(null as never);

    const res = await GET(makeRequest(["c1"]));
    expect(res.status).toBe(401);
  });

  it("returns 401 when user not found in db", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null as never);

    const res = await GET(makeRequest(["c1"]));
    expect(res.status).toBe(401);
  });

  it("returns 400 when no companyId is provided", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1", role: "ADMIN" } as never);

    const res = await GET(new NextRequest("http://localhost/api/dashboard/freshness"));
    expect(res.status).toBe(400);
  });

  it("returns 403 when user does not have access to a requested company", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1", role: "CLIENT" } as never);
    // Access check returns fewer companies than requested
    vi.mocked(prisma.company.findMany).mockResolvedValueOnce([] as never);

    const res = await GET(makeRequest(["c-restricted"]));
    expect(res.status).toBe(403);
  });

  it("returns company updatedAt when there are no summaries", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1", role: "ADMIN" } as never);
    // Access check
    vi.mocked(prisma.company.findMany)
      .mockResolvedValueOnce([{ id: "c1" }] as never)
      // Data query
      .mockResolvedValueOnce([
        {
          id: "c1",
          updatedAt: NOW,
          dashboardMonthlySummaries: [],
          importBatches: [],
        },
      ] as never);

    const res = await GET(makeRequest(["c1"]));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.companies).toHaveLength(1);
    expect(body.companies[0].companyId).toBe("c1");
    expect(body.companies[0].updatedAt).toBe(NOW.toISOString());
    expect(body.companies[0].latestBatch).toBeNull();
  });

  it("returns summary updatedAt when it is newer than company updatedAt", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1", role: "ADMIN" } as never);
    vi.mocked(prisma.company.findMany)
      .mockResolvedValueOnce([{ id: "c1" }] as never)
      .mockResolvedValueOnce([
        {
          id: "c1",
          updatedAt: EARLIER,
          dashboardMonthlySummaries: [{ updatedAt: NOW }],
          importBatches: [],
        },
      ] as never);

    const res = await GET(makeRequest(["c1"]));
    const body = await res.json();

    expect(body.companies[0].updatedAt).toBe(NOW.toISOString());
  });

  it("returns company updatedAt when it is newer than all summaries", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1", role: "ADMIN" } as never);
    vi.mocked(prisma.company.findMany)
      .mockResolvedValueOnce([{ id: "c1" }] as never)
      .mockResolvedValueOnce([
        {
          id: "c1",
          updatedAt: NOW,
          dashboardMonthlySummaries: [{ updatedAt: EARLIER }],
          importBatches: [],
        },
      ] as never);

    const res = await GET(makeRequest(["c1"]));
    const body = await res.json();

    expect(body.companies[0].updatedAt).toBe(NOW.toISOString());
  });

  it("returns latestBatch when a DONE import exists", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1", role: "ADMIN" } as never);
    vi.mocked(prisma.company.findMany)
      .mockResolvedValueOnce([{ id: "c1" }] as never)
      .mockResolvedValueOnce([
        {
          id: "c1",
          updatedAt: EARLIER,
          dashboardMonthlySummaries: [],
          importBatches: [
            { referenceMonth: "2026-03", createdAt: NOW },
          ],
        },
      ] as never);

    const res = await GET(makeRequest(["c1"]));
    const body = await res.json();

    expect(body.companies[0].latestBatch).toEqual({
      referenceMonth: "2026-03",
      createdAt: NOW.toISOString(),
    });
  });

  it("returns correct Cache-Control header", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1", role: "ADMIN" } as never);
    vi.mocked(prisma.company.findMany)
      .mockResolvedValueOnce([{ id: "c1" }] as never)
      .mockResolvedValueOnce([
        { id: "c1", updatedAt: NOW, dashboardMonthlySummaries: [], importBatches: [] },
      ] as never);

    const res = await GET(makeRequest(["c1"]));
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=20, stale-while-revalidate=10");
  });

  it("handles multiple companies in a single request", async () => {
    const { getUserFromRequest } = await import("@/lib/auth");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u1", role: "ADMIN" } as never);
    vi.mocked(prisma.company.findMany)
      .mockResolvedValueOnce([{ id: "c1" }, { id: "c2" }] as never)
      .mockResolvedValueOnce([
        { id: "c1", updatedAt: EARLIER, dashboardMonthlySummaries: [], importBatches: [] },
        { id: "c2", updatedAt: NOW, dashboardMonthlySummaries: [], importBatches: [] },
      ] as never);

    const res = await GET(makeRequest(["c1", "c2"]));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.companies).toHaveLength(2);
  });
});
