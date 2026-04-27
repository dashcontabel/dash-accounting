import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin-guard";
import { getAuditEnabled, setAuditEnabled } from "@/lib/system-config";

const OWNER_EMAIL = "owner@dashcontabil.com";

export async function GET(request: NextRequest) {
  const { admin, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  if (admin!.email !== OWNER_EMAIL) {
    return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });
  }

  const enabled = await getAuditEnabled();
  return NextResponse.json({ enabled });
}

const bodySchema = z.object({
  enabled: z.boolean(),
});

export async function PATCH(request: NextRequest) {
  const { admin, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  if (admin!.email !== OWNER_EMAIL) {
    return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Campo 'enabled' (boolean) é obrigatório." }, { status: 400 });
  }

  await setAuditEnabled(parsed.data.enabled);
  return NextResponse.json({ enabled: parsed.data.enabled });
}
