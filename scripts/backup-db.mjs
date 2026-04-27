/**
 * Backup script — exports all tables to a JSON file.
 * Usage: node scripts/backup-db.mjs
 * Output: backups/backup-<timestamp>.json
 */

import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const prisma = new PrismaClient();

async function main() {
  console.log("🔒 Iniciando backup do banco de dados...\n");

  const [
    users,
    groups,
    companies,
    userCompanies,
    importBatches,
    ledgerEntries,
    accountMappings,
    dashboardMonthlySummaries,
    unmappedAccounts,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.group.findMany(),
    prisma.company.findMany(),
    prisma.userCompany.findMany(),
    prisma.importBatch.findMany(),
    prisma.ledgerEntry.findMany(),
    prisma.accountMapping.findMany(),
    prisma.dashboardMonthlySummary.findMany(),
    prisma.unmappedAccount.findMany(),
  ]);

  const backup = {
    exportedAt: new Date().toISOString(),
    tables: {
      users: { count: users.length, rows: users },
      groups: { count: groups.length, rows: groups },
      companies: { count: companies.length, rows: companies },
      userCompanies: { count: userCompanies.length, rows: userCompanies },
      importBatches: { count: importBatches.length, rows: importBatches },
      ledgerEntries: { count: ledgerEntries.length, rows: ledgerEntries },
      accountMappings: { count: accountMappings.length, rows: accountMappings },
      dashboardMonthlySummaries: { count: dashboardMonthlySummaries.length, rows: dashboardMonthlySummaries },
      unmappedAccounts: { count: unmappedAccounts.length, rows: unmappedAccounts },
    },
  };

  const outDir = join(ROOT, "backups");
  mkdirSync(outDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = join(outDir, `backup-${timestamp}.json`);
  writeFileSync(outFile, JSON.stringify(backup, null, 2), "utf-8");

  console.log("✅ Backup concluído!\n");
  console.log(`📁 Arquivo: backups/backup-${timestamp}.json`);
  console.log("\n📊 Resumo:");
  for (const [table, data] of Object.entries(backup.tables)) {
    console.log(`   ${table.padEnd(30)} ${data.count} registros`);
  }
}

main()
  .catch((err) => {
    console.error("❌ Erro no backup:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
