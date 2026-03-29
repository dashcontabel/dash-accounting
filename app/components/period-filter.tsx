"use client";

import { PERIOD_LABELS, type PeriodGranularity } from "@/lib/dashboard/periods";

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

const ALL_GRANULARITIES: PeriodGranularity[] = [
  "monthly",
  "bimonthly",
  "quarterly",
  "semiannual",
  "annual",
];

export default function PeriodFilter({
  granularity,
  year,
  month,
  years,
  monthsForYear,
  onGranularityChange,
  onYearChange,
  onMonthChange,
}: {
  granularity: PeriodGranularity;
  year: string;
  month: string;
  years: string[];
  monthsForYear: string[]; // "YYYY-MM"
  onGranularityChange: (g: PeriodGranularity) => void;
  onYearChange: (y: string) => void;
  onMonthChange: (m: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      {/* Granularity toggle buttons */}
      <div className="flex flex-wrap gap-1.5">
        {ALL_GRANULARITIES.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => onGranularityChange(g)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              granularity === g
                ? "bg-[#0f4c81] text-white dark:bg-blue-600"
                : "border border-zinc-200 bg-white text-zinc-600 hover:border-[#0f4c81]/40 hover:text-[#0f4c81] dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-blue-500/40 dark:hover:text-blue-400"
            }`}
          >
            {PERIOD_LABELS[g]}
          </button>
        ))}
      </div>

      {/* Year + optional month selectors */}
      <div className="flex flex-wrap gap-2">
        <select
          value={year}
          onChange={(e) => onYearChange(e.target.value)}
          disabled={years.length === 0}
          className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm outline-none transition focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/10 disabled:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-blue-500 dark:focus:ring-blue-500/10 dark:disabled:bg-zinc-700"
        >
          {years.length === 0 ? <option value="">—</option> : null}
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {granularity === "monthly" && (
          <select
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
            disabled={monthsForYear.length === 0}
            className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm outline-none transition focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/10 disabled:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-blue-500 dark:focus:ring-blue-500/10 dark:disabled:bg-zinc-700"
          >
            {monthsForYear.length === 0 ? <option value="">—</option> : null}
            {monthsForYear.map((ym) => {
              const m = ym.slice(5, 7);
              return (
                <option key={m} value={m}>
                  {MONTH_LABELS[m] ?? m}
                </option>
              );
            })}
          </select>
        )}
      </div>
    </div>
  );
}
