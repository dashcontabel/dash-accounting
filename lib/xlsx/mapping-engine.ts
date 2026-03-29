import { z } from "zod";

import { evaluateFormula } from "./formula";
import type { NormalizedValueColumn, ParsedAccountRow } from "./parser";

const mappingSchema = z.object({
  id: z.string(),
  dashboardField: z.string().trim().min(1),
  matchType: z.enum(["EXACT", "PREFIX", "LIST"]),
  codes: z.array(z.string().trim().min(1)),
  valueColumn: z.enum(["saldo_atual", "debito", "credito", "saldo_anterior"]),
  aggregation: z.enum(["SUM", "ABS_SUM"]),
  isCalculated: z.boolean(),
  formula: z.string().nullable(),
});

export type MappingRule = z.infer<typeof mappingSchema>;

export type MappingEngineResult = {
  summary: Record<string, number>;
  mappedAccountCodes: string[];
  unmappedAccounts: Array<{ accountCode: string; description: string }>;
};

function normalizeCode(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function rowMatchesRule(row: ParsedAccountRow, rule: MappingRule) {
  const normalizedCode = normalizeCode(row.accountCode);
  const normalizedCodes = rule.codes.map((code) => normalizeCode(code));

  if (rule.matchType === "EXACT") {
    return normalizedCodes.some((code) => normalizedCode === code);
  }

  if (rule.matchType === "PREFIX") {
    return normalizedCodes.some((code) => normalizedCode.startsWith(code));
  }

  return normalizedCodes.includes(normalizedCode);
}

function aggregateRows(rows: ParsedAccountRow[], valueColumn: NormalizedValueColumn, aggregation: "SUM" | "ABS_SUM") {
  const total = rows.reduce((acc, row) => {
    const value = row.values[valueColumn];
    return acc + (aggregation === "ABS_SUM" ? Math.abs(value) : value);
  }, 0);

  return Number(total.toFixed(2));
}

function toRuleList(input: unknown[]) {
  return input
    .map((mapping) => {
      const candidate = (typeof mapping === "object" && mapping !== null ? mapping : {}) as Record<
        string,
        unknown
      >;

      return mappingSchema.safeParse({
        ...candidate,
        codes: Array.isArray(candidate.codes) ? candidate.codes : [],
      });
    })
    .filter((parsed) => parsed.success)
    .map((parsed) => parsed.data);
}

export function applyAccountMappings(rows: ParsedAccountRow[], mappingsInput: unknown[]): MappingEngineResult {
  const mappings = toRuleList(mappingsInput);
  const summary: Record<string, number> = {};
  const mappedAccountCodes = new Set<string>();

  const staticRules = mappings.filter((rule) => !rule.isCalculated);
  const calculatedRules = mappings.filter((rule) => rule.isCalculated);

  for (const rule of staticRules) {
    const matchedRows = rows.filter((row) => rowMatchesRule(row, rule));
    const aggregated = aggregateRows(matchedRows, rule.valueColumn, rule.aggregation);
    summary[rule.dashboardField] = Number(((summary[rule.dashboardField] ?? 0) + aggregated).toFixed(2));

    for (const row of matchedRows) {
      mappedAccountCodes.add(row.accountCode);
    }
  }

  for (const rule of calculatedRules) {
    if (!rule.formula) {
      summary[rule.dashboardField] = summary[rule.dashboardField] ?? 0;
      continue;
    }

    summary[rule.dashboardField] = evaluateFormula(rule.formula, summary);
  }

  const unmappedAccounts = rows
    .filter((row) => !mappedAccountCodes.has(row.accountCode))
    .map((row) => ({
      accountCode: row.accountCode,
      description: row.description,
    }));

  return {
    summary,
    mappedAccountCodes: Array.from(mappedAccountCodes),
    unmappedAccounts,
  };
}
