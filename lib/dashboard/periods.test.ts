import { describe, it, expect } from "vitest";
import {
  aggregateSummaries,
  mergeCompanySummaries,
  type MonthlySummary,
} from "./periods";

const makeSummary = (month: string, receitas: number, despesas: number): MonthlySummary => ({
  referenceMonth: month,
  dataJson: {
    RECEITAS_TOTAL: receitas,
    DESPESAS_TOTAL: despesas,
    RESULTADO: receitas - despesas,
    RENDIMENTO_BRUTO: 0,
    IOF_IRRF: 0,
    ALUGUEL: 0,
    CONDOMINIO: 0,
    SD_BANCARIO: 1000,
    RENTABILIDADE: 0,
    ALUGUEL_LIQUIDO: 0,
  },
});

const summaries2024: MonthlySummary[] = [
  makeSummary("2024-01", 10000, 6000),
  makeSummary("2024-02", 12000, 7000),
  makeSummary("2024-03", 11000, 5000),
  makeSummary("2024-04", 13000, 8000),
  makeSummary("2024-05", 9000, 4000),
  makeSummary("2024-06", 14000, 9000),
];

describe("aggregateSummaries", () => {
  it("monthly returns one period per month", () => {
    const result = aggregateSummaries(summaries2024, "monthly", "2024");
    expect(result).toHaveLength(6);
    expect(result[0]!.months).toEqual(["2024-01"]);
    expect(result[0]!.dataJson.RECEITAS_TOTAL).toBe(10000);
  });

  it("bimonthly groups months in pairs", () => {
    const result = aggregateSummaries(summaries2024, "bimonthly", "2024");
    expect(result).toHaveLength(3);
    expect(result[0]!.months).toEqual(["2024-01", "2024-02"]);
    expect(result[0]!.dataJson.RECEITAS_TOTAL).toBe(22000);
    expect(result[0]!.dataJson.DESPESAS_TOTAL).toBe(13000);
  });

  it("quarterly groups months in triples", () => {
    const result = aggregateSummaries(summaries2024, "quarterly", "2024");
    expect(result).toHaveLength(2);
    expect(result[0]!.months).toEqual(["2024-01", "2024-02", "2024-03"]);
    expect(result[0]!.dataJson.RECEITAS_TOTAL).toBe(33000);
  });

  it("semiannual groups all 6 months into one", () => {
    const result = aggregateSummaries(summaries2024, "semiannual", "2024");
    expect(result).toHaveLength(1);
    expect(result[0]!.dataJson.RECEITAS_TOTAL).toBe(69000);
    expect(result[0]!.dataJson.DESPESAS_TOTAL).toBe(39000);
  });

  it("recalculates RESULTADO correctly", () => {
    const result = aggregateSummaries(summaries2024, "quarterly", "2024");
    // Q1: receitas=33000, despesas=6000+7000+5000=18000, resultado=15000
    expect(result[0]!.dataJson.RESULTADO).toBe(33000 - 18000);
  });

  it("averages SD_BANCARIO instead of summing", () => {
    const result = aggregateSummaries(summaries2024, "bimonthly", "2024");
    expect(result[0]!.dataJson.SD_BANCARIO).toBe(1000); // avg of 1000, 1000
  });

  it("filters to the requested year only", () => {
    const mixed = [
      ...summaries2024,
      makeSummary("2025-01", 5000, 3000),
    ];
    const result = aggregateSummaries(mixed, "monthly", "2024");
    expect(result).toHaveLength(6);
  });

  it("returns empty array when no data for year", () => {
    const result = aggregateSummaries(summaries2024, "monthly", "2099");
    expect(result).toHaveLength(0);
  });
});

describe("mergeCompanySummaries", () => {
  it("sums values across companies for same month", () => {
    const companyA = { companyId: "a", companyName: "A", summaries: [makeSummary("2024-01", 10000, 4000)] };
    const companyB = { companyId: "b", companyName: "B", summaries: [makeSummary("2024-01", 8000, 3000)] };
    const result = mergeCompanySummaries([companyA, companyB]);
    expect(result).toHaveLength(1);
    expect(result[0]!.dataJson.RECEITAS_TOTAL).toBe(18000);
    expect(result[0]!.dataJson.DESPESAS_TOTAL).toBe(7000);
    expect(result[0]!.dataJson.RESULTADO).toBe(11000);
  });

  it("includes months present in only one company", () => {
    const companyA = { companyId: "a", companyName: "A", summaries: [makeSummary("2024-01", 10000, 4000)] };
    const companyB = { companyId: "b", companyName: "B", summaries: [makeSummary("2024-02", 8000, 3000)] };
    const result = mergeCompanySummaries([companyA, companyB]);
    expect(result).toHaveLength(2);
  });

  it("returns empty for no companies", () => {
    const result = mergeCompanySummaries([]);
    expect(result).toHaveLength(0);
  });

  it("returns single company summaries unchanged when one company", () => {
    const companyA = { companyId: "a", companyName: "A", summaries: summaries2024 };
    const result = mergeCompanySummaries([companyA]);
    expect(result).toHaveLength(summaries2024.length);
    expect(result[0]!.dataJson.RECEITAS_TOTAL).toBe(summaries2024[0]!.dataJson.RECEITAS_TOTAL);
  });
});
