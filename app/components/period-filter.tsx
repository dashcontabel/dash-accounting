"use client";

import { useEffect, useState } from "react";
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
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (window.innerWidth < 640) setOpen(false);
  }, []);

  const summaryLabel = year
    ? `${PERIOD_LABELS[granularity]} · ${granularity === "monthly" && month ? `${MONTH_LABELS[month] ?? month}/${year}` : year}`
    : "—";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800/60">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5"
      >
        <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          {open ? "Período" : summaryLabel}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 dark:text-zinc-500 ${open ? "rotate-180" : "rotate-0"}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible body */}
      {open && (
        <div className="border-t border-zinc-100 px-3 pb-3 pt-3 dark:border-zinc-700/50">
          <div className="flex flex-col gap-2.5">
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
        </div>
      )}
    </div>
  );
}
