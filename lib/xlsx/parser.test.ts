import { describe, expect, it } from "vitest";

import { parseXlsxRows } from "./parser";

describe("parseXlsxRows", () => {
  it("detects dynamic headers and normalizes pt-BR values", () => {
    const rows = [
      ["Relatorio Balancete"],
      ["Classificacao", "Descricao", "Saldo Atual", "Debitos", "Creditos"],
      ["1.1.01.01", "Banco A", "2.136.604,36", "10.000,00", "5.000,00"],
      ["3.1.01", "Receita", "-", "-", "120.500,50"],
      ["", "Sem codigo", "100,00", "10,00", "5,00"],
    ];

    const result = parseXlsxRows(rows);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].accountCode).toBe("1.1.01.01");
    expect(result.rows[0].values.saldo_atual).toBe(2136604.36);
    expect(result.rows[1].values.credito).toBe(120500.5);
  });
});
