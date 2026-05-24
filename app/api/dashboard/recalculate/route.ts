import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequest } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/company-access";
import { prisma } from "@/lib/prisma";
import { applyAccountMappings, mergeSummaries } from "@/lib/xlsx";

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

  // Find ALL DONE batches for this company+month (may be Balancete + Razão pair)
  const batches = await prisma.importBatch.findMany({
    where: { companyId, referenceMonth, status: "DONE" },
    orderBy: { createdAt: "asc" }, // oldest first → Balancete base, then Razão overlay
    select: { id: true, sourceType: true },
  });

  if (batches.length === 0) {
    return NextResponse.json(
      { error: "Nenhum balancete importado para este periodo." },
      { status: 404 },
    );
  }

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

  let mergedSummary: Record<string, number> = {};
  let totalMappedAccounts = 0;

  for (const batch of batches) {
    const storedRows = await prisma.ledgerEntry.findMany({
      where: { importBatchId: batch.id },
      select: { accountCode: true, accountName: true, debit: true, credit: true, balance: true, rawJson: true },
    });

    if (storedRows.length === 0) continue;

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

    const engineResult = applyAccountMappings(parsedRows, mappings);
    mergedSummary = mergeSummaries(mergedSummary, engineResult.summary, batch.sourceType as "XLSX" | "RAZAO");
    totalMappedAccounts += engineResult.mappedAccountCodes.length;
  }

  if (Object.keys(mergedSummary).length === 0) {
    return NextResponse.json(
      { error: "Sem entradas armazenadas. Reimporte o balancete para habilitar o recalculo." },
      { status: 422 },
    );
  }

  await prisma.dashboardMonthlySummary.upsert({
    where: { companyId_referenceMonth: { companyId, referenceMonth } },
    create: { companyId, referenceMonth, dataJson: mergedSummary },
    update: { dataJson: mergedSummary },
  });

  return NextResponse.json({ summary: mergedSummary, mappedAccounts: totalMappedAccounts });
}
