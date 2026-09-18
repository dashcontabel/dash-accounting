import { describe, expect, it } from "vitest";

import {
  buildBankBalanceBreakdown,
  type BankBalanceBatch,
  type BankBalanceMapping,
} from "./bank-balances";

const mappings: BankBalanceMapping[] = [
  {
    dashboardField: "SD_BANCARIO",
    matchType: "PREFIX",
    codes: ["1.1.1"],
    valueColumn: "saldo_atual",
    aggregation: "SUM",
  },
];

function batch(values: Array<[string, string, number]>): BankBalanceBatch {
  return {
    companyId: "c1",
    referenceMonth: "2026-07",
    entries: values.map(([accountCode, accountName, balance]) => ({
      accountCode,
      accountName,
      balance,
      debit: 0,
      credit: 0,
      previousBalance: 0,
    })),
  };
}

describe("bank balance breakdown", () => {
  it("segments the bank balance into mapped non-zero accounts", () => {
    const result = buildBankBalanceBreakdown(
      [
        batch([
          ["1.1.1.02.001", "Banco do Brasil", 120],
          ["1.1.1.03.001", "Aplicacao", 80],
          ["1.1.1.02.999", "Conta zerada", 0],
          ["9.9.9", "Nao mapeada", 500],
        ]),
      ],
      mappings,
      [{ companyId: "c1", referenceMonth: "2026-07", total: 200 }],
    );

    expect(result).toEqual([
      {
        companyId: "c1",
        referenceMonth: "2026-07",
        total: 200,
        accounts: [
          { accountCode: "1.1.1.02.001", accountName: "Banco do Brasil", balance: 120 },
          { accountCode: "1.1.1.03.001", accountName: "Aplicacao", balance: 80 },
        ],
      },
    ]);
  });

  it("selects the import composition that reconciles with the monthly summary", () => {
    const result = buildBankBalanceBreakdown(
      [
        batch([["1.1.1.01", "Composicao correta", 250]]),
        batch([["1.1.1.02", "Importacao parcial", 90]]),
      ],
      mappings,
      [{ companyId: "c1", referenceMonth: "2026-07", total: 250 }],
    );

    expect(result[0]?.accounts).toEqual([
      { accountCode: "1.1.1.01", accountName: "Composicao correta", balance: 250 },
    ]);
  });
});
