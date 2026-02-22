import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
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

    const entriesPreview = await prisma.ledgerEntry.findMany({
      where: { importBatchId: batch.id },
      orderBy: { accountCode: "asc" },
      take: 200,
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        debit: true,
        credit: true,
        balance: true,
        rawJson: true,
      },
    });

    return NextResponse.json({
      batch,
      entriesPreview,
    });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel carregar o import." },
      { status: 500 },
    );
  }
}
