export type PeriodGranularity = "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual";

export const PERIOD_LABELS: Record<PeriodGranularity, string> = {
  monthly: "Mensal",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

export type MonthlySummary = {
  referenceMonth: string; // "YYYY-MM"
  dataJson: Record<string, number>;
};

export type AggregatedPeriod = {
  label: string;
  months: string[]; // ["YYYY-MM", ...]
  dataJson: Record<string, number>;
};

// Fields that are averaged rather than summed when aggregating periods
const AVERAGE_FIELDS = new Set(["SD_BANCARIO"]);

// Fields that are recalculated from aggregated sums
const CALCULATED_FIELDS = new Set(["RESULTADO", "RENTABILIDADE", "ALUGUEL_LIQUIDO"]);

function sumData(summaries: MonthlySummary[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const s of summaries) {
    for (const [key, val] of Object.entries(s.dataJson)) {
      if (AVERAGE_FIELDS.has(key) || CALCULATED_FIELDS.has(key)) continue;
      result[key] = (result[key] ?? 0) + val;
    }
  }
  // Average saldo bancário
  for (const field of AVERAGE_FIELDS) {
    const vals = summaries.map((s) => s.dataJson[field] ?? 0);
    result[field] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }
  // Recalculate derived fields
  result["RESULTADO"] = (result["RECEITAS_TOTAL"] ?? 0) - (result["DESPESAS_TOTAL"] ?? 0);
  result["RENTABILIDADE"] = (result["RENDIMENTO_BRUTO"] ?? 0) - (result["IOF_IRRF"] ?? 0);
  result["ALUGUEL_LIQUIDO"] = (result["ALUGUEL"] ?? 0) - (result["CONDOMINIO"] ?? 0);
  return result;
}

function chunkMonths(months: string[], size: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < months.length; i += size) {
    chunks.push(months.slice(i, i + size));
  }
  return chunks;
}

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

function monthLabel(ym: string) {
  const [, m] = ym.split("-");
  return MONTH_LABELS[m ?? ""] ?? m ?? ym;
}

function groupLabel(months: string[], granularity: PeriodGranularity): string {
  if (months.length === 0) return "";
  const first = months[0]!;
  const last = months[months.length - 1]!;
  const year = first.slice(0, 4);

  if (granularity === "annual") return year;
  if (months.length === 1) return `${monthLabel(first)}/${year.slice(2)}`;
  return `${monthLabel(first)}–${monthLabel(last)}/${year.slice(2)}`;
}

export function aggregateSummaries(
  summaries: MonthlySummary[],
  granularity: PeriodGranularity,
  year: string,
): AggregatedPeriod[] {
  const filtered = summaries
    .filter((s) => s.referenceMonth.startsWith(year))
    .sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth));

  if (granularity === "monthly") {
    return filtered.map((s) => ({
      label: `${monthLabel(s.referenceMonth)}/${year.slice(2)}`,
      months: [s.referenceMonth],
      dataJson: s.dataJson,
    }));
  }

  // Sequential chunking: group the actual available months in calendar order.
  // This avoids partial first/last slots that happen with fixed calendar boundaries
  // when data doesn't start on a period boundary (e.g. data starts in February).
  const chunkSize: Record<PeriodGranularity, number> = {
    monthly: 1,   // not used in this branch
    bimonthly: 2,
    quarterly: 3,
    semiannual: 6,
    annual: 12,
  };
  const size = chunkSize[granularity];
  const months = filtered.map((s) => s.referenceMonth);
  const chunks = chunkMonths(months, size);

  return chunks.map((chunk) => {
    const chunkSummaries = filtered.filter((s) => chunk.includes(s.referenceMonth));
    return {
      label: groupLabel(chunk, granularity),
      months: chunk,
      dataJson: sumData(chunkSummaries),
    };
  });
}

export function mergeCompanySummaries(
  allSummaries: { companyId: string; companyName: string; summaries: MonthlySummary[] }[],
): MonthlySummary[] {
  // Collect all unique months
  const monthSet = new Set<string>();
  for (const { summaries } of allSummaries) {
    for (const s of summaries) monthSet.add(s.referenceMonth);
  }

  return [...monthSet].sort().map((month) => {
    const matching = allSummaries
      .map(({ summaries }) => summaries.find((s) => s.referenceMonth === month))
      .filter((s): s is MonthlySummary => s !== undefined);
    return {
      referenceMonth: month,
      dataJson: sumData(matching),
    };
  });
}
