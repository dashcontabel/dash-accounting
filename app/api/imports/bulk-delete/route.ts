import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequest } from "@/lib/auth";
import { AuditAction, writeAuditLog } from "@/lib/audit";
import { assertCompanyAccess } from "@/lib/company-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const bodySchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(100),
});

async function getActiveUserFromSession(request: NextRequest) {
  const session = await getUserFromRequest(request);
  if (!session?.sub) return null;
  return prisma.user.findFirst({
    where: { id: session.sub, status: "ACTIVE" },
    select: { id: true, role: true },
  });
}

/**
 * DELETE /api/imports/bulk-delete
 * Body: { ids: string[] }
 *
 * Deletes up to 100 import batches in a single request.
 * All batches must belong to companies accessible by the requesting user.
 * Returns { deleted: number, failed: string[] }.
 */
export async function DELETE(request: NextRequest) {
  const user = await getActiveUserFromSession(request);
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "ids invalidos." }, { status: 400 });
  }

  const { ids } = parsed.data;

  // Load all batches in one query
  const batches = await prisma.importBatch.findMany({
    where: { id: { in: ids } },
    select: { id: true, companyId: true, referenceMonth: true, sourceType: true, fileName: true },
  });

  const failed: string[] = [];
  const toDelete: typeof batches = [];

  // Verify access to every batch's company
  for (const batch of batches) {
    try {
      await assertCompanyAccess(user, batch.companyId);
      toDelete.push(batch);
    } catch {
      failed.push(batch.id);
    }
  }

  // Track which (companyId, referenceMonth) pairs need their summary removed
  const summaryKeys = new Map<string, { companyId: string; referenceMonth: string }>();
  for (const b of toDelete) {
    const key = `${b.companyId}::${b.referenceMonth}`;
    summaryKeys.set(key, { companyId: b.companyId, referenceMonth: b.referenceMonth });
  }

  const deleteIds = toDelete.map((b) => b.id);

  if (deleteIds.length > 0) {
    await prisma.$transaction(async (tx) => {
      // Delete dependent rows first
      await tx.ledgerEntry.deleteMany({ where: { importBatchId: { in: deleteIds } } });
      await tx.unmappedAccount.deleteMany({ where: { importBatchId: { in: deleteIds } } });
      await tx.razaoEntry.deleteMany({ where: { importBatchId: { in: deleteIds } } });

      // Remove dashboard summaries for affected months (only when no remaining batch exists)
      for (const { companyId, referenceMonth } of summaryKeys.values()) {
        const remaining = await tx.importBatch.count({
          where: {
            companyId,
            referenceMonth,
            status: "DONE",
            id: { notIn: deleteIds },
          },
        });
        if (remaining === 0) {
          await tx.dashboardMonthlySummary.deleteMany({ where: { companyId, referenceMonth } });
        }
      }

      await tx.importBatch.deleteMany({ where: { id: { in: deleteIds } } });
    });

    writeAuditLog({
      userId: user.id,
      action: AuditAction.IMPORT_BULK_DELETE,
      entity: "ImportBatch",
      metadata: {
        ids: deleteIds,
        count: deleteIds.length,
        batches: toDelete.map((b) => ({
          id: b.id,
          companyId: b.companyId,
          referenceMonth: b.referenceMonth,
          fileName: b.fileName,
        })),
      },
    });
  }

  return NextResponse.json({ deleted: deleteIds.length, failed });
}
