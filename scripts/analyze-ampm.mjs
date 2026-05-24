import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Ver mappings relevantes
const mappings = await prisma.accountMapping.findMany({
  where: { dashboardField: { in: ['FATURAMENTO', 'NFS_RECEBIDAS', 'RESULTADO', 'DESPESAS_TOTAL', 'RECEITAS_TOTAL', 'DEMAIS_DESPESAS'] } },
  orderBy: { dashboardField: 'asc' },
  select: { dashboardField: true, matchType: true, codes: true, valueColumn: true, aggregation: true, isCalculated: true, formula: true }
});
console.log('=== MAPEAMENTOS ===');
console.log(JSON.stringify(mappings, null, 2));

const companies = await prisma.company.findMany({
  where: { name: { contains: 'ampm', mode: 'insensitive' } },
  select: { id: true, name: true, document: true, isActive: true }
});
console.log('=== EMPRESAS AMPM ===');
console.log(JSON.stringify(companies, null, 2));

if (companies.length > 0) {
  for (const c of companies) {
    console.log(`\n=== IMPORTS de ${c.name} ===`);
    const batches = await prisma.importBatch.findMany({
      where: { companyId: c.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, referenceMonth: true, sourceType: true, status: true,
        fileName: true, totalRows: true, processedRows: true,
        lastError: true, totalsJson: true, createdAt: true
      }
    });
    console.log(JSON.stringify(batches, null, 2));

    for (const batch of batches) {
      console.log(`\n=== SUMMARY (${batch.referenceMonth} / ${batch.sourceType}) ===`);
      const summary = await prisma.dashboardMonthlySummary.findUnique({
        where: { companyId_referenceMonth: { companyId: c.id, referenceMonth: batch.referenceMonth } },
        select: { dataJson: true, updatedAt: true }
      });
      console.log(JSON.stringify(summary, null, 2));

      console.log(`\n=== LEDGER ENTRIES (batch ${batch.id} - ${batch.referenceMonth}) ===`);
      const entries = await prisma.ledgerEntry.findMany({
        where: { importBatchId: batch.id },
        orderBy: { accountCode: 'asc' },
        take: 50,
        select: { accountCode: true, accountName: true, debit: true, credit: true, balance: true }
      });
      console.log(JSON.stringify(entries, null, 2));

      const unmapped = await prisma.unmappedAccount.findMany({
        where: { importBatchId: batch.id },
        orderBy: { accountCode: 'asc' },
        select: { accountCode: true, description: true }
      });
      if (unmapped.length > 0) {
        console.log(`\n=== CONTAS NAO MAPEADAS (${batch.id}) - ${unmapped.length} contas ===`);
        console.log(JSON.stringify(unmapped, null, 2));
      }
    }
  }
} else {
  console.log('Nenhuma empresa AMPM encontrada. Listando todas as empresas:');
  const all = await prisma.company.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' }
  });
  console.log(JSON.stringify(all, null, 2));
}

await prisma.$disconnect();
