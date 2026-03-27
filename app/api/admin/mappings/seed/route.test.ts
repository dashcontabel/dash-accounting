/** @vitest-environment node */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

vi.mock("@/lib/auth/admin-guard", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

describe("POST /api/admin/mappings/seed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not admin", async () => {
    const { requireAdmin } = await import("@/lib/auth/admin-guard");
    vi.mocked(requireAdmin).mockResolvedValue({
      admin: null,
      errorResponse: new Response(JSON.stringify({ error: "Nao autenticado." }), { status: 401 }),
    } as never);

    const request = new NextRequest("http://localhost/api/admin/mappings/seed", { method: "POST" });
    const response = await POST(request);
    expect(response?.status).toBe(401);
  });

  it("creates default mappings for admin", async () => {
    const { requireAdmin } = await import("@/lib/auth/admin-guard");
    const { prisma } = await import("@/lib/prisma");

    vi.mocked(requireAdmin).mockResolvedValue({
      admin: { id: "u1", email: "admin@x.com", role: "ADMIN" },
      errorResponse: null,
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: never) =>
      callback({
        accountMapping: {
          deleteMany: vi.fn(),
          createMany: vi.fn(),
        },
      }),
    );

    const request = new NextRequest("http://localhost/api/admin/mappings/seed", { method: "POST" });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.count).toBeGreaterThan(0);
  });
});
