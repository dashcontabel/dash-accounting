export type PeriodGranularity =
  | "monthly"
  | "bimonthly_1"
  | "bimonthly_2"
  | "quarterly_1"
  | "quarterly_2"
  | "semiannual_1"
  | "semiannual_2"
  | "annual"
  | "range";

export const PERIOD_LABELS: Record<PeriodGranularity, string> = {
  monthly: "Mensal",
  bimonthly_1: "1º Bimestre",
  bimonthly_2: "2º Bimestre",
  quarterly_1: "1º Trimestre",
  quarterly_2: "2º Trimestre",
  semiannual_1: "1º Semestre",
  semiannual_2: "2º Semestre",
  annual: "Anual",
  range: "Intervalo",
};

// Fixed calendar month ranges [from, to] (1-indexed, inclusive)
export const GRANULARITY_MONTH_RANGE: Partial<Record<PeriodGranularity, readonly [number, number]>> = {
  bimonthly_1:  [1, 2],
  bimonthly_2:  [3, 4],
  quarterly_1:  [1, 3],
  quarterly_2:  [4, 6],
  semiannual_1: [1, 6],
  semiannual_2: [7, 12],
  annual:       [1, 12],
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
  rangeFrom = "01",
  rangeTo = "12",
): AggregatedPeriod[] {
  const yearFiltered = summaries
    .filter((s) => s.referenceMonth.startsWith(year))
    .sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth));

  if (granularity === "monthly") {
    return yearFiltered.map((s) => ({
      label: `${monthLabel(s.referenceMonth)}/${year.slice(2)}`,
      months: [s.referenceMonth],
      dataJson: s.dataJson,
    }));
  }

  // Determine the month range for the selected granularity
  let fromMon: string;
  let toMon: string;

  if (granularity === "range") {
    fromMon = rangeFrom;
    toMon = rangeTo;
  } else {
    const fixedRange = GRANULARITY_MONTH_RANGE[granularity];
    if (!fixedRange) return [];
    fromMon = String(fixedRange[0]).padStart(2, "0");
    toMon   = String(fixedRange[1]).padStart(2, "0");
  }

  const fromYM = `${year}-${fromMon}`;
  const toYM   = `${year}-${toMon}`;

  const rangeFiltered = yearFiltered.filter(
    (s) => s.referenceMonth >= fromYM && s.referenceMonth <= toYM,
  );

  if (rangeFiltered.length === 0) return [];

  const months = rangeFiltered.map((s) => s.referenceMonth);
  return [{ label: groupLabel(months, granularity), months, dataJson: sumData(rangeFiltered) }];
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
