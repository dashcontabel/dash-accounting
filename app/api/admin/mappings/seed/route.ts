import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/admin-guard";
import { prisma } from "@/lib/prisma";

// Prefixos baseados no Balancete de referência (AMPM / Jan-2024).
// O admin pode ajustar os codes por empresa via /api/admin/mappings.
const defaultMappings = [
  // ── Receitas ──────────────────────────────────────────────────────────────
  {
    dashboardField: "FATURAMENTO",
    matchType: "PREFIX",
    codes: ["4.1.1"],
    valueColumn: "credito",
    aggregation: "SUM",
    isCalculated: false,
    formula: null,
  },
  {
    dashboardField: "NFS_RECEBIDAS",
    matchType: "PREFIX",
    codes: ["1.1.2"],
    valueColumn: "credito",
    aggregation: "SUM",
    isCalculated: false,
    formula: null,
  },
  {
    dashboardField: "RENDIMENTO_BRUTO",
    matchType: "PREFIX",
    codes: ["4.1.3"],
    valueColumn: "credito",
    aggregation: "SUM",
    isCalculated: false,
    formula: null,
  },
  // Receita de investimentos por produto — admin configura os codes específicos
  {
    dashboardField: "LRA2_INVEST",
    matchType: "LIST",
    codes: [],
    valueColumn: "credito",
    aggregation: "SUM",
    isCalculated: false,
    formula: null,
  },
  {
    dashboardField: "LRA3_INVEST",
    matchType: "LIST",
    codes: [],
    valueColumn: "credito",
    aggregation: "SUM",
    isCalculated: false,
    formula: null,
  },
  {
    dashboardField: "B_VISTA_INVEST",
    matchType: "LIST",
    codes: [],
    valueColumn: "credito",
    aggregation: "SUM",
    isCalculated: false,
    formula: null,
  },
  {
    dashboardField: "TRAPICHE_INVEST",
    matchType: "LIST",
    codes: [],
    valueColumn: "credito",
    aggregation: "SUM",
    isCalculated: false,
    formula: null,
  },
  // Aluguel recebido — admin configura o código da conta de receita de aluguel
  {
    dashboardField: "ALUGUEL",
    matchType: "LIST",
    codes: [],
    valueColumn: "credito",
    aggregation: "SUM",
    isCalculated: false,
    formula: null,
  },
  // ── Despesas ──────────────────────────────────────────────────────────────
  {
    dashboardField: "IMPOSTOS",
    matchType: "PREFIX",
    codes: ["3.2.2.03"],
    valueColumn: "debito",
    aggregation: "ABS_SUM",
    isCalculated: false,
    formula: null,
  },
  {
    dashboardField: "IOF_IRRF",
    matchType: "LIST",
    codes: [],
    valueColumn: "debito",
    aggregation: "ABS_SUM",
    isCalculated: false,
    formula: null,
  },
  // Despesas por produto de investimento — admin configura
  {
    dashboardField: "LRA2_DESP",
    matchType: "LIST",
    codes: [],
    valueColumn: "debito",
    aggregation: "ABS_SUM",
    isCalculated: false,
    formula: null,
  },
  {
    dashboardField: "LRA3_DESP",
    matchType: "LIST",
    codes: [],
    valueColumn: "debito",
    aggregation: "ABS_SUM",
    isCalculated: false,
    formula: null,
  },
  {
    dashboardField: "B_VISTA_DESP",
    matchType: "LIST",
    codes: [],
    valueColumn: "debito",
    aggregation: "ABS_SUM",
    isCalculated: false,
    formula: null,
  },
  {
    dashboardField: "TRAPICHE_DESP",
    matchType: "LIST",
    codes: [],
    valueColumn: "debito",
    aggregation: "ABS_SUM",
    isCalculated: false,
    formula: null,
  },
  {
    dashboardField: "CONDOMINIO",
    matchType: "LIST",
    codes: [],
    valueColumn: "debito",
    aggregation: "ABS_SUM",
    isCalculated: false,
    formula: null,
  },
  {
    dashboardField: "DISTRIB_LUCROS",
    matchType: "PREFIX",
    codes: ["1.1.6"],
    valueColumn: "debito",
    aggregation: "ABS_SUM",
    isCalculated: false,
    formula: null,
  },
  {
    dashboardField: "DEMAIS_DESPESAS",
    matchType: "PREFIX",
    codes: ["3.2.1"],
    valueColumn: "debito",
    aggregation: "ABS_SUM",
    isCalculated: false,
    formula: null,
  },
  // ── Saldo bancário ────────────────────────────────────────────────────────
  {
    dashboardField: "SD_BANCARIO",
    matchType: "PREFIX",
    codes: ["1.1.1"],
    valueColumn: "saldo_atual",
    aggregation: "SUM",
    isCalculated: false,
    formula: null,
  },
  // ── Campos calculados ─────────────────────────────────────────────────────
  {
    dashboardField: "RENTABILIDADE",
    matchType: "LIST",
    codes: [],
    valueColumn: "saldo_atual",
    aggregation: "SUM",
    isCalculated: true,
    formula: "RENDIMENTO_BRUTO - IOF_IRRF",
  },
  {
    dashboardField: "ALUGUEL_LIQUIDO",
    matchType: "LIST",
    codes: [],
    valueColumn: "saldo_atual",
    aggregation: "SUM",
    isCalculated: true,
    formula: "ALUGUEL - CONDOMINIO",
  },
  {
    dashboardField: "RECEITAS_TOTAL",
    matchType: "LIST",
    codes: [],
    valueColumn: "saldo_atual",
    aggregation: "SUM",
    isCalculated: true,
    formula: "FATURAMENTO + RENDIMENTO_BRUTO + ALUGUEL",
  },
  {
    dashboardField: "DESPESAS_TOTAL",
    matchType: "LIST",
    codes: [],
    valueColumn: "saldo_atual",
    aggregation: "SUM",
    isCalculated: true,
    formula: "IMPOSTOS + IOF_IRRF + LRA2_DESP + LRA3_DESP + B_VISTA_DESP + TRAPICHE_DESP + CONDOMINIO + DEMAIS_DESPESAS",
  },
  {
    dashboardField: "RESULTADO",
    matchType: "LIST",
    codes: [],
    valueColumn: "saldo_atual",
    aggregation: "SUM",
    isCalculated: true,
    formula: "RECEITAS_TOTAL - DESPESAS_TOTAL",
  },
] as const;

export async function POST(request: NextRequest) {
  const { admin, errorResponse } = await requireAdmin(request);
  if (errorResponse) {
    return errorResponse;
  }

  if (!admin) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.accountMapping.deleteMany();
      await tx.accountMapping.createMany({
        data: defaultMappings.map((mapping) => ({
          dashboardField: mapping.dashboardField,
          matchType: mapping.matchType,
          codes: mapping.codes,
          valueColumn: mapping.valueColumn,
          aggregation: mapping.aggregation,
          isCalculated: mapping.isCalculated,
          formula: mapping.formula,
        })),
      });
    });

    return NextResponse.json({
      message: "Mappings iniciais criados.",
      count: defaultMappings.length,
      fields: defaultMappings.map((m) => m.dashboardField),
    });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel criar mappings iniciais." },
      { status: 500 },
    );
  }
}
