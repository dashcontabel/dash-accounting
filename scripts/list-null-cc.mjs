import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const r = await p.razaoEntry.findMany({
  where: {
    companyId: "cmnnkkeae0001l504ob2urpwa",
    referenceMonth: "2026-03",
    costCenter: null,
  },
  select: { accountCode: true, accountName: true },
  distinct: ["accountCode"],
  orderBy: { accountCode: "asc" },
});

console.log(`\n=== Contas SEM centro de custo (2026-03) — ${r.length} contas ===\n`);
r.forEach((x) => console.log(`  ${x.accountCode.padEnd(25)} ${x.accountName}`));
await p.$disconnect();
