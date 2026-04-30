/**
 * Recalcula todos os DashboardMonthlySummary existentes aplicando os mapeamentos atuais.
 * Útil após adicionar novos AccountMappings sem precisar reimportar os balancetes.
 */
import { PrismaClient } from "@prisma/client";
import { applyAccountMappings } from "../lib/xlsx/mapping-engine.ts";

const p = new PrismaClient();

// Busca todos os mapeamentos ativos
const mappings = await p.accountMapping.findMany({ orderBy: { createdAt: "asc" } });
console.log(`Mapeamentos carregados: ${mappings.length}`);

// Busca todos os summaries existentes (companyId + referenceMonth únicos)
const summaries = await p.dashboardMonthlySummary.findMany({
  select: { companyId: true, referenceMonth: true },
  orderBy: [{ companyId: "asc" }, { referenceMonth: "asc" }],
});
console.log(`Summaries a recalcular: ${summaries.length}\n`);

let updated = 0;
let skipped = 0;

for (const { companyId, referenceMonth } of summaries) {
  // Busca o batch mais recente DONE para este mês
  const batch = await p.importBatch.findFirst({
    where: { companyId, referenceMonth, status: "DONE" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!batch) {
    // Tenta sem filtro de mês (alguns batches podem ter sido importados com datas diferentes)
    const anyBatch = await p.importBatch.findFirst({
      where: { companyId, status: "DONE" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!anyBatch) {
      console.log(`  SKIP ${companyId} / ${referenceMonth} — nenhum batch DONE`);
      skipped++;
      continue;
    }
  }

  // Usa o batch encontrado (por mês ou o mais recente)
  const targetBatch = batch ?? (await p.importBatch.findFirst({
    where: { companyId, status: "DONE" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  }));

  const storedRows = await p.ledgerEntry.findMany({
    where: { importBatchId: targetBatch.id },
    select: { accountCode: true, accountName: true, debit: true, credit: true, balance: true, rawJson: true },
  });

  if (storedRows.length === 0) {
    console.log(`  SKIP ${companyId} / ${referenceMonth} — sem ledgerEntries`);
    skipped++;
    continue;
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
          ? ((r.rawJson.saldo_anterior) ?? 0)
          : 0,
    },
  }));

  const { summary } = applyAccountMappings(parsedRows, mappings);

  await p.dashboardMonthlySummary.upsert({
    where: { companyId_referenceMonth: { companyId, referenceMonth } },
    create: { companyId, referenceMonth, dataJson: summary },
    update: { dataJson: summary },
  });

  const company = await p.company.findUnique({ where: { id: companyId }, select: { name: true } });
  const newFields = ["ATIVO_CIRCULANTE", "PASSIVO_CIRCULANTE", "DISPONIBILIDADES", "REALIZAVEL_LONGO_PRAZO", "PASSIVO_NAO_CIRCULANTE"]
    .map((f) => `${f}=${(summary[f] ?? 0).toFixed(0)}`)
    .join("  ");
  console.log(`  OK ${(company?.name ?? companyId).substring(0, 30).padEnd(30)} / ${referenceMonth}  ${newFields}`);
  updated++;
}

console.log(`\nConcluído: ${updated} atualizados, ${skipped} pulados.`);
await p.$disconnect();
