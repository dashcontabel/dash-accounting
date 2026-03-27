import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";

import { applyAccountMappings } from "./mapping-engine";
import { parseXlsxBuffer } from "./workbook";

describe("xlsx mapped summary integration", () => {
  it("extracts FATURAMENTO, RENTABILIDADE and SD_BANCARIO from xlsx", () => {
    const workbook = utils.book_new();
    const sheet = utils.aoa_to_sheet([
      ["Cabecalho", "", "", ""],
      ["Codigo", "Descricao", "Debitos", "Creditos", "Saldo Atual"],
      ["1.1.01.01", "Banco", "-", "-", "2.136.604,36"],
      ["3.1.01", "Receita", "-", "500.000,00", "-"],
      ["3.2.01", "Impostos", "100.000,00", "-", "-"],
    ]);
    utils.book_append_sheet(workbook, sheet, "Balancete");

    const buffer = write(workbook, { type: "buffer", bookType: "xlsx" });
    const parsed = parseXlsxBuffer(buffer);

    const mappingResult = applyAccountMappings(parsed.rows, [
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
        matchType: "PREFIX",
        codes: ["3.2"],
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
    ]);

    expect(mappingResult.summary.FATURAMENTO).toBe(500000);
    expect(mappingResult.summary.SD_BANCARIO).toBe(2136604.36);
    expect(mappingResult.summary.RENTABILIDADE).toBe(400000);
  });
});
