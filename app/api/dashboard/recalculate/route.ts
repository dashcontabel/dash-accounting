import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequest } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/company-access";
import { prisma } from "@/lib/prisma";
import { applyAccountMappings } from "@/lib/xlsx";

const bodySchema = z.object({
  companyId: z.string().trim().min(1),
  referenceMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

export async function POST(request: NextRequest) {
  const session = await getUserFromRequest(request);
  if (!session?.sub) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const user = await prisma.user.findFirst({
    where: { id: session.sub, status: "ACTIVE" },
    select: { id: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
  }

  const { companyId, referenceMonth } = body.data;

  try {
    await assertCompanyAccess(user, companyId);
  } catch {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const batch = await prisma.importBatch.findFirst({
    where: { companyId, referenceMonth, status: "DONE" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!batch) {
    return NextResponse.json(
      { error: "Nenhum balancete importado para este periodo." },
      { status: 404 },
    );
  }

  const storedRows = await prisma.ledgerEntry.findMany({
    where: { importBatchId: batch.id },
    select: { accountCode: true, accountName: true, debit: true, credit: true, balance: true, rawJson: true },
  });

  if (storedRows.length === 0) {
    return NextResponse.json(
      { error: "Sem entradas armazenadas. Reimporte o balancete para habilitar o recalculo." },
      { status: 422 },
    );
  }

  const parsedRows = storedRows.map((r) => ({
    accountCode: r.accountCode,
    description: r.accountName,
    values: {
      debito: Number(r.debit),
      credito: Number(r.credit),
      saldo_atual: Number(r.balance),
      saldo_anterior:
        typeof r.rawJson === "object" && r.rawJson !== null
          ? ((r.rawJson as Record<string, unknown>).saldo_anterior as number ?? 0)
          : 0,
    },
  }));

  const mappings = await prisma.accountMapping.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, dashboardField: true, matchType: true, codes: true, valueColumn: true, aggregation: true, isCalculated: true, formula: true },
  });

  if (mappings.length === 0) {
    return NextResponse.json(
      { error: "Nenhum mapeamento configurado. Execute POST /api/admin/mappings/seed primeiro." },
      { status: 422 },
    );
  }

  const engineResult = applyAccountMappings(parsedRows, mappings);

  await prisma.dashboardMonthlySummary.upsert({
    where: { companyId_referenceMonth: { companyId, referenceMonth } },
    create: { companyId, referenceMonth, dataJson: engineResult.summary },
    update: { dataJson: engineResult.summary },
  });

  return NextResponse.json({ summary: engineResult.summary, mappedAccounts: engineResult.mappedAccountCodes.length });
}
