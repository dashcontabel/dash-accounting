/**
 * Recalcula summaries da PLACA para Jan-Apr 2026 usando o mapping-engine de produção.
 * Uso: npx tsx scripts/recalculate-placa.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "../lib/prisma";
import { applyAccountMappings, mergeSummaries } from "../lib/xlsx";

const COMPANY_ID = "cmnnkkeae0001l504ob2urpwa";
const MONTHS = ["2026-01", "2026-02", "2026-03", "2026-04"];

async function recalculateMonth(referenceMonth: string, mappings: unknown[]) {
  const batches = await prisma.importBatch.findMany({
    where: { companyId: COMPANY_ID, referenceMonth, status: "DONE" },
    orderBy: { createdAt: "asc" },
    select: { id: true, sourceType: true },
  });

  if (batches.length === 0) {
    console.log(`  ${referenceMonth}: sem batches DONE — pulando`);
    return null;
  }

  let mergedSummary: Record<string, number> = {};

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
            ? (((r.rawJson as Record<string, unknown>).saldo_anterior as number) ?? 0)
            : 0,
      },
    }));

    const engineResult = applyAccountMappings(parsedRows, mappings);
    mergedSummary = mergeSummaries(mergedSummary, engineResult.summary, batch.sourceType as "XLSX" | "RAZAO");
  }

  return mergedSummary;
}

async function main() {
  const mappings = await prisma.accountMapping.findMany({ orderBy: { createdAt: "asc" } });
  console.log(`Usando ${mappings.length} regras de mapeamento\n`);

  for (const month of MONTHS) {
    console.log(`Recalculando ${month}...`);
    const summary = await recalculateMonth(month, mappings);
    if (!summary) continue;

    const keys = ["DESPESAS_TOTAL", "DEMAIS_DESPESAS", "IMPOSTOS", "IOF_IRRF", "CONDOMINIO", "LRA2_DESP", "LRA3_DESP", "B_VISTA_DESP", "TRAPICHE_DESP"];
    keys.forEach((k) => console.log(`  ${k} = ${summary[k] ?? "n/a"}`));

    await prisma.dashboardMonthlySummary.upsert({
      where: { companyId_referenceMonth: { companyId: COMPANY_ID, referenceMonth: month } },
      create: { companyId: COMPANY_ID, referenceMonth: month, dataJson: summary },
      update: { dataJson: summary },
    });
    console.log(`  ✓ Salvo\n`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
