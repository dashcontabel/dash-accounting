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

// ── Summary merge helpers ─────────────────────────────────────────────────────

/**
 * Balance sheet fields that are populated from saldo_atual (closing balances).
 * These come from the Balancete (complete picture) rather than the Razão
 * (which only includes accounts that had transactions in the period).
 */
export const BALANCE_SHEET_FIELDS: ReadonlySet<string> = new Set([
  "SD_BANCARIO",
  "DISPONIBILIDADES",
  "ATIVO_CIRCULANTE",
  "PASSIVO_CIRCULANTE",
  "ESTOQUES",
  "REALIZAVEL_LONGO_PRAZO",
  "PASSIVO_NAO_CIRCULANTE",
]);

/**
 * Merge two dashboard summaries from potentially different source types.
 *
 * - XLSX (Balancete): authoritative for every field it provides.
 *   Overwrites matching fields in existing; fields only in existing are kept.
 * - RAZAO: authoritative for P&L flow fields.
 *   Non-zero balance-sheet values already present in `existing` (e.g. from a
 *   prior Balancete import) are preserved so liquidity indices survive when the
 *   Razão file does not include all balance-sheet accounts.
 */
export function mergeSummaries(
  existing: Record<string, number>,
  incoming: Record<string, number>,
  sourceType: "XLSX" | "RAZAO",
): Record<string, number> {
  if (sourceType === "XLSX") {
    // Balancete wins: preserve Razão-only extras, overwrite everything else.
    return { ...existing, ...incoming };
  }

  // Razão: start from Razão data, then reinstate non-zero balance-sheet values
  // that came from an existing Balancete import.
  const merged: Record<string, number> = { ...incoming };
  for (const field of BALANCE_SHEET_FIELDS) {
    const existingVal = existing[field];
    if (existingVal !== undefined && existingVal !== 0) {
      merged[field] = existingVal;
    }
  }
  return merged;
}

