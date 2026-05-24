import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import { AuditAction, writeAuditLog } from "@/lib/audit";
import { assertCompanyAccess } from "@/lib/company-access";
import { prisma } from "@/lib/prisma";
import { applyAccountMappings, mergeSummaries } from "@/lib/xlsx";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getActiveUserFromSession(request: NextRequest) {
  const session = await getUserFromRequest(request);
  if (!session?.sub) return null;

  return prisma.user.findFirst({
    where: { id: session.sub, status: "ACTIVE" },
    select: { id: true, role: true },
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getActiveUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    const { id } = await context.params;
    const batch = await prisma.importBatch.findUnique({
      where: { id },
      select: {
        id: true,
        companyId: true,
        referenceMonth: true,
        sourceType: true,
        status: true,
        checksum: true,
        fileName: true,
        totalsJson: true,
        totalRows: true,
        processedRows: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!batch) {
      return NextResponse.json({ error: "Import nao encontrado." }, { status: 404 });
    }

    try {
      await assertCompanyAccess(user, batch.companyId);
    } catch {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const summary = await prisma.dashboardMonthlySummary.findUnique({
      where: {
        companyId_referenceMonth: {
          companyId: batch.companyId,
          referenceMonth: batch.referenceMonth,
        },
      },
      select: {
        id: true,
        dataJson: true,
        updatedAt: true,
      },
    });

    const unmappedAccounts = await prisma.unmappedAccount.findMany({
      where: { importBatchId: batch.id },
      orderBy: { accountCode: "asc" },
      take: 300,
      select: {
        accountCode: true,
        description: true,
      },
    });

    return NextResponse.json({
      batch,
      summary,
      unmappedAccounts,
    });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel carregar o import." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await getActiveUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Sem permissao para excluir importacoes." }, { status: 403 });
    }

    const { id } = await context.params;
    const batch = await prisma.importBatch.findUnique({
      where: { id },
      select: { id: true, companyId: true, referenceMonth: true },
    });

    if (!batch) {
      return NextResponse.json({ error: "Import nao encontrado." }, { status: 404 });
    }

    try {
      await assertCompanyAccess(user, batch.companyId);
    } catch {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    // Delete the batch — LedgerEntry and UnmappedAccount cascade automatically
    await prisma.importBatch.delete({ where: { id } });

    // After deletion: if another batch remains for this company+month, rebuild the
    // merged summary from its LedgerEntry rows (so balance-sheet fields from a
    // surviving Balancete, or P&L from a surviving Razão, are preserved correctly).
    const remainingBatches = await prisma.importBatch.findMany({
      where: { companyId: batch.companyId, referenceMonth: batch.referenceMonth, status: "DONE" },
      orderBy: { createdAt: "asc" },
      select: { id: true, sourceType: true },
    });

    if (remainingBatches.length === 0) {
      await prisma.dashboardMonthlySummary.deleteMany({
        where: { companyId: batch.companyId, referenceMonth: batch.referenceMonth },
      });
    } else {
      const mappings = await prisma.accountMapping.findMany({
        orderBy: { createdAt: "asc" },
        select: { id: true, dashboardField: true, matchType: true, codes: true, valueColumn: true, aggregation: true, isCalculated: true, formula: true },
      });

      let mergedSummary: Record<string, number> = {};
      for (const remaining of remainingBatches) {
        const storedRows = await prisma.ledgerEntry.findMany({
          where: { importBatchId: remaining.id },
          select: { accountCode: true, accountName: true, debit: true, credit: true, balance: true, rawJson: true },
        });
        if (storedRows.length > 0) {
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
          mergedSummary = mergeSummaries(mergedSummary, engineResult.summary, remaining.sourceType as "XLSX" | "RAZAO");
        }
      }

      await prisma.dashboardMonthlySummary.upsert({
        where: { companyId_referenceMonth: { companyId: batch.companyId, referenceMonth: batch.referenceMonth } },
        create: { companyId: batch.companyId, referenceMonth: batch.referenceMonth, dataJson: mergedSummary },
        update: { dataJson: mergedSummary },
      });
    }

    // Bump Company.updatedAt so the freshness poller detects the deletion even when
    // DashboardMonthlySummary timestamps decrease (or become null) after the delete.
    await prisma.company.update({
      where: { id: batch.companyId },
      data: { updatedAt: new Date() },
    });

    writeAuditLog({
      userId: user.id,
      companyId: batch.companyId,
      action: AuditAction.IMPORT_DELETE,
      entity: "ImportBatch",
      entityId: batch.id,
      metadata: { referenceMonth: batch.referenceMonth },
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel excluir o import." },
      { status: 500 },
    );
  }
}
