/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertCompanyAccess,
  getAllowedCompanyIds,
  type AuthUser,
} from "./company-access";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: {
      findMany: vi.fn(),
    },
    userCompany: {
      findMany: vi.fn(),
    },
  },
}));

describe("company access helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all active company ids for ADMIN", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { id: "c1" },
      { id: "c2" },
    ] as never);

    const ids = await getAllowedCompanyIds({
      id: "admin-id",
      role: "ADMIN",
    } as AuthUser);

    expect(ids).toEqual(["c1", "c2"]);
  });

  it("throws when company is not allowed", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.userCompany.findMany).mockResolvedValue([
      { companyId: "c1" },
    ] as never);

    await expect(
      assertCompanyAccess({ id: "client-id", role: "CLIENT" }, "c2"),
    ).rejects.toThrow("COMPANY_ACCESS_DENIED");
  });
});
