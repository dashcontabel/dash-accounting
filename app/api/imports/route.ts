import { createHash } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequest } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/company-access";
import { parseLedgerCsvBuffer } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const querySchema = z.object({
  companyId: z.string().min(1),
});

const formSchema = z.object({
  companyId: z.string().min(1),
  referenceMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

function toTwoDecimals(value: number) {
  return Number(value.toFixed(2));
}

async function getActiveUserFromSession(request: NextRequest) {
  const session = await getUserFromRequest(request);
  if (!session?.sub) return null;

  return prisma.user.findFirst({
    where: { id: session.sub, status: "ACTIVE" },
    select: { id: true, role: true },
  });
}

export async function GET(request: NextRequest) {
  try {
    const user = await getActiveUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    const parsedQuery = querySchema.safeParse({
      companyId: request.nextUrl.searchParams.get("companyId") ?? "",
    });
    if (!parsedQuery.success) {
      return NextResponse.json({ error: "companyId invalido." }, { status: 400 });
    }

    try {
      await assertCompanyAccess(user, parsedQuery.data.companyId);
    } catch {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const batches = await prisma.importBatch.findMany({
      where: { companyId: parsedQuery.data.companyId },
      orderBy: { createdAt: "desc" },
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

    return NextResponse.json({ batches });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel carregar os imports." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let batchId: string | null = null;

  try {
    const user = await getActiveUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (user.role === "CLIENT") {
      return NextResponse.json({ error: "Sem permissao para realizar importacoes." }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const companyId = String(formData.get("companyId") ?? "");
    const referenceMonth = String(formData.get("referenceMonth") ?? "");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo nao informado." }, { status: 400 });
    }

    const parsedForm = formSchema.safeParse({ companyId, referenceMonth });
    if (!parsedForm.success) {
      return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "Arquivo vazio." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Arquivo excede o limite de 5MB." },
        { status: 400 },
      );
    }

    try {
      await assertCompanyAccess(user, parsedForm.data.companyId);
    } catch {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const checksum = createHash("sha256").update(fileBuffer).digest("hex");

    const existingBatch = await prisma.importBatch.findUnique({
      where: {
        companyId_referenceMonth_checksum: {
          companyId: parsedForm.data.companyId,
          referenceMonth: parsedForm.data.referenceMonth,
          checksum,
        },
      },
      select: {
        id: true,
        status: true,
        companyId: true,
        referenceMonth: true,
        checksum: true,
        createdAt: true,
      },
    });

    if (existingBatch) {
      return NextResponse.json(
        {
          idempotent: true,
          batch: existingBatch,
          message: "Arquivo ja importado para esta empresa e mes.",
        },
        { status: 200 },
      );
    }

    const batch = await prisma.importBatch.create({
      data: {
        companyId: parsedForm.data.companyId,
        referenceMonth: parsedForm.data.referenceMonth,
        status: "PROCESSING",
        checksum,
        fileName: file.name || null,
        createdByUserId: user.id,
      },
      select: { id: true },
    });
    batchId = batch.id;

    const parsedCsv = await parseLedgerCsvBuffer(fileBuffer);

    const payload = parsedCsv.entries.map((entry) => ({
      importBatchId: batch.id,
      companyId: parsedForm.data.companyId,
      referenceMonth: parsedForm.data.referenceMonth,
      accountCode: entry.accountCode,
      accountName: entry.accountName,
      debit: toTwoDecimals(entry.debit),
      credit: toTwoDecimals(entry.credit),
      balance: toTwoDecimals(entry.balance),
      rawJson: entry.rawJson,
    }));

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < payload.length; i += 500) {
        const chunk = payload.slice(i, i + 500);
        await tx.ledgerEntry.createMany({ data: chunk });
      }

      await tx.importBatch.update({
        where: { id: batch.id },
        data: {
          status: "DONE",
          totalRows: payload.length,
          processedRows: payload.length,
          totalsJson: {
            rows: parsedCsv.totals.rows,
            totalDebit: toTwoDecimals(parsedCsv.totals.totalDebit),
            totalCredit: toTwoDecimals(parsedCsv.totals.totalCredit),
          },
          lastError: null,
        },
      });
    });

    const createdBatch = await prisma.importBatch.findUnique({
      where: { id: batch.id },
      select: {
        id: true,
        sourceType: true,
        status: true,
        companyId: true,
        referenceMonth: true,
        checksum: true,
        totalRows: true,
        processedRows: true,
        totalsJson: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ idempotent: false, batch: createdBatch }, { status: 201 });
  } catch (error) {
    if (batchId) {
      await prisma.importBatch
        .update({
          where: { id: batchId },
          data: {
            status: "FAILED",
            lastError: error instanceof Error ? error.message : "Erro inesperado no processamento.",
          },
        })
        .catch(() => undefined);
    }

    return NextResponse.json(
      { error: "Nao foi possivel processar o arquivo." },
      { status: 500 },
    );
  }
}
