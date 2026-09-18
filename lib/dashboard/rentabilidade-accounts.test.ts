import { describe, expect, it } from "vitest";

import {
  buildRentabilidadeAccountBreakdown,
  type RentabilidadeAccountBatch,
  type RentabilidadeAccountMapping,
} from "./rentabilidade-accounts";

const mappings: RentabilidadeAccountMapping[] = [
  {
    dashboardField: "RENDIMENTO_BRUTO",
    matchType: "PREFIX",
    codes: ["4.1.3"],
    valueColumn: "credito",
    aggregation: "SUM",
  },
  {
    dashboardField: "IOF_IRRF",
    matchType: "LIST",
    codes: ["3.2.2.05.004", "3.2.2.05.006"],
    valueColumn: "debito",
    aggregation: "ABS_SUM",
  },
];

function batch(
  referenceMonth: string,
  values: Array<{
    accountCode: string;
    accountName: string;
    debit?: number;
    credit?: number;
  }>,
): RentabilidadeAccountBatch {
  return {
    companyId: "c1",
    referenceMonth,
    entries: values.map((value) => ({
      debit: value.debit ?? 0,
      credit: value.credit ?? 0,
      balance: 0,
      previousBalance: 0,
      ...value,
    })),
  };
}

describe("rentabilidade account breakdown", () => {
  it("segments gross yield and taxes by mapped account", () => {
    const result = buildRentabilidadeAccountBreakdown(
      [
        batch("2026-01", [
          { accountCode: "4.1.3.01", accountName: "Rendimentos", credit: 120 },
          { accountCode: "3.2.2.05.004", accountName: "IRRF", debit: -20 },
          { accountCode: "9.9.9", accountName: "Nao mapeada", credit: 500 },
        ]),
      ],
      mappings,
    );

    expect(result).toEqual([
      {
        companyId: "c1",
        accounts: [
          {
            accountCode: "3.2.2.05.004",
            accountName: "IRRF",
            months: {
              "2026-01": { grossYield: 0, taxWithheld: 20, netYield: -20 },
            },
          },
          {
            accountCode: "4.1.3.01",
            accountName: "Rendimentos",
            months: {
              "2026-01": { grossYield: 120, taxWithheld: 0, netYield: 120 },
            },
          },
        ],
      },
    ]);
  });

  it("uses the newest batch composition for a company and month", () => {
    const result = buildRentabilidadeAccountBreakdown(
      [
        batch("2026-06", [
          { accountCode: "4.1.3.01", accountName: "Rendimento antigo", credit: 100 },
        ]),
        batch("2026-06", [
          { accountCode: "4.1.3.02", accountName: "Rendimento atual", credit: 35 },
        ]),
        batch("2026-07", [
          { accountCode: "4.1.3.02", accountName: "Rendimento atual", credit: 45 },
        ]),
      ],
      mappings,
    );

    expect(result[0]!.accounts).toHaveLength(1);
    expect(result[0]!.accounts[0]).toEqual({
      accountCode: "4.1.3.02",
      accountName: "Rendimento atual",
      months: {
        "2026-06": { grossYield: 35, taxWithheld: 0, netYield: 35 },
        "2026-07": { grossYield: 45, taxWithheld: 0, netYield: 45 },
      },
    });
  });
});
