import { describe, expect, it } from "vitest";

import { applyAccountMappings } from "./mapping-engine";

describe("applyAccountMappings", () => {
  it("applies PREFIX/LIST rules and calculates formula fields", () => {
    const rows = [
      {
        accountCode: "3.1.01",
        description: "Receita",
        values: { saldo_atual: 0, saldo_anterior: 0, debito: 0, credito: 1000 },
      },
      {
        accountCode: "3.2.01",
        description: "Imposto",
        values: { saldo_atual: 0, saldo_anterior: 0, debito: 100, credito: 0 },
      },
      {
        accountCode: "1.1.01.01",
        description: "Banco",
        values: { saldo_atual: 500, saldo_anterior: 300, debito: 0, credito: 0 },
      },
    ];

    const mappings = [
      {
        id: "m1",
        dashboardField: "FATURAMENTO",
        matchType: "PREFIX",
        codes: ["3.1"],
        valueColumn: "credito",
        aggregation: "SUM",
        isCalculated: false,
        formula: null,
      },
      {
        id: "m2",
        dashboardField: "IMPOSTOS",
        matchType: "EXACT",
        codes: ["3.2.01"],
        valueColumn: "debito",
        aggregation: "ABS_SUM",
        isCalculated: false,
        formula: null,
      },
      {
        id: "m3",
        dashboardField: "SD_BANCARIO",
        matchType: "LIST",
        codes: ["1.1.01.01"],
        valueColumn: "saldo_atual",
        aggregation: "SUM",
        isCalculated: false,
        formula: null,
      },
      {
        id: "m4",
        dashboardField: "RENTABILIDADE",
        matchType: "LIST",
        codes: [],
        valueColumn: "saldo_atual",
        aggregation: "SUM",
        isCalculated: true,
        formula: "FATURAMENTO - IMPOSTOS - DEMAIS_DESPESAS",
      },
    ];

    const result = applyAccountMappings(rows, mappings);

    expect(result.summary.FATURAMENTO).toBe(1000);
    expect(result.summary.IMPOSTOS).toBe(100);
    expect(result.summary.SD_BANCARIO).toBe(500);
    expect(result.summary.DEMAIS_DESPESAS).toBeUndefined();
    expect(result.summary.RENTABILIDADE).toBe(900);
    expect(result.unmappedAccounts).toHaveLength(0);
  });
});
