/** @vitest-environment node */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PATCH } from "./route";

vi.mock("@/lib/auth/admin-guard", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: { findFirst: vi.fn() },
    companySetting: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

describe("/api/admin/settings/tenant-display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns default tenant display settings when the company has no row", async () => {
    const { requireAdmin } = await import("@/lib/auth/admin-guard");
    const { prisma } = await import("@/lib/prisma");

    vi.mocked(requireAdmin).mockResolvedValue({
      admin: { id: "u1", email: "admin@test.com", role: "ADMIN" },
      errorResponse: null,
    });
    vi.mocked(prisma.company.findFirst).mockResolvedValue({ id: "c1" } as never);
    vi.mocked(prisma.companySetting.findUnique).mockResolvedValue(null as never);

    const request = new NextRequest("http://localhost/api/admin/settings/tenant-display?companyId=c1");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.settings).toEqual({ mode: "ALL", visibleTenantKeys: [] });
  });

  it("saves selected tenant display settings", async () => {
    const { requireAdmin } = await import("@/lib/auth/admin-guard");
    const { writeAuditLog } = await import("@/lib/audit");
    const { prisma } = await import("@/lib/prisma");

    vi.mocked(requireAdmin).mockResolvedValue({
      admin: { id: "u1", email: "admin@test.com", role: "ADMIN" },
      errorResponse: null,
    });
    vi.mocked(prisma.company.findFirst).mockResolvedValue({ id: "c1" } as never);
    vi.mocked(prisma.companySetting.upsert).mockResolvedValue({} as never);

    const request = new NextRequest("http://localhost/api/admin/settings/tenant-display", {
      method: "PATCH",
      body: JSON.stringify({
        companyId: "c1",
        mode: "SELECTED",
        visibleTenantKeys: ["THAIS PSICÓLOGA", "agil"],
      }),
    });

    const response = await PATCH(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.settings).toEqual({
      mode: "SELECTED",
      visibleTenantKeys: ["agil", "thaispsicologa"],
    });
    expect(prisma.companySetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          companyId: "c1",
          key: "dashboard.tenants.display",
          value: { mode: "SELECTED", visibleTenantKeys: ["agil", "thaispsicologa"] },
        }),
        update: {
          value: { mode: "SELECTED", visibleTenantKeys: ["agil", "thaispsicologa"] },
        },
      }),
    );
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ companyId: "c1" }));
  });
});
