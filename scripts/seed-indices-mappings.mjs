import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

const newMappings = [
  {
    dashboardField: "ATIVO_CIRCULANTE",
    matchType: "PREFIX",
    codes: ["1.1"],
    valueColumn: "saldo_atual",
    aggregation: "SUM",
    isCalculated: false,
    formula: null,
  },
  {
    dashboardField: "PASSIVO_CIRCULANTE",
    matchType: "PREFIX",
    codes: ["2.1"],
    valueColumn: "saldo_atual",
    aggregation: "ABS_SUM",
    isCalculated: false,
    formula: null,
  },
  {
    dashboardField: "ESTOQUES",
    matchType: "LIST",
    codes: [],
    valueColumn: "saldo_atual",
    aggregation: "SUM",
    isCalculated: false,
    formula: null,
  },
  {
    dashboardField: "DISPONIBILIDADES",
    matchType: "PREFIX",
    codes: ["1.1.1"],
    valueColumn: "saldo_atual",
    aggregation: "SUM",
    isCalculated: false,
    formula: null,
  },
  {
    dashboardField: "REALIZAVEL_LONGO_PRAZO",
    matchType: "PREFIX",
    codes: ["1.2.1"],
    valueColumn: "saldo_atual",
    aggregation: "SUM",
    isCalculated: false,
    formula: null,
  },
  {
    dashboardField: "PASSIVO_NAO_CIRCULANTE",
    matchType: "PREFIX",
    codes: ["2.2"],
    valueColumn: "saldo_atual",
    aggregation: "ABS_SUM",
    isCalculated: false,
    formula: null,
  },
];

const fields = newMappings.map((m) => m.dashboardField);
const existing = await p.accountMapping.findMany({
  where: { dashboardField: { in: fields } },
  select: { dashboardField: true },
});

const existingSet = new Set(existing.map((e) => e.dashboardField));
const toCreate = newMappings.filter((m) => !existingSet.has(m.dashboardField));

if (existingSet.size > 0) {
  console.log("Já existem:", [...existingSet].join(", "));
}

if (toCreate.length === 0) {
  console.log("Nenhum mapeamento novo a criar.");
} else {
  const result = await p.accountMapping.createMany({ data: toCreate });
  console.log(`Criados ${result.count} mapeamentos:`);
  for (const m of toCreate) {
    console.log(`  + ${m.dashboardField.padEnd(26)} ${m.matchType.padEnd(7)} ${JSON.stringify(m.codes)}`);
  }
}

await p.$disconnect();
