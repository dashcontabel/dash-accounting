import { describe, expect, it } from "vitest";

import {
  buildRentabilidadeStatement,
  getMonthKeysInRange,
  getRentabilidadeColumns,
  normalizeMonthRange,
} from "./rentabilidade";
import type { CompanyData } from "./types";

const company = (
  companyId: string,
  companyName: string,
  summaries: CompanyData["summaries"],
): CompanyData => ({
  companyId,
  companyName,
  summaries,
  lastUpdatedAt: null,
});

describe("rentabilidade statement", () => {
  it("builds monthly, quarterly and total values per selected companies", () => {
    const statement = buildRentabilidadeStatement(
      [
        company("c1", "AMPM", [
          { referenceMonth: "2025-12", dataJson: { SD_BANCARIO: 1000 } },
          {
            referenceMonth: "2026-01",
            dataJson: {
              SD_BANCARIO: 1080,
              RENDIMENTO_BRUTO: 100,
              IOF_IRRF: 20,
              RENTABILIDADE: 80,
            },
          },
          {
            referenceMonth: "2026-02",
            dataJson: {
              SD_BANCARIO: 1150,
              RENDIMENTO_BRUTO: 90,
              IOF_IRRF: 15,
              RENTABILIDADE: 75,
            },
          },
          {
            referenceMonth: "2026-03",
            dataJson: {
              SD_BANCARIO: 1200,
              RENDIMENTO_BRUTO: 120,
              IOF_IRRF: 30,
              RENTABILIDADE: 90,
            },
          },
        ]),
        company("c2", "BLUD", [
          { referenceMonth: "2025-12", dataJson: { SD_BANCARIO: 500 } },
          {
            referenceMonth: "2026-01",
            dataJson: {
              SD_BANCARIO: 540,
              RENDIMENTO_BRUTO: 50,
              IOF_IRRF: 10,
              RENTABILIDADE: 40,
            },
          },
          {
            referenceMonth: "2026-03",
            dataJson: {
              SD_BANCARIO: 610,
              RENDIMENTO_BRUTO: 80,
              IOF_IRRF: 20,
              RENTABILIDADE: 60,
            },
          },
        ]),
      ],
      "2026",
      "01",
      "03",
    );

    expect(statement.rows).toHaveLength(2);
    expect(statement.rows[0]!.openingBalance).toBe(1000);
    expect(statement.rows[0]!.months["2026-01"]!.netYield).toBe(80);
    expect(statement.rows[0]!.quarters.Q1).toBe(245);
    expect(statement.rows[0]!.finalBalance).toBe(1200);

    expect(statement.rows[1]!.months["2026-02"]!.hasData).toBe(false);
    expect(statement.rows[1]!.quarters.Q1).toBe(100);

    expect(statement.totalRow.openingBalance).toBe(1500);
    expect(statement.totalRow.months["2026-01"]!.netYield).toBe(120);
    expect(statement.totalRow.quarters.Q1).toBe(345);
    expect(statement.totalRow.finalBalance).toBe(1810);
  });

  it("derives net yield from gross yield and taxes when the calculated field is missing", () => {
    const statement = buildRentabilidadeStatement(
      [
        company("c1", "AMPM", [
          {
            referenceMonth: "2026-04",
            dataJson: {
              SD_BANCARIO: 1000,
              RENDIMENTO_BRUTO: 200,
              IOF_IRRF: 45.55,
            },
          },
        ]),
      ],
      "2026",
      "04",
      "04",
    );

    expect(statement.rows[0]!.months["2026-04"]!.netYield).toBe(154.45);
    expect(statement.rows[0]!.quarters.Q2).toBe(154.45);
  });

  it("normalizes month ranges and inserts quarter columns after the last selected month of each quarter", () => {
    expect(normalizeMonthRange("06", "02")).toEqual(["02", "06"]);
    expect(getMonthKeysInRange("02", "04")).toEqual(["02", "03", "04"]);

    const columns = getRentabilidadeColumns("2026", "02", "04");

    expect(columns.map((column) => column.key)).toEqual([
      "2026-02",
      "2026-03",
      "Q1",
      "2026-04",
      "Q2",
    ]);
  });
});
