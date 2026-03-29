import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin-guard";
import { prisma } from "@/lib/prisma";

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

const createMappingSchema = z.object({
  dashboardField: z.string().trim().min(1).max(80).toUpperCase(),
  matchType: z.enum(["EXACT", "PREFIX", "LIST"]),
  codes: z.array(z.string().trim().min(1)).default([]),
  valueColumn: z.enum(["saldo_atual", "debito", "credito", "saldo_anterior"]),
  aggregation: z.enum(["SUM", "ABS_SUM"]),
  isCalculated: z.boolean().default(false),
  formula: z.string().trim().min(1).max(500).nullable().default(null),
});

export async function GET(request: NextRequest) {
  const { admin, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;
  if (!admin) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const mappings = await prisma.accountMapping.findMany({
    orderBy: { createdAt: "asc" },
    select: MAPPING_SELECT,
  });

  return NextResponse.json({ mappings });
}

export async function POST(request: NextRequest) {
  const { admin, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;
  if (!admin) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const body = await request.json();
  const parsed = createMappingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
  }

  const existing = await prisma.accountMapping.findFirst({
    where: { dashboardField: parsed.data.dashboardField },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Já existe um mapeamento com este campo." },
      { status: 409 },
    );
  }

  const mapping = await prisma.accountMapping.create({
    data: {
      dashboardField: parsed.data.dashboardField,
      matchType: parsed.data.matchType,
      codes: parsed.data.codes,
      valueColumn: parsed.data.valueColumn,
      aggregation: parsed.data.aggregation,
      isCalculated: parsed.data.isCalculated,
      formula: parsed.data.formula,
    },
    select: MAPPING_SELECT,
  });

  return NextResponse.json({ mapping }, { status: 201 });
}
