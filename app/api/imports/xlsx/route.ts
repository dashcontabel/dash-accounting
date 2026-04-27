import { createHash } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequest } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/company-access";
import { prisma } from "@/lib/prisma";
import { AuditAction, writeAuditLog } from "@/lib/audit";
import { applyAccountMappings, detectFileFormat, parseXlsxBuffer } from "@/lib/xlsx";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const formSchema = z.object({
  companyId: z.string().trim().min(1),
  referenceMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
});

async function getActiveUserFromSession(request: NextRequest) {
  const session = await getUserFromRequest(request);
  if (!session?.sub) return null;

  return prisma.user.findFirst({
    where: { id: session.sub, status: "ACTIVE" },
    select: { id: true, role: true },
  });
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
    const referenceMonthRaw = formData.get("referenceMonth");
    const parsedForm = formSchema.safeParse({
      companyId,
      referenceMonth: referenceMonthRaw ? String(referenceMonthRaw) : undefined,
    });

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo nao informado." }, { status: 400 });
    }

    if (!parsedForm.success) {
      return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "Arquivo vazio." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "Arquivo excede 10MB." }, { status: 400 });
    }

    const allowedExtensions = [".xlsx", ".xls", ".csv"];
    const hasAllowedExtension = allowedExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!hasAllowedExtension) {
      return NextResponse.json({ error: "Formato invalido. Envie um .xlsx, .xls ou .csv." }, { status: 400 });
    }

    try {
      await assertCompanyAccess(user, parsedForm.data.companyId);
    } catch {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const checksum = createHash("sha256").update(fileBuffer).digest("hex");

    // Parse the file upfront to extract metadata (CNPJ, period) and validate the sheet
    const parsedWorkbook = parseXlsxBuffer(fileBuffer, file.name);

    // Determine the reference month: form field takes priority, then file metadata
    const effectiveMonth =
      parsedForm.data.referenceMonth ?? parsedWorkbook.metadata?.referenceMonth ?? null;

    if (!effectiveMonth || !/^\d{4}-(0[1-9]|1[0-2])$/.test(effectiveMonth)) {
      return NextResponse.json(
        { error: "referenceMonth nao informado e nao foi possivel detectar no arquivo." },
        { status: 400 },
      );
    }

    // Run both validation queries in parallel — both depend only on data already available.
    const [existingDoneBatch, cnpjCompany] = await Promise.all([
      // Block import when a successful batch already exists for this company+month
      prisma.importBatch.findFirst({
        where: {
          companyId: parsedForm.data.companyId,
          referenceMonth: effectiveMonth,
          status: "DONE",
          NOT: { checksum },
        },
        select: { id: true },
      }),
      // Fetch company document for CNPJ validation only when the file contains a CNPJ
      parsedWorkbook.metadata?.cnpj
        ? prisma.company.findUnique({
            where: { id: parsedForm.data.companyId },
            select: { document: true },
          })
        : Promise.resolve(null),
    ]);

    if (existingDoneBatch) {
      return NextResponse.json(
        { error: `O mes ${effectiveMonth} ja possui uma importacao concluida. Para substituir, exclua o import existente antes de reimportar.` },
        { status: 409 },
      );
    }

    // Validate that the file's CNPJ matches the selected company when both are available
    if (parsedWorkbook.metadata?.cnpj && cnpjCompany) {
      const companyCnpj = cnpjCompany.document?.replace(/\D/g, "");
      if (companyCnpj && companyCnpj !== parsedWorkbook.metadata.cnpj) {
        return NextResponse.json(
          { error: "O CNPJ do arquivo nao corresponde a empresa selecionada." },
          { status: 422 },
        );
      }
    }

    // Validate that the file is not a consolidated (multi-month) report
    if (parsedWorkbook.metadata?.periodEndMonth) {
      const [startMon, startYear] = (parsedWorkbook.metadata.referenceMonth ?? "").split("-").reverse();
      const [endMon, endYear] = parsedWorkbook.metadata.periodEndMonth.split("-").reverse();
      return NextResponse.json(
        {
          error: `Balancete consolidado detectado (${startMon}/${startYear} até ${endMon}/${endYear}). Importe apenas balancetes mensais, um mês por arquivo.`,
        },
        { status: 422 },
      );
    }

    // Validate that the period in the file matches the referenceMonth selected by the user
    if (parsedForm.data.referenceMonth && parsedWorkbook.metadata?.referenceMonth) {
      if (parsedWorkbook.metadata.referenceMonth !== parsedForm.data.referenceMonth) {
        const [fileYear, fileMon] = parsedWorkbook.metadata.referenceMonth.split("-");
        const [selYear, selMon] = parsedForm.data.referenceMonth.split("-");
        return NextResponse.json(
          {
            error: `O periodo do arquivo (${fileMon}/${fileYear}) nao corresponde ao mes/ano selecionado para importacao (${selMon}/${selYear}). Verifique o arquivo ou corrija o periodo informado.`,
          },
          { status: 422 },
        );
      }
    }

    const existingBatch = await prisma.importBatch.findUnique({
      where: {
        companyId_referenceMonth_checksum: {
          companyId: parsedForm.data.companyId,
          referenceMonth: effectiveMonth,
          checksum,
        },
      },
      select: {
        id: true,
        status: true,
        totalsJson: true,
      },
    });

    if (existingBatch) {
      // Re-apply current mappings to stored ledger entries so that summary
      // is always up-to-date even when the same file was previously imported
      // with empty or outdated mappings.
      const storedRows = await prisma.ledgerEntry.findMany({
        where: { importBatchId: existingBatch.id },
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
            saldo_anterior: typeof r.rawJson === "object" && r.rawJson !== null
              ? ((r.rawJson as Record<string, unknown>).saldo_anterior as number ?? 0)
              : 0,
          },
        }));

        const currentMappings = await prisma.accountMapping.findMany({
          orderBy: { createdAt: "asc" },
          select: { id: true, dashboardField: true, matchType: true, codes: true, valueColumn: true, aggregation: true, isCalculated: true, formula: true },
        });

        if (currentMappings.length > 0) {
          const freshResult = applyAccountMappings(parsedRows, currentMappings);
          await prisma.dashboardMonthlySummary.upsert({
            where: { companyId_referenceMonth: { companyId: parsedForm.data.companyId, referenceMonth: effectiveMonth } },
            create: { companyId: parsedForm.data.companyId, referenceMonth: effectiveMonth, dataJson: freshResult.summary },
            update: { dataJson: freshResult.summary },
          });
          return NextResponse.json({ idempotent: true, batchId: existingBatch.id, status: existingBatch.status, summary: freshResult.summary }, { status: 200 });
        }
      }

      const existingSummary = await prisma.dashboardMonthlySummary.findUnique({
        where: { companyId_referenceMonth: { companyId: parsedForm.data.companyId, referenceMonth: effectiveMonth } },
        select: { dataJson: true },
      });

      return NextResponse.json(
        { idempotent: true, batchId: existingBatch.id, status: existingBatch.status, summary: existingSummary?.dataJson ?? null },
        { status: 200 },
      );
    }

    const createdBatch = await prisma.importBatch.create({
      data: {
        companyId: parsedForm.data.companyId,
        referenceMonth: effectiveMonth,
        sourceType: "XLSX",
        status: "PENDING",
        checksum,
        fileName: file.name || null,
        createdByUserId: user.id,
      },
      select: { id: true },
    });
    batchId = createdBatch.id;

    await prisma.importBatch.update({
      where: { id: createdBatch.id },
      data: { status: "PROCESSING", lastError: null },
    });

    const mappings = await prisma.accountMapping.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        dashboardField: true,
        matchType: true,
        codes: true,
        valueColumn: true,
        aggregation: true,
        isCalculated: true,
        formula: true,
      },
    });

    const engineResult = applyAccountMappings(parsedWorkbook.rows, mappings);

    await prisma.$transaction(async (tx) => {
      // Persist raw ledger rows so summaries can be recalculated later when mappings change
      await tx.ledgerEntry.deleteMany({ where: { importBatchId: createdBatch.id } });
      if (parsedWorkbook.rows.length > 0) {
        await tx.ledgerEntry.createMany({
          data: parsedWorkbook.rows.map((row) => ({
            importBatchId: createdBatch.id,
            companyId: parsedForm.data.companyId,
            referenceMonth: effectiveMonth,
            accountCode: row.accountCode,
            accountName: row.description,
            debit: row.values.debito,
            credit: row.values.credito,
            balance: row.values.saldo_atual,
            rawJson: { saldo_anterior: row.values.saldo_anterior },
          })),
        });
      }

      await tx.dashboardMonthlySummary.upsert({
        where: {
          companyId_referenceMonth: {
            companyId: parsedForm.data.companyId,
            referenceMonth: effectiveMonth,
          },
        },
        create: {
          companyId: parsedForm.data.companyId,
          referenceMonth: effectiveMonth,
          dataJson: engineResult.summary,
        },
        update: {
          dataJson: engineResult.summary,
        },
      });

      await tx.unmappedAccount.deleteMany({
        where: { importBatchId: createdBatch.id },
      });

      if (engineResult.unmappedAccounts.length > 0) {
        await tx.unmappedAccount.createMany({
          data: engineResult.unmappedAccounts.map((row) => ({
            importBatchId: createdBatch.id,
            accountCode: row.accountCode,
            description: row.description || null,
          })),
        });
      }

      await tx.importBatch.update({
        where: { id: createdBatch.id },
        data: {
          status: "DONE",
          totalRows: parsedWorkbook.rows.length,
          processedRows: parsedWorkbook.rows.length,
          totalsJson: {
            summary: engineResult.summary,
            rows: parsedWorkbook.rows.length,
            mappedAccounts: engineResult.mappedAccountCodes.length,
            unmappedAccounts: engineResult.unmappedAccounts.length,
            detectedColumns: parsedWorkbook.detectedColumns,
          },
          lastError: null,
        },
      });
    });

    writeAuditLog({
      userId: user.id,
      companyId: parsedForm.data.companyId,
      action: AuditAction.IMPORT_CREATE,
      entity: "ImportBatch",
      entityId: createdBatch.id,
      metadata: {
        fileName: file.name,
        referenceMonth: effectiveMonth,
        totalRows: parsedWorkbook.rows.length,
      },
    });

    return NextResponse.json(
      {
        idempotent: false,
        batchId: createdBatch.id,
        summary: engineResult.summary,
      },
      { status: 201 },
    );
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
      { error: "Nao foi possivel processar o XLSX." },
      { status: 500 },
    );
  }
}
