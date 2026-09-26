"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LabelList,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";

import AppShell from "./components/app-shell";
import MultiCompanySelect from "./components/multi-company-select";
import PeriodFilter from "./components/period-filter";
import NotificationsBell from "./components/notifications-bell";
import DataFreshnessBadge from "./components/data-freshness-badge";
import CostCenterSection from "./components/cost-center-section";
import TenantSection from "./components/tenant-section";
// Heavy chart — loaded only on the client to reduce server bundle size
const HeatmapChart = dynamic(() => import("./components/heatmap-chart"), { ssr: false });
const RazaoTransactionsModal = dynamic(() => import("./components/razao-transactions-modal"), { ssr: false });
import { useTheme } from "./components/theme-provider";
import {
  aggregateSummaries,
  mergeCompanySummaries,
  PERIOD_LABELS,
  type PeriodGranularity,
  type MonthlySummary,
} from "@/lib/dashboard/periods";
import { companyDataCache, consumeStaleCompanyIds, markCompanyStale } from "@/lib/dashboard/cache";
import { DETAILED_EXPENSE_FIELDS } from "@/lib/dashboard/expense-fields";
import { useDashboardFreshness } from "@/lib/dashboard/freshness";
import { calculateProfitMargin } from "@/lib/dashboard/profit-margin";
import { getRevenueCardLabels } from "@/lib/dashboard/revenue-card-labels";
import type { CompanyData } from "@/lib/dashboard/types";

type MeResponse = {
  user?: {
    id: string;
    email: string;
    name: string | null;
    role: "ADMIN" | "CLIENT";
    status: "ACTIVE" | "INACTIVE";
  };
  allowedCompanies?: Array<{ id: string; name: string; groupId: string }>;
  activeCompanyId?: string | null;
  error?: string;
};

type DashboardData = Record<string, number>;

type BankBalanceCompany = {
  companyId: string;
  companyName: string;
  referenceMonth: string | null;
  total: number;
  accounts: Array<{
    accountCode: string;
    accountName: string;
    balance: number;
  }>;
};

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

function formatCurrency(value: number | undefined) {
  if (value === undefined || value === null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCurrencyShort(value: number) {
  if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return formatCurrency(value);
}

function formatPercentage(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("pt-BR", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function get(data: DashboardData, field: string): number {
  return data[field] ?? 0;
}

// ── KPI Card ────────────────────────────────────────────────────────────────

const COLOR_MAP = {
  blue: {
    card: "border-blue-200/80 bg-white/95 dark:border-blue-900/60 dark:bg-zinc-900/90",
    value: "text-blue-700 dark:text-blue-300",
    icon: "bg-blue-50 text-blue-600 dark:bg-blue-950/70 dark:text-blue-400",
    accent: "from-blue-600 via-blue-500 to-cyan-400",
    glow: "bg-blue-400/15 dark:bg-blue-500/10",
    dot: "bg-blue-500",
  },
  green: {
    card: "border-emerald-200/80 bg-white/95 dark:border-emerald-900/60 dark:bg-zinc-900/90",
    value: "text-emerald-700 dark:text-emerald-300",
    icon: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400",
    accent: "from-emerald-600 via-emerald-500 to-lime-400",
    glow: "bg-emerald-400/15 dark:bg-emerald-500/10",
    dot: "bg-emerald-500",
  },
  red: {
    card: "border-red-200/80 bg-white/95 dark:border-red-900/60 dark:bg-zinc-900/90",
    value: "text-red-700 dark:text-red-300",
    icon: "bg-red-50 text-red-600 dark:bg-red-950/70 dark:text-red-400",
    accent: "from-red-600 via-red-500 to-orange-400",
    glow: "bg-red-400/15 dark:bg-red-500/10",
    dot: "bg-red-500",
  },
  amber: {
    card: "border-amber-200/80 bg-white/95 dark:border-amber-900/60 dark:bg-zinc-900/90",
    value: "text-amber-700 dark:text-amber-300",
    icon: "bg-amber-50 text-amber-600 dark:bg-amber-950/70 dark:text-amber-400",
    accent: "from-amber-600 via-amber-500 to-yellow-400",
    glow: "bg-amber-400/15 dark:bg-amber-500/10",
    dot: "bg-amber-500",
  },
  purple: {
    card: "border-purple-200/80 bg-white/95 dark:border-purple-900/60 dark:bg-zinc-900/90",
    value: "text-purple-700 dark:text-purple-300",
    icon: "bg-purple-50 text-purple-600 dark:bg-purple-950/70 dark:text-purple-400",
    accent: "from-purple-600 via-violet-500 to-fuchsia-400",
    glow: "bg-purple-400/15 dark:bg-purple-500/10",
    dot: "bg-purple-500",
  },
  teal: {
    card: "border-teal-200/80 bg-white/95 dark:border-teal-900/60 dark:bg-zinc-900/90",
    value: "text-teal-700 dark:text-teal-300",
    icon: "bg-teal-50 text-teal-600 dark:bg-teal-950/70 dark:text-teal-400",
    accent: "from-teal-600 via-teal-500 to-cyan-400",
    glow: "bg-teal-400/15 dark:bg-teal-500/10",
    dot: "bg-teal-500",
  },
} as const;

type KpiColor = keyof typeof COLOR_MAP;

const DIVISION_MAP = {
  blue: {
    container: "border-blue-200 bg-blue-500/10 dark:border-blue-900/30 dark:bg-blue-950/10",
    icon: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400",
    title: "text-blue-800 dark:text-blue-300",
    divider: "bg-blue-400/75 dark:bg-blue-700/75",
  },
  green: {
    container: "border-emerald-200 bg-emerald-500/10 dark:border-emerald-900/30 dark:bg-emerald-950/10",
    icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400",
    title: "text-emerald-800 dark:text-emerald-300",
    divider: "bg-emerald-400/75 dark:bg-emerald-700/75",
  },
  teal: {
    container: "border-teal-200 bg-teal-500/10 dark:border-teal-900/30 dark:bg-teal-950/10",
    icon: "bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400",
    title: "text-teal-800 dark:text-teal-300",
    divider: "bg-teal-400/75 dark:bg-teal-700/75",
  },
  red: {
    container: "border-red-200 bg-red-500/10 dark:border-red-900/30 dark:bg-red-950/10",
    icon: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400",
    title: "text-red-800 dark:text-red-300",
    divider: "bg-red-400/75 dark:bg-red-700/75",
  },
  purple: {
    container: "border-purple-200 bg-purple-500/10 dark:border-purple-900/30 dark:bg-purple-950/10",
    icon: "bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400",
    title: "text-purple-800 dark:text-purple-300",
    divider: "bg-purple-400/75 dark:bg-purple-700/75",
  },
} as const;

type DivisionColor = keyof typeof DIVISION_MAP;

function DashboardDivision({
  id,
  title,
  color,
  icon,
  total,
  children,
}: {
  id: string;
  title: string;
  color: DivisionColor;
  icon: React.ReactNode;
  total?: number;
  children: React.ReactNode;
}) {
  const styles = DIVISION_MAP[color];

  return (
    <section aria-labelledby={id} className={`rounded-2xl border p-5 sm:p-6 ${styles.container}`}>
      <div className="mb-4 flex items-center gap-2">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${styles.icon}`}>
          {icon}
        </span>
        <h2 id={id} className={`text-sm font-bold ${styles.title}`}>{title}</h2>
        <div data-division-divider="true" className={`ml-2 h-0.5 flex-1 rounded-full ${styles.divider}`} />
        {total !== undefined ? (
          <p
            aria-label={`${title}: total`}
            data-division-total="true"
            className={`shrink-0 whitespace-nowrap text-sm font-extrabold tracking-tight tabular-nums sm:text-base ${styles.title}`}
          >
            <span className="sr-only">Total: </span>
            {formatCurrency(total)}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function KpiCard({
  label,
  value,
  color = "blue",
  sub,
  icon,
  onDrillDown,
}: {
  label: string;
  value: number | undefined;
  color?: KpiColor;
  sub?: string;
  icon?: React.ReactNode;
  onDrillDown?: () => void;
}) {
  const c = COLOR_MAP[color];
  // Only allow drill-down when there is an actual non-zero value to inspect
  const interactive = !!onDrillDown && !!value && value !== 0;
  const formattedValue = formatCurrency(value);

  return (
    <article
      className={`group relative flex min-h-[9.5rem] min-w-0 flex-col overflow-hidden rounded-xl border p-5 shadow-sm backdrop-blur-sm transition-all duration-200 xl:p-4 2xl:p-5 ${c.card} ${interactive ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950" : ""}`}
      onClick={interactive ? onDrillDown : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onDrillDown!();
        }
      } : undefined}
    >
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${c.accent}`} />
      <span aria-hidden="true" className={`absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl ${c.glow}`} />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-semibold uppercase leading-snug tracking-[0.08em] text-zinc-600 dark:text-zinc-300">{label}</p>
        {icon && (
          <span data-kpi-icon="true" className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-black/5 dark:ring-white/10 ${c.icon}`}>
            {icon}
            {interactive && (
              <>
                <span
                  aria-hidden="true"
                  data-detail-indicator="true"
                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-600 text-white shadow-sm ring-2 ring-white motion-safe:animate-pulse dark:bg-zinc-300 dark:text-zinc-900 dark:ring-zinc-900"
                >
                  <svg className="h-2 w-2 transition-transform duration-300 motion-safe:group-hover:-rotate-12 motion-safe:group-hover:scale-125 motion-reduce:transition-none" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                </span>
                <span className="sr-only">Detalhamento disponível</span>
              </>
            )}
          </span>
        )}
      </div>

      <div className="relative z-10 mt-auto pt-6">
        <p title={formattedValue} className={`min-w-0 truncate text-2xl font-extrabold leading-none tracking-tight tabular-nums sm:text-3xl xl:text-xl 2xl:text-2xl ${c.value}`}>
          {formattedValue}
        </p>
        {sub ? (
          <div className="mt-4 flex items-center gap-2 border-t border-zinc-200/80 pt-3 dark:border-zinc-800">
            <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} />
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{sub}</p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function MarginKpiCard({ value }: { value: number | null }) {
  const color: KpiColor = value === null ? "purple" : value < 0 ? "red" : "green";
  const c = COLOR_MAP[color];
  const formattedValue = formatPercentage(value);
  const signalProgress = value === null ? 0 : Math.min(Math.abs(value) * 100, 100);
  const ringGradient = value === null
    ? { start: "#7c3aed", end: "#d946ef" }
    : value < 0
      ? { start: "#dc2626", end: "#fb923c" }
      : { start: "#059669", end: "#a3e635" };

  return (
    <article
      aria-label={`Margem de Lucro: ${formattedValue}`}
      className={`relative flex min-h-[9.5rem] min-w-0 flex-col overflow-hidden rounded-xl border p-5 shadow-sm backdrop-blur-sm xl:p-4 2xl:p-5 ${c.card}`}
    >
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${c.accent}`} />
      <span aria-hidden="true" className={`absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl ${c.glow}`} />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-semibold uppercase leading-snug tracking-[0.08em] text-zinc-600 dark:text-zinc-300">
          Margem de Lucro
        </p>
        <span
          data-kpi-icon="true"
          className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-black/5 dark:ring-white/10 ${c.icon}`}
        >
          {Icons.percentage}
        </span>
      </div>

      <div className="relative z-10 mt-auto pt-2">
        <div className="flex justify-center">
          <div data-margin-ring="true" className="relative h-20 w-20">
            <svg aria-hidden="true" viewBox="0 0 100 100" className="h-full w-full overflow-visible drop-shadow-sm">
              <defs>
                <linearGradient id="profit-margin-ring-gradient" x1="15" y1="85" x2="85" y2="15" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor={ringGradient.start} />
                  <stop offset="100%" stopColor={ringGradient.end} />
                </linearGradient>
              </defs>
              <circle
                cx="50"
                cy="50"
                r="41"
                fill="none"
                strokeWidth="9"
                className="stroke-zinc-200 dark:stroke-zinc-800"
              />
              <circle
                data-margin-signal="true"
                cx="50"
                cy="50"
                r="41"
                pathLength="100"
                fill="none"
                stroke="url(#profit-margin-ring-gradient)"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray="100"
                className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
                style={{ strokeDashoffset: 100 - signalProgress }}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <p
              title={formattedValue}
              className={`absolute inset-0 flex min-w-0 items-center justify-center whitespace-nowrap text-base font-extrabold leading-none tracking-tight tabular-nums ${c.value}`}
            >
              {formattedValue}
            </p>
          </div>
        </div>
        <div className="mt-1 border-t border-zinc-200/80 pt-2 dark:border-zinc-800">
          <div className="flex items-center justify-center gap-1.5 text-center text-[10px] font-medium leading-none text-zinc-500 dark:text-zinc-400">
            <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} />
            <span>{value === null ? "Receitas zeradas" : "Resultado ÷ receitas"}</span>
            <span className="font-mono uppercase tracking-wide">%</span>
          </div>
        </div>
      </div>
    </article>
  );
}

// ── Recharts tooltip formatter ──────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function currencyTooltipFormatter(value: any) {
  if (typeof value !== "number") return ["", ""];
  return [formatCurrency(value), ""];
}

// ── Icons ───────────────────────────────────────────────────────────────────

const Icons = {
  trending: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  trendingDown: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8-8-8-4 4-6-6" />
    </svg>
  ),
  invoice: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  bank: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  tax: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  chart: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  dollar: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  building: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  profit: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 3l-5 5-5-5" />
    </svg>
  ),
  percentage: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 5L5 19" />
      <circle cx="7" cy="7" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  ),
};

export default function Home() {
  const router = useRouter();
  const { theme } = useTheme();
  const chartTheme = {
    grid: theme === "dark" ? "#2d3748" : "#e4e4e7",
    tick: theme === "dark" ? "#6b7280" : "#a1a1aa",
    tooltip: theme === "dark"
      ? { background: "#1c2128", border: "#30363d", label: "#e6edf3" }
      : { background: "#ffffff", border: "#e4e4e7", label: "#18181b" },
  };
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"ADMIN" | "CLIENT" | null>(null);
  const [allowedCompanies, setAllowedCompanies] = useState<
    Array<{ id: string; name: string; groupId: string }>
  >([]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [contextMessage, setContextMessage] = useState<string | null>(null);

  const [companiesData, setCompaniesData] = useState<CompanyData[]>([]);
  const [granularity, setGranularity] = useState<PeriodGranularity>("monthly");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [rangeFrom, setRangeFrom] = useState("01");
  const [rangeTo, setRangeTo] = useState("12");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcMsg, setRecalcMsg] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [draftGranularity, setDraftGranularity] = useState<PeriodGranularity>("monthly");
  const [draftYear, setDraftYear] = useState("");
  const [draftMonth, setDraftMonth] = useState("");
  const [draftRangeFrom, setDraftRangeFrom] = useState("01");
  const [draftRangeTo, setDraftRangeTo] = useState("12");
  const [isSyncing, setIsSyncing] = useState(false);
  const [drillDown, setDrillDown] = useState<{
    accountCode: string | null;
    accountCodes?: string[];
    excludeDashboardFields?: string[];
    label: string;
  } | null>(null);
  const [mappingCodes, setMappingCodes] = useState<Record<string, string[]>>({});
  const [expenseDetailEntries, setExpenseDetailEntries] = useState<{ name: string; value: number; fill: string }[]>([]);
  const [bankBalanceCompanies, setBankBalanceCompanies] = useState<BankBalanceCompany[]>([]);
  const [loadingBankBalances, setLoadingBankBalances] = useState(false);

  // ── Freshness polling + notifications ──────────────────────────────────────

  const {
    staleCompanyIds,
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    clearStale,
    refreshBaseline,
  } = useDashboardFreshness({
    // Monitor only the active selection to keep polling cost proportional to
    // what the user is currently viewing.
    companyIds: selectedCompanyIds,
    companiesData,
    allCompanies: allowedCompanies,
  });

  // ── Auth & company list ──────────────────────────────────────────────────

  useEffect(() => {
    let isMounted = true;

    async function loadMe() {
      // Evict any companies flagged as stale by the imports page (import/delete).
      for (const id of consumeStaleCompanyIds()) {
        companyDataCache.delete(id);
      }

      try {
        const [response, fieldCodesRes] = await Promise.all([
          fetch("/api/auth/me", { cache: "no-store" }),
          fetch("/api/dashboard/field-codes", { cache: "no-store" }),
        ]);
        const data = (await response.json()) as MeResponse;
        if (fieldCodesRes.ok) {
          const fc = (await fieldCodesRes.json()) as { fieldCodes?: Record<string, string[]> };
          if (isMounted) setMappingCodes(fc.fieldCodes ?? {});
        }

        if (!response.ok || !data.user) {
          router.push("/login");
          return;
        }

        if (isMounted) {
          const companies = data.allowedCompanies ?? [];
          const initialCompanyId =
            data.activeCompanyId ?? companies[0]?.id ?? "";

          setUserEmail(data.user.email);
          setUserRole(data.user.role);
          setAllowedCompanies(companies);
          setSelectedCompanyIds(initialCompanyId ? [initialCompanyId] : []);
        }
      } catch {
        router.push("/login");
      }
    }

    void loadMe();
    return () => { isMounted = false; };
  }, [router]);

  // ── Load summaries when selected companies change ────────────────────────

  const loadSummaries = useCallback(async (ids: string[]) => {
    if (ids.length === 0) { setCompaniesData([]); return; }

    // Only fetch companies that are not yet in the module-level cache.
    const missingIds = ids.filter((id) => !companyDataCache.has(id));

    if (missingIds.length > 0) {
      setLoadingSummary(true);
      try {
        const params = new URLSearchParams();
        for (const id of missingIds) params.append("companyId", id);
        const res = await fetch(`/api/dashboard/summary?${params.toString()}`);
        if (res.ok) {
          const body = (await res.json()) as { companies: CompanyData[] };
          for (const c of body.companies) {
            companyDataCache.set(c.companyId, {
              ...c,
              // Normalize referenceMonth from ISO DateTime ("YYYY-MM-01T00:00:00.000Z") to "YYYY-MM"
              summaries: c.summaries.map((s) => ({
                ...s,
                referenceMonth: s.referenceMonth.slice(0, 7),
              })),
            });
          }
        }
      } catch {
        // non-fatal: companies not added to cache will simply be absent from the view
      } finally {
        setLoadingSummary(false);
      }
    }

    setCompaniesData(
      ids.map((id) => companyDataCache.get(id)).filter(Boolean) as CompanyData[],
    );
  }, []);

  useEffect(() => {
    void loadSummaries(selectedCompanyIds);
  }, [selectedCompanyIds, loadSummaries]);

  // ── Derived state ────────────────────────────────────────────────────────

  // Merge summaries across selected companies (union of all months, summed fields)
  const mergedSummaries = useMemo(
    () => mergeCompanySummaries(companiesData),
    [companiesData],
  );

  const years = useMemo(
    () => [...new Set(mergedSummaries.map((s) => s.referenceMonth.slice(0, 4)))].sort(),
    [mergedSummaries],
  );

  const monthsForYear = useMemo(
    () => mergedSummaries.filter((s) => s.referenceMonth.startsWith(selectedYear)).map((s) => s.referenceMonth),
    [mergedSummaries, selectedYear],
  );

  // Aggregated periods for charts (grouped by granularity)
  const aggregatedPeriods = useMemo(
    () => aggregateSummaries(mergedSummaries, granularity, selectedYear, rangeFrom, rangeTo),
    [mergedSummaries, granularity, selectedYear, rangeFrom, rangeTo],
  );

  // For non-monthly granularities, the active period is the last (most recent) chunk.
  // "caso não tenha" = last period may be partial — that's fine, it's still the latest data.
  const activePeriod = useMemo(
    () => (granularity === "monthly" ? null : (aggregatedPeriods[aggregatedPeriods.length - 1] ?? null)),
    [granularity, aggregatedPeriods],
  );

  // Reset year/month when summaries reload — prefer current month, fall back to last available
  useEffect(() => {
    if (mergedSummaries.length > 0) {
      const now = new Date();
      const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const hasCurrent = mergedSummaries.some((s) => s.referenceMonth === currentYM);
      const target = hasCurrent
        ? currentYM
        : mergedSummaries[mergedSummaries.length - 1]!.referenceMonth;
      const [y, m] = target.split("-");
      setSelectedYear(y ?? "");
      setSelectedMonth(m ?? "");
    } else {
      setSelectedYear("");
      setSelectedMonth("");
    }
  }, [mergedSummaries]);

  // Active KPI data:
  //   monthly   → selected month
  //   otherwise → last aggregated period (last bimestral/trimestral/etc. chunk)
  const activeSummary = useMemo(() => {
    if (granularity === "monthly") {
      return mergedSummaries.find((s) => s.referenceMonth === `${selectedYear}-${selectedMonth}`);
    }
    if (!activePeriod) return undefined;
    return { referenceMonth: activePeriod.label, dataJson: activePeriod.dataJson };
  }, [mergedSummaries, granularity, selectedYear, selectedMonth, activePeriod]);

  const d = activeSummary?.dataJson ?? {};
  const profitMargin = calculateProfitMargin(d);

  const bankBalanceEndMonth = useMemo(() => {
    if (!selectedYear) return "";
    if (granularity === "monthly") {
      return selectedMonth ? `${selectedYear}-${selectedMonth}` : "";
    }
    return activePeriod?.months.at(-1) ?? "";
  }, [activePeriod, granularity, selectedMonth, selectedYear]);

  useEffect(() => {
    if (selectedCompanyIds.length === 0 || !bankBalanceEndMonth) {
      setBankBalanceCompanies([]);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({ endMonth: bankBalanceEndMonth });
    for (const companyId of selectedCompanyIds) params.append("companyId", companyId);

    setLoadingBankBalances(true);
    void fetch(`/api/dashboard/bank-balances?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return { companies: [] as BankBalanceCompany[] };
        return response.json() as Promise<{ companies: BankBalanceCompany[] }>;
      })
      .then((body) => {
        if (!controller.signal.aborted) setBankBalanceCompanies(body.companies ?? []);
      })
      .catch(() => {
        if (!controller.signal.aborted) setBankBalanceCompanies([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingBankBalances(false);
      });

    return () => controller.abort();
  }, [bankBalanceEndMonth, companiesData, selectedCompanyIds]);

  const bankBalanceCards = useMemo(
    () => bankBalanceCompanies.flatMap((company) =>
      (company.accounts ?? []).map((account) => ({
        ...account,
        companyId: company.companyId,
        companyName: company.companyName,
        referenceMonth: company.referenceMonth,
      })),
    ),
    [bankBalanceCompanies],
  );

  const bankBalanceTotal = bankBalanceCompanies.length > 0
    ? bankBalanceCompanies.reduce((sum, company) => sum + company.total, 0)
    : get(d, "SD_BANCARIO");

  const investmentsTotal =
    get(d, "LRA2_INVEST") +
    get(d, "LRA3_INVEST") +
    get(d, "B_VISTA_INVEST") +
    get(d, "TRAPICHE_INVEST");
  const investmentAccountCodes = [
    ...(mappingCodes["LRA2_INVEST"] ?? []),
    ...(mappingCodes["LRA3_INVEST"] ?? []),
    ...(mappingCodes["B_VISTA_INVEST"] ?? []),
    ...(mappingCodes["TRAPICHE_INVEST"] ?? []),
  ];

  // Chart series:
  //   monthly   → one bar per month in the selected year
  //   otherwise → one bar per individual month inside the active period
  const chartSeries = useMemo(() => {
    if (granularity === "monthly") {
      return aggregatedPeriods.map((p) => ({
        period: p.label,
        Faturamento: p.dataJson["FATURAMENTO"] ?? 0,
        Despesas: p.dataJson["DESPESAS_TOTAL"] ?? 0,
        Resultado: p.dataJson["RESULTADO"] ?? 0,
      }));
    }
    const months = activePeriod?.months ?? [];
    return mergedSummaries
      .filter((s) => months.includes(s.referenceMonth))
      .sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth))
      .map((s) => {
        const mm = s.referenceMonth.slice(5, 7);
        return {
          period: `${MONTH_LABELS[mm] ?? mm}/${selectedYear.slice(2)}`,
          Faturamento: s.dataJson["FATURAMENTO"] ?? 0,
          Despesas: s.dataJson["DESPESAS_TOTAL"] ?? 0,
          Resultado: s.dataJson["RESULTADO"] ?? 0,
        };
      });
  }, [granularity, activePeriod, aggregatedPeriods, mergedSummaries, selectedYear]);

  // Trend series: always monthly for the full year, regardless of active granularity
  const trendSeries = useMemo(() => {
    const yearData = aggregateSummaries(mergedSummaries, "monthly", selectedYear, "01", "12");
    return yearData.map((p) => ({
      period: p.label,
      Resultado: p.dataJson["RESULTADO"] ?? 0,
    }));
  }, [mergedSummaries, selectedYear]);

  // Per-company receitas series (for comparative bar chart when multi-company)
  const isMultiCompany = selectedCompanyIds.length > 1;
  const selectedCompanies = useMemo(
    () => selectedCompanyIds.flatMap((id) => {
      const company = allowedCompanies.find((candidate) => candidate.id === id);
      return company ? [company] : [];
    }),
    [allowedCompanies, selectedCompanyIds],
  );
  const revenueCardLabels = getRevenueCardLabels(selectedCompanies);
  // Drill-down available only for single-company monthly view (single referenceMonth is unambiguous)
  const canDrillDown = !isMultiCompany && granularity === "monthly" && !!selectedYear && !!selectedMonth;
  const COMPANY_COLORS = ["#10b981", "#0f4c81", "#f59e0b", "#ef4444", "#a855f7", "#0ea5e9"];

  const comparativeSeries = useMemo(() => {
    if (!isMultiCompany) return [];
    if (granularity === "monthly") {
      return aggregatedPeriods.map((period) => {
        const obj: Record<string, string | number> = { period: period.label };
        for (const company of companiesData) {
          const cPeriods = aggregateSummaries(company.summaries, granularity, selectedYear, rangeFrom, rangeTo);
          const match = cPeriods.find((cp) => cp.label === period.label);
          obj[company.companyName] = match?.dataJson["RECEITAS_TOTAL"] ?? 0;
        }
        return obj;
      });
    }
    const months = activePeriod?.months ?? [];
    return months.map((month) => {
      const mm = month.slice(5, 7);
      const label = `${MONTH_LABELS[mm] ?? mm}/${selectedYear.slice(2)}`;
      const obj: Record<string, string | number> = { period: label };
      for (const company of companiesData) {
        const s = company.summaries.find((cs) => cs.referenceMonth === month);
        obj[company.companyName] = s?.dataJson["RECEITAS_TOTAL"] ?? 0;
      }
      return obj;
    });
  }, [companiesData, aggregatedPeriods, granularity, selectedYear, isMultiCompany, activePeriod, rangeFrom, rangeTo]);

  const comparativeDespesasSeries = useMemo(() => {
    if (!isMultiCompany) return [];
    if (granularity === "monthly") {
      return aggregatedPeriods.map((period) => {
        const obj: Record<string, string | number> = { period: period.label };
        for (const company of companiesData) {
          const cPeriods = aggregateSummaries(company.summaries, granularity, selectedYear, rangeFrom, rangeTo);
          const match = cPeriods.find((cp) => cp.label === period.label);
          obj[company.companyName] = match?.dataJson["DESPESAS_TOTAL"] ?? 0;
        }
        return obj;
      });
    }
    const months = activePeriod?.months ?? [];
    return months.map((month) => {
      const mm = month.slice(5, 7);
      const label = `${MONTH_LABELS[mm] ?? mm}/${selectedYear.slice(2)}`;
      const obj: Record<string, string | number> = { period: label };
      for (const company of companiesData) {
        const s = company.summaries.find((cs) => cs.referenceMonth === month);
        obj[company.companyName] = s?.dataJson["DESPESAS_TOTAL"] ?? 0;
      }
      return obj;
    });
  }, [companiesData, aggregatedPeriods, granularity, selectedYear, isMultiCompany, activePeriod, rangeFrom, rangeTo]);

  // Heatmap data — Resultado por empresa × mês.
  // Columns = individual months of the active period (2 for bimestral, 3 for trimestral, etc.).
  // For monthly multi-company: all months of the selected year.
  const heatmapData = useMemo(() => {
    if (companiesData.length === 0) return null;
    if (companiesData.length === 1 && granularity === "monthly") return null;

    let heatMonths: string[];
    if (granularity === "monthly") {
      // Multi-company monthly: union of all months in the selected year
      const monthSet = new Set<string>();
      companiesData.forEach((c) =>
        c.summaries.filter((s) => s.referenceMonth.startsWith(selectedYear)).forEach((s) => monthSet.add(s.referenceMonth)),
      );
      heatMonths = [...monthSet].sort();
    } else {
      // Non-monthly: only the months that belong to the active period
      heatMonths = activePeriod?.months ?? [];
    }

    if (heatMonths.length === 0) return null;

    const cols = heatMonths.map((m) => {
      const mm = m.slice(5, 7);
      return `${MONTH_LABELS[mm] ?? mm}/${selectedYear.slice(2)}`;
    });

    return {
      rows: companiesData.map((c) => ({ id: c.companyId, label: c.companyName })),
      cols,
      values: companiesData.map((company) =>
        heatMonths.map((month) => {
          const s = company.summaries.find((cs) => cs.referenceMonth === month);
          return s?.dataJson["RESULTADO"] ?? 0;
        }),
      ),
    };
  }, [companiesData, granularity, activePeriod, selectedYear]);

  // 4 main expense groups
  const mainExpenseData = useMemo(
    () =>
      [
        { name: "Impostos", value: get(d, "IMPOSTOS"), fill: "#ef4444" },
        { name: "IOF/IRRF", value: get(d, "IOF_IRRF"), fill: "#f97316" },
        { name: "Demais Desp.", value: get(d, "DEMAIS_DESPESAS"), fill: "#eab308" },
        { name: "Condomínio", value: get(d, "CONDOMINIO"), fill: "#a855f7" },
      ].filter((i) => i.value > 0),
    [d],
  );
  // Full breakdown (all sub-fields), used when only 1 main group has data
  const expensePieData = useMemo(
    () =>
      [
        { name: "Impostos", value: get(d, "IMPOSTOS"), fill: "#ef4444" },
        { name: "IOF/IRRF", value: get(d, "IOF_IRRF"), fill: "#f97316" },
        { name: "Demais Desp.", value: get(d, "DEMAIS_DESPESAS"), fill: "#eab308" },
        { name: "Condomínio", value: get(d, "CONDOMINIO"), fill: "#a855f7" },
        { name: "LRA2", value: get(d, "LRA2_DESP"), fill: "#3b82f6" },
        { name: "LRA3", value: get(d, "LRA3_DESP"), fill: "#6366f1" },
        { name: "B. Vista", value: get(d, "B_VISTA_DESP"), fill: "#06b6d4" },
        { name: "Trapiche", value: get(d, "TRAPICHE_DESP"), fill: "#14b8a6" },
      ]
        .filter((i) => i.value > 0)
        .sort((a, b) => b.value - a.value),
    [d],
  );
  // Chart data: 4 main groups when 2+ have data; full breakdown otherwise
  const expensePieChartData = useMemo(
    () => (mainExpenseData.length >= 2 ? mainExpenseData : expensePieData),
    [mainExpenseData, expensePieData],
  );
  const expenseTotal = useMemo(
    () => expensePieChartData.reduce((s, x) => s + x.value, 0),
    [expensePieChartData],
  );

  // Fetch individual ledger entries when only one main expense group has data
  useEffect(() => {
    const PALETTE = ["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#06b6d4","#f43f5e","#14b8a6","#a855f7"];
    const KEY_MAP: Record<string, string> = {
      "Impostos": "IMPOSTOS", "IOF/IRRF": "IOF_IRRF",
      "Demais Desp.": "DEMAIS_DESPESAS", "Condomínio": "CONDOMINIO",
    };
    if (mainExpenseData.length !== 1 || !canDrillDown || !selectedCompanyIds[0] || !selectedYear || !selectedMonth) {
      setExpenseDetailEntries([]);
      return;
    }
    const categoryKey = KEY_MAP[mainExpenseData[0]!.name];
    const accountCode = categoryKey ? mappingCodes[categoryKey]?.[0] : undefined;
    if (!accountCode) { setExpenseDetailEntries([]); return; }
    let cancelled = false;
    const params = new URLSearchParams({
      companyId: selectedCompanyIds[0],
      referenceMonth: `${selectedYear}-${selectedMonth}`,
      accountCode,
    });
    if (categoryKey === "DEMAIS_DESPESAS") {
      for (const field of DETAILED_EXPENSE_FIELDS) {
        params.append("excludeDashboardField", field);
      }
    }
    fetch(`/api/dashboard/transactions?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { entries?: { description: string | null; debit: number }[] }) => {
        if (cancelled) return;
        // Normalize a raw description to a stable grouping key:
        // strip common prefixes, collapse multiple spaces, remove accents,
        // then lowercase so that "CLEITON RODRIGUES NA DATA" and
        // " Cleiton Rodrigues na Data" collapse to the same bucket.
        const normalizeDesc = (raw: string) =>
          raw
            .replace(/^VR (?:REF A |ENVIADO AO SR )/i, "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();

        const grouped = new Map<string, { name: string; value: number; fill: string }>();
        (data.entries ?? [])
          .filter((e) => e.debit > 0)
          .forEach((e, i) => {
            const raw = (e.description ?? "—").trim();
            // Display name: strip prefix + clamp length (original casing kept)
            const displayName = raw.replace(/^VR (?:REF A |ENVIADO AO SR )/i, "").slice(0, 26).trim();
            // Key based on the *displayed* name so that entries truncating
            // to the same label are always merged into one legend item.
            const key = normalizeDesc(displayName);
            const current = grouped.get(key);
            if (current) {
              current.value += e.debit;
              return;
            }
            grouped.set(key, {
              name: displayName,
              value: e.debit,
              fill: PALETTE[i % PALETTE.length]!,
            });
          });
        setExpenseDetailEntries([...grouped.values()]);
      })
      .catch(() => { if (!cancelled) setExpenseDetailEntries([]); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canDrillDown, selectedCompanyIds[0], selectedYear, selectedMonth, mainExpenseData.length, mainExpenseData[0]?.name, mappingCodes]);

  // Active pie data — individual entries when single-group and loaded, groups otherwise
  const activePieData = useMemo(
    () => (mainExpenseData.length === 1 && expenseDetailEntries.length > 0 ? expenseDetailEntries : expensePieChartData),
    [mainExpenseData.length, expenseDetailEntries, expensePieChartData],
  );
  const activePieTotal = useMemo(
    () => activePieData.reduce((s, x) => s + x.value, 0),
    [activePieData],
  );

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function saveDefaultCompany(companyId: string) {
    const response = await fetch("/api/context/active-company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });
    return response.ok;
  }

  async function handleSelectCompanies(ids: string[]) {
    setSelectedCompanyIds(ids);
    setContextMessage(null);
    if (ids.length === 1) {
      setIsSavingCompany(true);
      const ok = await saveDefaultCompany(ids[0]!);
      setContextMessage(ok ? "Empresa padrão atualizada." : "Não foi possível salvar empresa padrão.");
      setIsSavingCompany(false);
    }
  }

  function handleRemoveCompany(companyId: string) {
    if (selectedCompanyIds.length <= 1) return;
    void handleSelectCompanies(selectedCompanyIds.filter((id) => id !== companyId));
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function handleSeedAndRecalculate() {
    setSeeding(true);
    setRecalcMsg(null);
    try {
      const seedRes = await fetch("/api/admin/mappings/seed", { method: "POST" });
      if (!seedRes.ok) {
        const body = (await seedRes.json()) as { error?: string };
        setRecalcMsg(body.error ?? "Erro ao inicializar mapeamentos.");
        return;
      }
      await handleRecalculate();
    } catch {
      setRecalcMsg("Erro de rede.");
    } finally {
      setSeeding(false);
    }
  }

  async function handleRecalculate() {
    const companyId = selectedCompanyIds[0];
    if (!companyId || !selectedYear || !selectedMonth) return;
    const referenceMonth = `${selectedYear}-${selectedMonth}`;
    setRecalculating(true);
    setRecalcMsg(null);
    try {
      const res = await fetch("/api/dashboard/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, referenceMonth }),
      });
      const body = (await res.json()) as { summary?: Record<string, number>; error?: string };
      if (res.ok && body.summary) {
        setCompaniesData((prev) =>
          prev.map((cd) =>
            cd.companyId === companyId
              ? {
                  ...cd,
                  summaries: cd.summaries.map((s) =>
                    s.referenceMonth === referenceMonth ? { ...s, dataJson: body.summary! } : s,
                  ),
                }
              : cd,
          ),
        );
        // Evict from module-level cache and mark stale so any future navigation
        // to this page also fetches fresh data for this company.
        companyDataCache.delete(companyId);
        markCompanyStale(companyId);
        // Advance baseline so the freshness poller doesn't false-positive on the next cycle
        refreshBaseline(companyId);
        setRecalcMsg("Recalculado com sucesso.");
      } else {
        setRecalcMsg(body.error ?? "Erro ao recalcular.");
      }
    } catch {
      setRecalcMsg("Erro ao recalcular.");
    } finally {
      setRecalculating(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  async function handleSync() {
    setIsSyncing(true);
    // Evict stale companies from cache so loadSummaries fetches fresh data
    for (const id of staleCompanyIds) companyDataCache.delete(id);
    await loadSummaries(selectedCompanyIds);
    clearStale();
    setIsSyncing(false);
  }

  function openFilterModal() {
    setDraftGranularity(granularity);
    setDraftYear(selectedYear);
    setDraftMonth(selectedMonth);
    setDraftRangeFrom(rangeFrom);
    setDraftRangeTo(rangeTo);
    setFilterModalOpen(true);
  }

  function applyFilter() {
    setGranularity(draftGranularity);
    setSelectedYear(draftYear);
    setSelectedMonth(draftMonth);
    setRangeFrom(draftRangeFrom);
    setRangeTo(draftRangeTo);
    setFilterModalOpen(false);
  }

  // Stale data warning only applies to single-company monthly view
  const isStale =
    !isMultiCompany &&
    granularity === "monthly" &&
    activeSummary !== undefined &&
    Object.keys(activeSummary.dataJson).length < 4;

  return (
    <AppShell
      role={userRole}
      email={userEmail}
      onLogout={handleLogout}
      headerRight={
        <span className="lg:hidden">
          <NotificationsBell
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
          />
        </span>
      }
    >

      {/* ── Compact toolbar ── */}
      <div className="mb-3 flex items-center gap-2">
        {/* Company selector */}
        <div className="min-w-0 flex-1">
          <MultiCompanySelect
            companies={allowedCompanies}
            selected={selectedCompanyIds}
            onChange={(ids) => void handleSelectCompanies(ids)}
            disabled={isSavingCompany}
          />
        </div>

        {/* Sync status icon */}
        {selectedCompanyIds.length > 0 && (
          <DataFreshnessBadge
            isStale={staleCompanyIds.length > 0}
            isSyncing={isSyncing}
            onSync={() => void handleSync()}
          />
        )}

        {/* Notifications bell — desktop only (mobile lives in header) */}
        <div className="hidden lg:block">
          <NotificationsBell
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
          />
        </div>

        {/* Period filter toggle */}
        <button
          type="button"
          onClick={openFilterModal}
          title={selectedYear ? `Período: ${MONTH_LABELS[selectedMonth] ?? selectedMonth}/${selectedYear}` : "Filtro de período"}
          className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors border-[--border] text-[--text-muted] hover:border-[#0f4c81]/40 hover:bg-[#0f4c81]/5 hover:text-[#0f4c81] dark:hover:border-blue-500/40 dark:hover:bg-blue-900/20 dark:hover:text-blue-400`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {selectedYear && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#0f4c81] dark:bg-blue-500" />
          )}
        </button>
      </div>

      {/* ── Company context message ── */}
      {contextMessage && (
        <p className="mb-2 text-sm text-green-600 dark:text-green-400">{contextMessage}</p>
      )}

      {/* ── Period filter modal ── */}
      {filterModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setFilterModalOpen(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-800 dark:text-zinc-100">
                <svg className="h-4 w-4 text-[#0f4c81] dark:text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Filtro de Período
              </h2>
              <button
                type="button"
                onClick={() => setFilterModalOpen(false)}
                aria-label="Fechar"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="px-5 py-5">
              <PeriodFilter
                granularity={draftGranularity}
                year={draftYear}
                month={draftMonth}
                rangeFrom={draftRangeFrom}
                rangeTo={draftRangeTo}
                years={years}
                monthsForYear={monthsForYear}
                onGranularityChange={setDraftGranularity}
                onYearChange={(y) => {
                  setDraftYear(y);
                  const first = mergedSummaries.find((s) => s.referenceMonth.startsWith(y));
                  if (first) setDraftMonth(first.referenceMonth.slice(5, 7));
                }}
                onMonthChange={setDraftMonth}
                onRangeFromChange={setDraftRangeFrom}
                onRangeToChange={setDraftRangeTo}
              />
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setFilterModalOpen(false)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={applyFilter}
                className="rounded-lg bg-[#0f4c81] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0d3d68] dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty / Loading states ── */}
      {selectedCompanyIds.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 py-16 text-center dark:border-zinc-700 dark:bg-zinc-800/30">
          <svg className="h-10 w-10 text-zinc-300 dark:text-zinc-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
          </svg>
          <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500">Selecione uma empresa para ver o demonstrativo financeiro</p>
        </div>
      ) : loadingSummary ? (
        <div className="mt-8 flex flex-col items-center gap-3 py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0f4c81] border-t-transparent dark:border-blue-400" />
          <p className="text-sm text-zinc-400 dark:text-zinc-500">Carregando dados...</p>
        </div>
      ) : mergedSummaries.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 py-16 text-center dark:border-zinc-700 dark:bg-zinc-800/30">
          <svg className="h-10 w-10 text-zinc-300 dark:text-zinc-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
          <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500">Nenhum demonstrativo encontrado para esta empresa.</p>
          <a href="/app/imports" className="rounded-lg bg-[#0f4c81] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0d3d68] dark:bg-blue-600 dark:hover:bg-blue-700">
            Importar Balancete
          </a>
        </div>
      ) : !activeSummary ? (
        <div className="mt-8 rounded-2xl border border-zinc-100 bg-zinc-50 p-8 text-center text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/30 dark:text-zinc-500">
          Selecione o ano e o mês para visualizar os dados.
        </div>
      ) : (
        <>
          {/* ── Stale-data warning ── */}
          {isStale ? (
            <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Dados incompletos — mapeamentos não configurados</p>
                  <p className="mt-1 text-xs text-amber-700">
                    O balancete foi importado antes de existirem regras de mapeamento. Inicialize os mapeamentos padrão e recalcule o período.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {userRole === "ADMIN" ? (
                  <>
                    <button
                      onClick={() => void handleSeedAndRecalculate()}
                      disabled={seeding || recalculating}
                      className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
                    >
                      {seeding ? "Inicializando..." : recalculating ? "Recalculando..." : "Inicializar Mapeamentos e Recalcular"}
                    </button>
                    <a href="/app/admin/mappings" className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50">
                      Configurar Mapeamentos
                    </a>
                  </>
                ) : (
                  <p className="text-xs text-amber-700">Solicite ao administrador que inicialize os mapeamentos.</p>
                )}
              </div>
            </div>
          ) : (
            <div aria-label="Contexto da visualização" className="mt-5 flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white/80 px-4 py-3.5 shadow-sm backdrop-blur-sm dark:border-zinc-700/70 dark:bg-zinc-900/70 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                {isMultiCompany ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#0f4c81] dark:bg-blue-950/60 dark:text-blue-300">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4v18M19 21V11l-7-4M8 9h1m-1 4h1m-1 4h1m6-5h1m-1 4h1" />
                        </svg>
                      </span>
                      <strong className="text-base font-bold tracking-tight text-zinc-800 dark:text-zinc-100 sm:text-lg">
                        {selectedCompanies.length} empresas
                      </strong>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#0f4c81] dark:bg-blue-950/60 dark:text-blue-300">
                        Consolidado
                      </span>
                      {granularity !== "monthly" && activePeriod && (
                        <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{activePeriod.label}</span>
                      )}
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-2" aria-label="Empresas selecionadas">
                      {selectedCompanies.map((company) => (
                        <button
                          key={company.id}
                          type="button"
                          onClick={() => handleRemoveCompany(company.id)}
                          disabled={isSavingCompany}
                          aria-label={`Remover ${company.name} da consolidação`}
                          title={`Remover ${company.name}`}
                          className="group/tag inline-flex max-w-full items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/80 px-2.5 py-1 text-xs font-semibold text-blue-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-wait disabled:opacity-60 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:border-red-800/60 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                        >
                          <span className="max-w-56 truncate">{company.name}</span>
                          <svg className="h-3.5 w-3.5 shrink-0 transition-transform group-hover/tag:scale-110" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0f4c81] dark:bg-blue-950/60 dark:text-blue-300">
                      <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v3m8-3v3M3.5 9.5h17M5 4h14a2 2 0 012 2v13a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
                      </svg>
                    </span>
                    <p className="flex flex-col">
                      <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">Referência</span>
                      <strong className="text-base font-bold tracking-tight text-zinc-800 dark:text-zinc-100 sm:text-lg">
                        {granularity === "monthly"
                          ? `${MONTH_LABELS[selectedMonth] ?? selectedMonth}/${selectedYear}`
                          : activePeriod?.label ?? selectedYear}
                      </strong>
                    </p>
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!isMultiCompany && granularity === "monthly" && (
                  <button
                    onClick={() => void handleRecalculate()}
                    disabled={recalculating}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm transition hover:border-[#0f4c81]/40 hover:bg-[#f5f8fc] hover:text-[#0f4c81] disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-blue-500/40 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                  >
                    <svg className={`h-3.5 w-3.5 ${recalculating ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {recalculating ? "Recalculando..." : "Recalcular período"}
                  </button>
                )}
              </div>
            </div>
          )}
          {recalcMsg ? (
            <p className="mt-1 text-right text-xs text-zinc-500 dark:text-zinc-400">{recalcMsg}</p>
          ) : null}

          {/* ── Resumo financeiro por divisões ──────────────────────────── */}
          <section aria-label="Resumo financeiro" className="mt-6 flex flex-col gap-4">
            <DashboardDivision
              id="dashboard-receitas"
              title="Receitas"
              color="green"
              icon={Icons.invoice}
              total={get(d, "RECEITAS_TOTAL")}
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <KpiCard label={revenueCardLabels.billing} value={get(d, "FATURAMENTO")} color="green"
                  sub="NFs emitidas" icon={Icons.invoice}
                  onDrillDown={canDrillDown && mappingCodes["FATURAMENTO"]?.[0] ? () => setDrillDown({ accountCode: mappingCodes["FATURAMENTO"][0]!, label: revenueCardLabels.billing }) : undefined} />
                <KpiCard label={revenueCardLabels.receivedInvoices} value={get(d, "NFS_RECEBIDAS")} color="green"
                  sub="Pagamentos recebidos" icon={Icons.invoice}
                  onDrillDown={canDrillDown && mappingCodes["NFS_RECEBIDAS"]?.[0] ? () => setDrillDown({ accountCode: mappingCodes["NFS_RECEBIDAS"][0]!, label: revenueCardLabels.receivedInvoices }) : undefined} />
                <KpiCard label="Aluguel" value={get(d, "ALUGUEL")} color="green" icon={Icons.building} />
                <KpiCard label="Rec. Passivas" value={get(d, "RENDIMENTO_BRUTO")} color="teal"
                  sub="Rendimentos de aplicações" icon={Icons.chart}
                  onDrillDown={canDrillDown && mappingCodes["RENDIMENTO_BRUTO"]?.[0] ? () => setDrillDown({ accountCode: mappingCodes["RENDIMENTO_BRUTO"][0]!, label: "Receitas Passivas" }) : undefined} />
                <KpiCard
                  label="Rend. Líquidos"
                  value={get(d, "RENTABILIDADE")}
                  color={get(d, "RENTABILIDADE") < 0 ? "red" : "teal"}
                  sub="Rendimentos menos IOF/IRRF"
                  icon={get(d, "RENTABILIDADE") < 0 ? Icons.trendingDown : Icons.trending}
                />
              </div>
            </DashboardDivision>

            <DashboardDivision
              id="dashboard-saldos-bancarios"
              title="Saldos Bancários por Conta"
              color="blue"
              icon={Icons.bank}
              total={bankBalanceTotal}
            >
              {loadingBankBalances ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[0, 1, 2].map((item) => (
                    <div key={item} aria-hidden="true" className="h-[9.5rem] animate-pulse rounded-xl border border-blue-100 bg-white/70 dark:border-blue-900/50 dark:bg-zinc-900/50" />
                  ))}
                  <span className="sr-only">Carregando saldos bancários por conta...</span>
                </div>
              ) : bankBalanceCards.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {bankBalanceCards.map((account) => {
                    const month = account.referenceMonth?.slice(5, 7) ?? "";
                    const year = account.referenceMonth?.slice(0, 4) ?? "";
                    const accountReference = month && year ? `${MONTH_LABELS[month] ?? month}/${year}` : "";
                    return (
                      <KpiCard
                        key={`${account.companyId}:${account.accountCode}`}
                        label={account.accountName}
                        value={account.balance}
                        color="blue"
                        icon={Icons.bank}
                        sub={[account.accountCode, isMultiCompany ? account.companyName : "", accountReference].filter(Boolean).join(" · ")}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <KpiCard label="Saldo Bancário" value={get(d, "SD_BANCARIO")} color="blue"
                    sub="Composição por conta indisponível" icon={Icons.bank}
                    onDrillDown={canDrillDown && mappingCodes["SD_BANCARIO"]?.[0] ? () => setDrillDown({ accountCode: mappingCodes["SD_BANCARIO"][0]!, label: "Saldo Bancário" }) : undefined} />
                </div>
              )}
            </DashboardDivision>

            <DashboardDivision
              id="dashboard-despesas"
              title="Despesas"
              color="red"
              icon={Icons.tax}
              total={get(d, "DESPESAS_TOTAL")}
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard label="Impostos" value={get(d, "IMPOSTOS")} color="red" icon={Icons.tax}
                  onDrillDown={canDrillDown && mappingCodes["IMPOSTOS"]?.[0] ? () => setDrillDown({ accountCode: mappingCodes["IMPOSTOS"][0]!, label: "Impostos" }) : undefined} />
                <KpiCard label="IOF / IRRF" value={get(d, "IOF_IRRF")} color="red" icon={Icons.tax}
                  onDrillDown={canDrillDown && mappingCodes["IOF_IRRF"]?.length ? () => setDrillDown({ accountCode: null, accountCodes: mappingCodes["IOF_IRRF"], label: "IOF / IRRF" }) : undefined} />
                <KpiCard label="Pró-labores" value={get(d, "PRO_LABORES")} color="red" icon={Icons.dollar}
                  onDrillDown={canDrillDown && mappingCodes["PRO_LABORES"]?.[0] ? () => setDrillDown({ accountCode: mappingCodes["PRO_LABORES"][0]!, label: "Pró-labores" }) : undefined} />
                <KpiCard label="Demais Despesas" value={get(d, "DEMAIS_DESPESAS")} color="red" icon={Icons.chart}
                  onDrillDown={canDrillDown && mappingCodes["DEMAIS_DESPESAS"]?.[0] ? () => setDrillDown({
                    accountCode: mappingCodes["DEMAIS_DESPESAS"][0]!,
                    excludeDashboardFields: [...DETAILED_EXPENSE_FIELDS],
                    label: "Demais Despesas",
                  }) : undefined} />
              </div>
            </DashboardDivision>

            <DashboardDivision
              id="dashboard-resultados"
              title="Investimentos e Resultado"
              color="purple"
              icon={Icons.profit}
              total={get(d, "RESULTADO")}
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard label="Investimentos" value={investmentsTotal} color="teal" icon={Icons.trending}
                  onDrillDown={canDrillDown && investmentAccountCodes.length > 0 ? () => setDrillDown({ accountCode: null, accountCodes: investmentAccountCodes, label: "Investimentos" }) : undefined} />
                <KpiCard label="Distribuição de Lucros" value={get(d, "DISTRIB_LUCROS")} color="purple" icon={Icons.profit}
                  onDrillDown={canDrillDown && mappingCodes["DISTRIB_LUCROS"]?.length ? () => setDrillDown({ accountCode: null, accountCodes: mappingCodes["DISTRIB_LUCROS"], label: "Distribuição de Lucros" }) : undefined} />
                <KpiCard label="Resultado" value={get(d, "RESULTADO")} color={get(d, "RESULTADO") >= 0 ? "green" : "red"}
                  sub={get(d, "RESULTADO") >= 0 ? "▲ Superávit" : "▼ Déficit"} icon={Icons.profit} />
                <MarginKpiCard value={profitMargin} />
              </div>
            </DashboardDivision>
          </section>

          <section aria-labelledby="dashboard-faturamento-despesas-resultado" className="mt-4 rounded-2xl border border-blue-200 bg-blue-500/10 p-5 dark:border-blue-900/30 dark:bg-blue-950/10 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">{Icons.chart}</span>
              <h2 id="dashboard-faturamento-despesas-resultado" className="text-sm font-bold text-blue-800 dark:text-blue-300">Faturamento × Despesas × Resultado</h2>
              <div className="ml-2 h-px flex-1 bg-blue-200/70 dark:bg-blue-900/40" />
            </div>
            <div className="rounded-xl border border-blue-100 bg-white p-3 shadow-sm dark:border-blue-900/50 dark:bg-zinc-900/80 sm:p-5">
              {chartSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartSeries} barCategoryGap="24%" barGap={3} margin={{ left: -4, right: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tickFormatter={formatCurrencyShort} width={58} tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={currencyTooltipFormatter} contentStyle={{ fontSize: 12, borderRadius: 10, border: `1px solid ${chartTheme.tooltip.border}`, background: chartTheme.tooltip.background, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }} labelStyle={{ fontWeight: 600, color: chartTheme.tooltip.label }} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} iconSize={10} />
                    <ReferenceLine y={0} stroke={chartTheme.grid} />
                    <Bar dataKey="Faturamento" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Resultado" fill="#0f4c81" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-12 text-center text-sm text-zinc-400 dark:text-zinc-500">Sem dados no período selecionado.</p>
              )}
            </div>
          </section>

          {/* ── Centro de Custo ─────────────────────────────────────────── */}
          {canDrillDown && selectedCompanyIds.length === 1 && (
                    <CostCenterSection
                      companyId={selectedCompanyIds[0]!}
                      referenceMonth={`${selectedYear}-${selectedMonth}`}
            />
          )}

          {/* ── Análise Anual ─────────────────────────────────────────── */}
                    <div className="mt-5 rounded-2xl border border-zinc-300 bg-zinc-500/10 p-3 dark:border-zinc-700/40 dark:bg-zinc-800/20 sm:p-5 lg:p-6">

                      {/* ── Locatários ───────────────────────────────────── */}
                      {!isMultiCompany && selectedCompanyIds.length === 1 && selectedYear && (
                        <TenantSection
                          companyId={selectedCompanyIds[0]!}
                          year={selectedYear}
                        />
                      )}

                      <div className="mb-4 mt-5 flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                          {Icons.chart}
                        </span>
                        <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
                          Análise — {selectedYear}
                          {granularity !== "monthly" && (
                            <span className="ml-2 rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                              {PERIOD_LABELS[granularity]}
                            </span>
                          )}
                          {isMultiCompany && (
                            <span className="ml-2 rounded-md bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                              Consolidado
                            </span>
                          )}
                        </h2>
                        <div className="ml-2 h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-5">
                        <div className={isMultiCompany ? "rounded-xl border border-zinc-100 bg-white p-3 dark:border-zinc-700/50 dark:bg-zinc-900/50 sm:p-4 lg:col-span-3" : "hidden"}>
                          {!isMultiCompany ? (
                            <>
                              <p className="mb-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Faturamento × Despesas × Resultado</p>
                              {chartSeries.length > 0 ? (
                                <ResponsiveContainer width="100%" height={220}>
                                  <BarChart data={chartSeries} barCategoryGap="28%" barGap={2} margin={{ left: -4, right: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                                    <XAxis dataKey="period" tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                    <YAxis tickFormatter={formatCurrencyShort} width={52} tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
                                    <Tooltip formatter={currencyTooltipFormatter} contentStyle={{ fontSize: 12, borderRadius: 10, border: `1px solid ${chartTheme.tooltip.border}`, background: chartTheme.tooltip.background, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }} labelStyle={{ fontWeight: 600, color: chartTheme.tooltip.label }} />
                                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconSize={10} />
                                    <Bar dataKey="Faturamento" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Resultado" fill="#0f4c81" radius={[4, 4, 0, 0]} />
                                    <ReferenceLine y={0} stroke={chartTheme.grid} />
                                  </BarChart>
                                </ResponsiveContainer>
                              ) : (
                                <p className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">Sem dados no ano selecionado.</p>
                              )}
                            </>
                          ) : (
                            <>
                              <p className="mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Receitas por empresa</p>
                              {comparativeSeries.length > 0 ? (
                                <ResponsiveContainer width="100%" height={160}>
                                  <BarChart data={comparativeSeries} barCategoryGap="22%" barGap={2} margin={{ left: -4, right: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                                    <XAxis dataKey="period" tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                    <YAxis tickFormatter={formatCurrencyShort} width={52} tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
                                    <Tooltip formatter={currencyTooltipFormatter} contentStyle={{ fontSize: 12, borderRadius: 10, border: `1px solid ${chartTheme.tooltip.border}`, background: chartTheme.tooltip.background, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }} labelStyle={{ fontWeight: 600, color: chartTheme.tooltip.label }} />
                                    <Legend
                                      iconSize={8}
                                      wrapperStyle={{ fontSize: 10, paddingTop: 6, lineHeight: "18px" }}
                                      formatter={(value: string) => value.length > 20 ? `${value.slice(0, 18)}…` : value}
                                    />
                                    {companiesData.map((company, i) => (
                                      <Bar key={company.companyId} dataKey={company.companyName} fill={COMPANY_COLORS[i % COMPANY_COLORS.length]} radius={[4, 4, 0, 0]} />
                                    ))}
                                  </BarChart>
                                </ResponsiveContainer>
                              ) : (
                                <p className="py-4 text-center text-sm text-zinc-400 dark:text-zinc-500">Sem dados no período.</p>
                              )}
                              <p className="mb-2 mt-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Despesas por empresa</p>
                              {comparativeDespesasSeries.length > 0 ? (
                                <ResponsiveContainer width="100%" height={160}>
                                  <BarChart data={comparativeDespesasSeries} barCategoryGap="22%" barGap={2} margin={{ left: -4, right: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                                    <XAxis dataKey="period" tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                    <YAxis tickFormatter={formatCurrencyShort} width={52} tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
                                    <Tooltip formatter={currencyTooltipFormatter} contentStyle={{ fontSize: 12, borderRadius: 10, border: `1px solid ${chartTheme.tooltip.border}`, background: chartTheme.tooltip.background, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }} labelStyle={{ fontWeight: 600, color: chartTheme.tooltip.label }} />
                                    <Legend
                                      iconSize={8}
                                      wrapperStyle={{ fontSize: 10, paddingTop: 6, lineHeight: "18px" }}
                                      formatter={(value: string) => value.length > 20 ? `${value.slice(0, 18)}…` : value}
                                    />
                                    {companiesData.map((company, i) => (
                                      <Bar key={company.companyId} dataKey={company.companyName} fill={COMPANY_COLORS[i % COMPANY_COLORS.length]} radius={[4, 4, 0, 0]} />
                                    ))}
                                  </BarChart>
                                </ResponsiveContainer>
                              ) : (
                                <p className="py-4 text-center text-sm text-zinc-400 dark:text-zinc-500">Sem dados no período.</p>
                              )}
                            </>
                          )}
                        </div>

                        <div className={`flex flex-col rounded-xl border border-zinc-100 bg-white p-3 dark:border-zinc-700/50 dark:bg-zinc-900/50 sm:p-4 ${isMultiCompany ? "lg:col-span-2" : "lg:col-span-5"}`}>
                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                              {mainExpenseData.length >= 2
                                ? "Composição de despesas"
                                : mainExpenseData.length === 1
                                  ? expenseDetailEntries.length > 0
                                    ? `${mainExpenseData[0]!.name} — lançamentos`
                                    : `${mainExpenseData[0]!.name} — detalhamento`
                                  : "Despesas"}
                            </p>
                            <span className="text-sm font-bold text-red-600 dark:text-red-400">{formatCurrencyShort(get(d, "DESPESAS_TOTAL"))}</span>
                          </div>
                          {activePieData.length > 0 ? (
                            <div className="flex flex-1 gap-3">
                              {/* Gráfico de pizza (donut) */}
                              <div className="h-52 w-1/2 shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={activePieData}
                                      cx="50%" cy="50%"
                                      innerRadius="38%" outerRadius="62%"
                                      paddingAngle={2}
                                      dataKey="value"
                                      label={({ cx: pcx, cy: pcy, midAngle, outerRadius: or, percent }) => {
                                        if ((percent as number) < 0.05) return null;
                                        const RAD = Math.PI / 180;
                                        const r = (or as number) * 1.28;
                                        const x = (pcx as number) + r * Math.cos(-(midAngle as number) * RAD);
                                        const y = (pcy as number) + r * Math.sin(-(midAngle as number) * RAD);
                                        return (
                                          <text x={x} y={y} fill={chartTheme.tick} fontSize={8} textAnchor={x > (pcx as number) ? "start" : "end"} dominantBaseline="central">
                                            {`${((percent as number) * 100).toFixed(0)}%`}
                                          </text>
                                        );
                                      }}
                                      labelLine={false}
                                    >
                                      {activePieData.map((entry, i) => (
                                        <Cell key={i} fill={entry.fill} />
                                      ))}
                                    </Pie>
                                    <Tooltip
                                      formatter={currencyTooltipFormatter}
                                      contentStyle={{ fontSize: 12, borderRadius: 10, border: `1px solid ${chartTheme.tooltip.border}`, background: chartTheme.tooltip.background }}
                                      labelStyle={{ color: chartTheme.tooltip.label }}
                                    />
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>
                              {/* Legenda */}
                              <div className="flex flex-1 flex-col justify-center space-y-1 overflow-hidden">
                                {activePieData.map((item, i) => {
                                  const pct = activePieTotal > 0 ? (item.value / activePieTotal) * 100 : 0;
                                  return (
                                    <div key={i} className="flex items-center justify-between text-[10px]">  
                                      <div className="flex min-w-0 items-center gap-1">
                                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: item.fill }} />
                                        <span className="truncate text-zinc-600 dark:text-zinc-400">{item.name}</span>
                                      </div>
                                      <div className="ml-1 flex shrink-0 items-center gap-1.5 tabular-nums">
                                        <span className="text-zinc-400 dark:text-zinc-500">{pct.toFixed(1)}%</span>
                                        <span className="font-medium text-zinc-700 dark:text-zinc-200">{formatCurrencyShort(item.value)}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <p className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">Sem despesas no período.</p>
                          )}
                        </div>
                      </div>

                      {trendSeries.length > 1 && (
                        <div className="mt-4 rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-700/50 dark:bg-zinc-900/50">
                          <p className="mb-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Tendência do resultado</p>
                          <ResponsiveContainer width="100%" height={170}>
                            <LineChart data={trendSeries} margin={{ left: -4, right: 4 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                              <XAxis dataKey="period" tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                              <YAxis tickFormatter={formatCurrencyShort} width={52} tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
                              <Tooltip formatter={currencyTooltipFormatter} contentStyle={{ fontSize: 12, borderRadius: 10, border: `1px solid ${chartTheme.tooltip.border}`, background: chartTheme.tooltip.background, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }} labelStyle={{ fontWeight: 600, color: chartTheme.tooltip.label }} />
                              <ReferenceLine y={0} stroke={chartTheme.grid} strokeDasharray="4 2" />
                              <Line type="monotone" dataKey="Resultado" stroke={theme === "dark" ? "#60a5fa" : "#0f4c81"} strokeWidth={2.5} dot={{ fill: theme === "dark" ? "#60a5fa" : "#0f4c81", r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {heatmapData && (
                        <div className="mt-4 rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-700/50 dark:bg-zinc-900/50">
                          <div className="mb-3 flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                              {Icons.chart}
                            </span>
                            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                              {isMultiCompany ? "Mapa de calor — Resultado por empresa × período" : "Mapa de calor — Resultado por período"}
                            </p>
                          </div>
                          <HeatmapChart
                            data={heatmapData}
                            subtitle={isMultiCompany ? "Cada célula mostra o Resultado (Receitas − Despesas) da empresa naquele período" : "Resultado (Receitas − Despesas) da empresa em cada período"}
                          />
                        </div>
                      )}
                    </div>
        </>
      )}

      {/* ── Razão drill-down modal ── */}
      {drillDown && selectedYear && selectedMonth && selectedCompanyIds[0] && (
        <RazaoTransactionsModal
          companyId={selectedCompanyIds[0]}
          referenceMonth={`${selectedYear}-${selectedMonth}`}
          accountCode={drillDown.accountCode}
          accountCodes={drillDown.accountCodes}
          excludeDashboardFields={drillDown.excludeDashboardFields}
          label={drillDown.label}
          onClose={() => setDrillDown(null)}
        />
      )}
    </AppShell>
  );
}
