import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import { AuditAction, writeAuditLog } from "@/lib/audit";
import { assertCompanyAccess } from "@/lib/company-access";
import { prisma } from "@/lib/prisma";

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

    // Remove the monthly summary if no other batch exists for this company+month
    const remainingBatches = await prisma.importBatch.count({
      where: { companyId: batch.companyId, referenceMonth: batch.referenceMonth },
    });
    if (remainingBatches === 0) {
      await prisma.dashboardMonthlySummary.deleteMany({
        where: { companyId: batch.companyId, referenceMonth: batch.referenceMonth },
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
