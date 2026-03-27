import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin-guard";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const MAPPING_SELECT = {
  id: true,
  dashboardField: true,
  matchType: true,
  codes: true,
  valueColumn: true,
  aggregation: true,
  isCalculated: true,
  formula: true,
} as const;

const patchMappingSchema = z.object({
  matchType: z.enum(["EXACT", "PREFIX", "LIST"]).optional(),
  codes: z.array(z.string().trim().min(1)).optional(),
  valueColumn: z.enum(["saldo_atual", "debito", "credito", "saldo_anterior"]).optional(),
  aggregation: z.enum(["SUM", "ABS_SUM"]).optional(),
  isCalculated: z.boolean().optional(),
  formula: z.string().trim().min(1).max(500).nullable().optional(),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { admin, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;
  if (!admin) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;

  const existing = await prisma.accountMapping.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Mapeamento nao encontrado." }, { status: 404 });
  }

  const body = await request.json();
  const parsed = patchMappingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
  }

  const mapping = await prisma.accountMapping.update({
    where: { id },
    data: parsed.data,
    select: MAPPING_SELECT,
  });

  return NextResponse.json({ mapping });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { admin, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;
  if (!admin) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;

  const existing = await prisma.accountMapping.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Mapeamento nao encontrado." }, { status: 404 });
  }

  await prisma.accountMapping.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
