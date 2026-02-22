/** @vitest-environment node */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdmin } from "./admin-guard";

vi.mock("./request", () => ({
  getUserFromRequest: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
    },
  },
}));

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when user is not admin", async () => {
    const { getUserFromRequest } = await import("./request");
    const { prisma } = await import("@/lib/prisma");

    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "u1",
      email: "client@x.com",
      role: "CLIENT",
    } as never);

    const result = await requireAdmin(new NextRequest("http://localhost/api/admin/users"));
    expect(result.admin).toBeNull();
    expect(result.errorResponse?.status).toBe(403);
  });

  it("returns admin identity when role is ADMIN", async () => {
    const { getUserFromRequest } = await import("./request");
    const { prisma } = await import("@/lib/prisma");

    vi.mocked(getUserFromRequest).mockResolvedValue({ sub: "u1" } as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "u1",
      email: "admin@x.com",
      role: "ADMIN",
    } as never);

    const result = await requireAdmin(new NextRequest("http://localhost/api/admin/users"));
    expect(result.errorResponse).toBeNull();
    expect(result.admin?.id).toBe("u1");
  });
});
