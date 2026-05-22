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

  // Fetch each table independently so a missing table (pre-migration) doesn't abort the whole backup
  async function safeFetch(label, fn) {
    try {
      const rows = await fn();
      console.log(`   ✓ ${label.padEnd(30)} ${rows.length} registros`);
      return rows;
    } catch {
      console.warn(`   ⚠ ${label.padEnd(30)} tabela não encontrada (migration pendente)`);
      return [];
    }
  }

  const [
    users,
    groups,
    companies,
    userCompanies,
    importBatches,
    ledgerEntries,
    razaoEntries,
    accountMappings,
    dashboardMonthlySummaries,
    unmappedAccounts,
    auditLogs,
    systemConfigs,
  ] = await Promise.all([
    safeFetch("users",                      () => prisma.user.findMany()),
    safeFetch("groups",                     () => prisma.group.findMany()),
    safeFetch("companies",                  () => prisma.company.findMany()),
    safeFetch("userCompanies",              () => prisma.userCompany.findMany()),
    safeFetch("importBatches",              () => prisma.importBatch.findMany()),
    safeFetch("ledgerEntries",              () => prisma.ledgerEntry.findMany()),
    safeFetch("razaoEntries",               () => prisma.razaoEntry.findMany()),
    safeFetch("accountMappings",            () => prisma.accountMapping.findMany()),
    safeFetch("dashboardMonthlySummaries",  () => prisma.dashboardMonthlySummary.findMany()),
    safeFetch("unmappedAccounts",           () => prisma.unmappedAccount.findMany()),
    safeFetch("auditLogs",                  () => prisma.auditLog.findMany()),
    safeFetch("systemConfigs",              () => prisma.systemConfig.findMany()),
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
      razaoEntries: { count: razaoEntries.length, rows: razaoEntries },
      accountMappings: { count: accountMappings.length, rows: accountMappings },
      dashboardMonthlySummaries: { count: dashboardMonthlySummaries.length, rows: dashboardMonthlySummaries },
      unmappedAccounts: { count: unmappedAccounts.length, rows: unmappedAccounts },
      auditLogs: { count: auditLogs.length, rows: auditLogs },
      systemConfigs: { count: systemConfigs.length, rows: systemConfigs },
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
