import { NextRequest, NextResponse } from "next/server";
import { AuditAction } from "@prisma/client";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin-guard";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  getTenantDisplaySettings,
  setTenantDisplaySettings,
} from "@/lib/settings/company-settings";

const querySchema = z.object({
  companyId: z.string().min(1),
});

const bodySchema = z.object({
  companyId: z.string().min(1),
  mode: z.enum(["ALL", "SELECTED"]),
  visibleTenantKeys: z.array(z.string().trim().min(1)).default([]),
});

async function ensureCompany(companyId: string) {
  return prisma.company.findFirst({
    where: {
      id: companyId,
      isActive: true,
      group: { isActive: true },
    },
    select: { id: true },
  });
}

export async function GET(request: NextRequest) {
  const { errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const parsed = querySchema.safeParse({
    companyId: request.nextUrl.searchParams.get("companyId") ?? "",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Parametros invalidos." }, { status: 400 });
  }

  const company = await ensureCompany(parsed.data.companyId);
  if (!company) {
    return NextResponse.json({ error: "Empresa invalida." }, { status: 404 });
  }

  const settings = await getTenantDisplaySettings(parsed.data.companyId);
  return NextResponse.json({ settings });
}

export async function PATCH(request: NextRequest) {
  const { admin, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
  }

  const company = await ensureCompany(parsed.data.companyId);
  if (!company) {
    return NextResponse.json({ error: "Empresa invalida." }, { status: 404 });
  }

  const settings = await setTenantDisplaySettings(parsed.data.companyId, {
    mode: parsed.data.mode,
    visibleTenantKeys: parsed.data.visibleTenantKeys,
  });

  writeAuditLog({
    userId: admin!.id,
    companyId: parsed.data.companyId,
    action: AuditAction.SETTING_UPDATE,
    entity: "CompanySetting",
    entityId: parsed.data.companyId,
    metadata: {
      key: "dashboard.tenants.display",
      mode: settings.mode,
      visibleTenantKeys: settings.visibleTenantKeys,
    },
  });

  return NextResponse.json({ settings });
}
