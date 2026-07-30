import type { CompanyData } from "./types";

export const RENTABILIDADE_MONTHS = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
] as const;

export type RentabilidadeMonth = (typeof RENTABILIDADE_MONTHS)[number];

export const RENTABILIDADE_MONTH_LABELS: Record<RentabilidadeMonth, string> = {
  "01": "Jan",
  "02": "Fev",
  "03": "Mar",
  "04": "Abr",
  "05": "Mai",
  "06": "Jun",
  "07": "Jul",
  "08": "Ago",
  "09": "Set",
  "10": "Out",
  "11": "Nov",
  "12": "Dez",
};

export type RentabilidadeMonthColumn = {
  kind: "month";
  key: string;
  label: string;
  month: RentabilidadeMonth;
  quarter: number;
};

export type RentabilidadeQuarterColumn = {
  kind: "quarter";
  key: string;
  label: string;
  quarter: number;
  months: string[];
};

export type RentabilidadeColumn =
  | RentabilidadeMonthColumn
  | RentabilidadeQuarterColumn;

export type RentabilidadeMonthDetail = {
  grossYield: number | null;
  taxWithheld: number | null;
  netYield: number | null;
  closingBalance: number | null;
  hasData: boolean;
};

export type RentabilidadeRow = {
  companyId: string;
  companyName: string;
  openingBalance: number | null;
  finalBalance: number | null;
  accumulatedGrossYield: number | null;
  accumulatedTaxWithheld: number | null;
  accumulatedNetYield: number | null;
  months: Record<string, RentabilidadeMonthDetail>;
  quarters: Record<string, number | null>;
};

export type RentabilidadeStatement = {
  year: string;
  rangeFrom: RentabilidadeMonth;
  rangeTo: RentabilidadeMonth;
  columns: RentabilidadeColumn[];
  rows: RentabilidadeRow[];
  totalRow: RentabilidadeRow;
};

function isRentabilidadeMonth(value: string): value is RentabilidadeMonth {
  return (RENTABILIDADE_MONTHS as readonly string[]).includes(value);
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function normalizeMonth(value: string, fallback: RentabilidadeMonth): RentabilidadeMonth {
  return isRentabilidadeMonth(value) ? value : fallback;
}

export function normalizeMonthRange(
  fromMonth: string,
  toMonth: string,
): [RentabilidadeMonth, RentabilidadeMonth] {
  const from = normalizeMonth(fromMonth, "01");
  const to = normalizeMonth(toMonth, "12");
  return from <= to ? [from, to] : [to, from];
}

export function getMonthKeysInRange(
  fromMonth: string,
  toMonth: string,
): RentabilidadeMonth[] {
  const [from, to] = normalizeMonthRange(fromMonth, toMonth);
  return RENTABILIDADE_MONTHS.filter((month) => month >= from && month <= to);
}

function quarterOf(month: RentabilidadeMonth): number {
  return Math.ceil(Number(month) / 3);
}

export function getRentabilidadeColumns(
  year: string,
  fromMonth: string,
  toMonth: string,
): RentabilidadeColumn[] {
  const months = getMonthKeysInRange(fromMonth, toMonth);
  const columns: RentabilidadeColumn[] = [];

  for (let index = 0; index < months.length; index++) {
    const month = months[index]!;
    const quarter = quarterOf(month);
    columns.push({
      kind: "month",
      key: `${year}-${month}`,
      label: `${RENTABILIDADE_MONTH_LABELS[month]}.${year}`,
      month,
      quarter,
    });

    const next = months[index + 1];
    if (!next || quarterOf(next) !== quarter) {
      const quarterMonths = months
        .filter((candidate) => quarterOf(candidate) === quarter)
        .map((candidate) => `${year}-${candidate}`);

      columns.push({
        kind: "quarter",
        key: `Q${quarter}`,
        label: `Rentab. liq. ${quarter}T/${year.slice(2)}`,
        quarter,
        months: quarterMonths,
      });
    }
  }

  return columns;
}

function valueFromSummary(
  dataJson: Record<string, number>,
  field: string,
): number {
  return dataJson[field] ?? 0;
}

function netYieldFromSummary(dataJson: Record<string, number>): number {
  if (dataJson.RENTABILIDADE !== undefined) {
    return valueFromSummary(dataJson, "RENTABILIDADE");
  }

  return roundMoney(
    valueFromSummary(dataJson, "RENDIMENTO_BRUTO") -
      valueFromSummary(dataJson, "IOF_IRRF"),
  );
}

function sumNullable(values: Array<number | null>): number | null {
  let total = 0;
  let hasValue = false;

  for (const value of values) {
    if (value === null) continue;
    total += value;
    hasValue = true;
  }

  return hasValue ? roundMoney(total) : null;
}

function buildSummaryMap(company: CompanyData): Map<string, Record<string, number>> {
  const map = new Map<string, Record<string, number>>();
  for (const summary of company.summaries) {
    map.set(summary.referenceMonth.slice(0, 7), summary.dataJson);
  }
  return map;
}

function buildCompanyRow(
  company: CompanyData,
  year: string,
  fromMonth: RentabilidadeMonth,
  toMonth: RentabilidadeMonth,
): RentabilidadeRow {
  const summaryMap = buildSummaryMap(company);
  const previousYear = String(Number(year) - 1);
  const openingSummary = summaryMap.get(`${previousYear}-12`);
  const finalSummary = summaryMap.get(`${year}-${toMonth}`);
  const monthKeys = getMonthKeysInRange(fromMonth, toMonth).map(
    (month) => `${year}-${month}`,
  );

  const months: Record<string, RentabilidadeMonthDetail> = {};
  for (const referenceMonth of monthKeys) {
    const dataJson = summaryMap.get(referenceMonth);
    months[referenceMonth] = dataJson
      ? {
          grossYield: roundMoney(valueFromSummary(dataJson, "RENDIMENTO_BRUTO")),
          taxWithheld: roundMoney(valueFromSummary(dataJson, "IOF_IRRF")),
          netYield: roundMoney(netYieldFromSummary(dataJson)),
          closingBalance:
            dataJson.SD_BANCARIO === undefined
              ? null
              : roundMoney(valueFromSummary(dataJson, "SD_BANCARIO")),
          hasData: true,
        }
      : {
          grossYield: null,
          taxWithheld: null,
          netYield: null,
          closingBalance: null,
          hasData: false,
        };
  }

  const quarters: Record<string, number | null> = {};
  for (let quarter = 1; quarter <= 4; quarter++) {
    const quarterValues = monthKeys
      .filter((referenceMonth) => quarterOf(referenceMonth.slice(5, 7) as RentabilidadeMonth) === quarter)
      .map((referenceMonth) => months[referenceMonth]?.netYield ?? null);
    quarters[`Q${quarter}`] = sumNullable(quarterValues);
  }

  return {
    companyId: company.companyId,
    companyName: company.companyName,
    openingBalance:
      openingSummary?.SD_BANCARIO === undefined
        ? null
        : roundMoney(valueFromSummary(openingSummary, "SD_BANCARIO")),
    finalBalance:
      finalSummary?.SD_BANCARIO === undefined
        ? null
        : roundMoney(valueFromSummary(finalSummary, "SD_BANCARIO")),
    accumulatedGrossYield: sumNullable(
      monthKeys.map((referenceMonth) => months[referenceMonth]?.grossYield ?? null),
    ),
    accumulatedTaxWithheld: sumNullable(
      monthKeys.map((referenceMonth) => months[referenceMonth]?.taxWithheld ?? null),
    ),
    accumulatedNetYield: sumNullable(
      monthKeys.map((referenceMonth) => months[referenceMonth]?.netYield ?? null),
    ),
    months,
    quarters,
  };
}

function buildTotalRow(rows: RentabilidadeRow[], monthKeys: string[]): RentabilidadeRow {
  const months: Record<string, RentabilidadeMonthDetail> = {};
  for (const referenceMonth of monthKeys) {
    const monthDetails = rows.map((row) => row.months[referenceMonth]);
    months[referenceMonth] = {
      grossYield: sumNullable(monthDetails.map((detail) => detail?.grossYield ?? null)),
      taxWithheld: sumNullable(monthDetails.map((detail) => detail?.taxWithheld ?? null)),
      netYield: sumNullable(monthDetails.map((detail) => detail?.netYield ?? null)),
      closingBalance: sumNullable(monthDetails.map((detail) => detail?.closingBalance ?? null)),
      hasData: monthDetails.some((detail) => detail?.hasData),
    };
  }

  const quarters: Record<string, number | null> = {};
  for (let quarter = 1; quarter <= 4; quarter++) {
    quarters[`Q${quarter}`] = sumNullable(rows.map((row) => row.quarters[`Q${quarter}`] ?? null));
  }

  return {
    companyId: "__total__",
    companyName: "TOTAL",
    openingBalance: sumNullable(rows.map((row) => row.openingBalance)),
    finalBalance: sumNullable(rows.map((row) => row.finalBalance)),
    accumulatedGrossYield: sumNullable(rows.map((row) => row.accumulatedGrossYield)),
    accumulatedTaxWithheld: sumNullable(rows.map((row) => row.accumulatedTaxWithheld)),
    accumulatedNetYield: sumNullable(rows.map((row) => row.accumulatedNetYield)),
    months,
    quarters,
  };
}

export function buildRentabilidadeStatement(
  companies: CompanyData[],
  year: string,
  fromMonth: string,
  toMonth: string,
): RentabilidadeStatement {
  const [normalizedFrom, normalizedTo] = normalizeMonthRange(fromMonth, toMonth);
  const columns = getRentabilidadeColumns(year, normalizedFrom, normalizedTo);
  const rows = companies.map((company) =>
    buildCompanyRow(company, year, normalizedFrom, normalizedTo),
  );
  const monthKeys = getMonthKeysInRange(normalizedFrom, normalizedTo).map(
    (month) => `${year}-${month}`,
  );

  return {
    year,
    rangeFrom: normalizedFrom,
    rangeTo: normalizedTo,
    columns,
    rows,
    totalRow: buildTotalRow(rows, monthKeys),
  };
}
