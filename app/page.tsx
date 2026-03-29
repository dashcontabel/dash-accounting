"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";

import AppShell from "./components/app-shell";
import MultiCompanySelect from "./components/multi-company-select";
import PeriodFilter from "./components/period-filter";
import HeatmapChart from "./components/heatmap-chart";
import { useTheme } from "./components/theme-provider";
import {
  aggregateSummaries,
  mergeCompanySummaries,
  PERIOD_LABELS,
  type PeriodGranularity,
  type MonthlySummary,
} from "@/lib/dashboard/periods";

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

type CompanyData = {
  companyId: string;
  companyName: string;
  summaries: MonthlySummary[];
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

function get(data: DashboardData, field: string): number {
  return data[field] ?? 0;
}

// ── KPI Card ────────────────────────────────────────────────────────────────

const COLOR_MAP = {
  blue:   { card: "bg-blue-50 border-blue-100 dark:bg-blue-950/40 dark:border-blue-900/50",     value: "text-blue-700 dark:text-blue-300",     icon: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400"   },
  green:  { card: "bg-emerald-50 border-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-900/50", value: "text-emerald-700 dark:text-emerald-300", icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400" },
  red:    { card: "bg-red-50 border-red-100 dark:bg-red-950/40 dark:border-red-900/50",         value: "text-red-700 dark:text-red-300",       icon: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400"     },
  amber:  { card: "bg-amber-50 border-amber-100 dark:bg-amber-950/40 dark:border-amber-900/50", value: "text-amber-700 dark:text-amber-300",   icon: "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400" },
  purple: { card: "bg-purple-50 border-purple-100 dark:bg-purple-950/40 dark:border-purple-900/50", value: "text-purple-700 dark:text-purple-300", icon: "bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400" },
  teal:   { card: "bg-teal-50 border-teal-100 dark:bg-teal-950/40 dark:border-teal-900/50",     value: "text-teal-700 dark:text-teal-300",     icon: "bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400"   },
} as const;

type KpiColor = keyof typeof COLOR_MAP;

function KpiCard({
  label,
  value,
  color = "blue",
  sub,
  icon,
}: {
  label: string;
  value: number | undefined;
  color?: KpiColor;
  sub?: string;
  icon?: React.ReactNode;
}) {
  const c = COLOR_MAP[color];
  return (
    <article className={`group rounded-2xl border p-5 transition-shadow hover:shadow-md ${c.card}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</p>
        {icon && (
          <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${c.icon}`}>
            {icon}
          </span>
        )}
      </div>
      <p className={`mt-3 text-xl font-bold ${c.value}`}>{formatCurrency(value)}</p>
      {sub ? <p className="mt-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">{sub}</p> : null}
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
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcMsg, setRecalcMsg] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  // ── Auth & company list ──────────────────────────────────────────────────

  useEffect(() => {
    let isMounted = true;

    async function loadMe() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const data = (await response.json()) as MeResponse;

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
    setLoadingSummary(true);
    try {
      const params = new URLSearchParams();
      for (const id of ids) params.append("companyId", id);
      const res = await fetch(`/api/dashboard/summary?${params.toString()}`, { cache: "no-store" });
      if (res.ok) {
        const body = (await res.json()) as { companies: CompanyData[] };
        setCompaniesData(body.companies);
      } else {
        setCompaniesData([]);
      }
    } catch {
      setCompaniesData([]);
    } finally {
      setLoadingSummary(false);
    }
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
    () => aggregateSummaries(mergedSummaries, granularity, selectedYear),
    [mergedSummaries, granularity, selectedYear],
  );

  // Reset year/month when summaries reload
  useEffect(() => {
    if (mergedSummaries.length > 0) {
      const last = mergedSummaries[mergedSummaries.length - 1]!;
      const [y, m] = last.referenceMonth.split("-");
      setSelectedYear(y ?? "");
      setSelectedMonth(m ?? "");
    } else {
      setSelectedYear("");
      setSelectedMonth("");
    }
  }, [mergedSummaries]);

  // Active KPI data: for monthly = selected month; for other granularities = full year total
  const activeSummary = useMemo(() => {
    if (granularity === "monthly") {
      return mergedSummaries.find((s) => s.referenceMonth === `${selectedYear}-${selectedMonth}`);
    }
    const annual = aggregateSummaries(mergedSummaries, "annual", selectedYear);
    if (annual.length === 0) return undefined;
    return { referenceMonth: selectedYear, dataJson: annual[0]!.dataJson };
  }, [mergedSummaries, granularity, selectedYear, selectedMonth]);

  const d = activeSummary?.dataJson ?? {};

  // Chart series — consolidated (all selected companies merged)
  const chartSeries = useMemo(
    () =>
      aggregatedPeriods.map((p) => ({
        period: p.label,
        Receitas: p.dataJson["RECEITAS_TOTAL"] ?? 0,
        Despesas: p.dataJson["DESPESAS_TOTAL"] ?? 0,
        Resultado: p.dataJson["RESULTADO"] ?? 0,
      })),
    [aggregatedPeriods],
  );

  // Per-company receitas series (for comparative bar chart when multi-company)
  const isMultiCompany = companiesData.length > 1;
  const COMPANY_COLORS = ["#10b981", "#0f4c81", "#f59e0b", "#ef4444", "#a855f7", "#0ea5e9"];

  const comparativeSeries = useMemo(() => {
    if (!isMultiCompany) return [];
    return aggregatedPeriods.map((period) => {
      const obj: Record<string, string | number> = { period: period.label };
      for (const company of companiesData) {
        const cPeriods = aggregateSummaries(company.summaries, granularity, selectedYear);
        const match = cPeriods.find((cp) => cp.label === period.label);
        obj[company.companyName] = match?.dataJson["RECEITAS_TOTAL"] ?? 0;
      }
      return obj;
    });
  }, [companiesData, aggregatedPeriods, granularity, selectedYear, isMultiCompany]);

  // Heatmap data — Resultado per company per period
  const heatmapData = useMemo(() => {
    if (!isMultiCompany) return null;
    return {
      rows: companiesData.map((c) => ({ id: c.companyId, label: c.companyName })),
      cols: aggregatedPeriods.map((p) => p.label),
      values: companiesData.map((company) => {
        const cPeriods = aggregateSummaries(company.summaries, granularity, selectedYear);
        return aggregatedPeriods.map((period) => {
          const match = cPeriods.find((cp) => cp.label === period.label);
          return match?.dataJson["RESULTADO"] ?? 0;
        });
      }),
    };
  }, [companiesData, aggregatedPeriods, granularity, selectedYear, isMultiCompany]);

  // Pie chart data — expense breakdown for active period
  const expensePieData = useMemo(
    () =>
      [
        { name: "Impostos", value: get(d, "IMPOSTOS"), fill: "#ef4444" },
        { name: "IOF/IRRF", value: get(d, "IOF_IRRF"), fill: "#f97316" },
        { name: "Dmais Desp.", value: get(d, "DEMAIS_DESPESAS"), fill: "#eab308" },
        { name: "Condomínio", value: get(d, "CONDOMINIO"), fill: "#a855f7" },
      ].filter((i) => i.value > 0),
    [d],
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

  // Stale data warning only applies to single-company monthly view
  const isStale =
    !isMultiCompany &&
    granularity === "monthly" &&
    activeSummary !== undefined &&
    Object.keys(activeSummary.dataJson).length < 4;

  return (
    <AppShell role={userRole} email={userEmail} onLogout={handleLogout}>

      {/* ── Filter bar ── */}
      <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-5 dark:border-zinc-700/50 dark:bg-zinc-800/50">
        <div className="grid gap-5 sm:grid-cols-2">

          {/* Empresas */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
              </svg>
              Empresas
            </label>
            <MultiCompanySelect
              companies={allowedCompanies}
              selected={selectedCompanyIds}
              onChange={(ids) => void handleSelectCompanies(ids)}
              disabled={isSavingCompany}
            />
          </div>

          {/* Período */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Período
            </label>
            <PeriodFilter
              granularity={granularity}
              year={selectedYear}
              month={selectedMonth}
              years={years}
              monthsForYear={monthsForYear}
              onGranularityChange={setGranularity}
              onYearChange={(y) => {
                setSelectedYear(y);
                const first = mergedSummaries.find((s) => s.referenceMonth.startsWith(y));
                if (first) setSelectedMonth(first.referenceMonth.slice(5, 7));
              }}
              onMonthChange={setSelectedMonth}
            />
          </div>
        </div>

        {contextMessage ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {contextMessage}
          </p>
        ) : null}
      </div>

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
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
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
            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                {isMultiCompany ? (
                  <>
                    <strong className="text-zinc-600 dark:text-zinc-300">{companiesData.length} empresas</strong>
                    {" · "}consolidado
                  </>
                ) : (
                  <>
                    Referência:{" "}
                    <strong className="text-zinc-600 dark:text-zinc-300">
                      {granularity === "monthly"
                        ? `${MONTH_LABELS[selectedMonth] ?? selectedMonth}/${selectedYear}`
                        : selectedYear}
                    </strong>
                  </>
                )}
              </p>
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
          )}
          {recalcMsg ? (
            <p className="mt-1 text-right text-xs text-zinc-500 dark:text-zinc-400">{recalcMsg}</p>
          ) : null}

          {/* ══ RESULTADO SUMMARY BAR ══ */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className={`col-span-1 flex flex-col justify-center rounded-2xl border-2 p-5 ${
              get(d, "RESULTADO") >= 0
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/40"
                : "border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/40"
            }`}>
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Resultado do Período</p>
              <p className={`mt-2 text-3xl font-extrabold ${
                get(d, "RESULTADO") >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
              }`}>
                {formatCurrency(get(d, "RESULTADO"))}
              </p>
              <p className={`mt-1 text-xs font-semibold ${
                get(d, "RESULTADO") >= 0 ? "text-emerald-500" : "text-red-500"
              }`}>
                {get(d, "RESULTADO") >= 0 ? "▲ Superávit" : "▼ Déficit"}
              </p>
            </div>
            <KpiCard label="Total de Receitas" value={get(d, "RECEITAS_TOTAL")} color="green" icon={Icons.trending} />
            <KpiCard label="Total de Despesas" value={get(d, "DESPESAS_TOTAL")} color="red" icon={Icons.tax} />
          </div>

          {/* ══ ANÁLISE ANUAL GROUP ══ */}
          <div className="mt-5 rounded-2xl border border-zinc-200/80 bg-zinc-50/30 p-5 dark:border-zinc-700/40 dark:bg-zinc-800/20 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
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

            <div className="grid gap-4 lg:grid-cols-5">
              {/* Bar chart */}
              <div className="col-span-3 rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-700/50 dark:bg-zinc-900/50">
                <p className="mb-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Receitas × Despesas por período</p>
                {chartSeries.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={chartSeries} barCategoryGap="30%" barGap={3}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                      <XAxis dataKey="period" tick={{ fontSize: 11, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={formatCurrencyShort} width={70} tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={currencyTooltipFormatter} contentStyle={{ fontSize: 12, borderRadius: 10, border: `1px solid ${chartTheme.tooltip.border}`, background: chartTheme.tooltip.background, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }} labelStyle={{ fontWeight: 600, color: chartTheme.tooltip.label }} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <ReferenceLine y={0} stroke={chartTheme.grid} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">Sem dados no ano selecionado.</p>
                )}
              </div>

              {/* Pie chart */}
              <div className="col-span-2 rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-700/50 dark:bg-zinc-900/50">
                <p className="mb-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Composição das despesas</p>
                {expensePieData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={expensePieData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={2} dataKey="value">
                          {expensePieData.map((entry, index) => (
                            <Cell key={index} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip formatter={currencyTooltipFormatter} contentStyle={{ fontSize: 12, borderRadius: 10, border: `1px solid ${chartTheme.tooltip.border}`, background: chartTheme.tooltip.background }} labelStyle={{ color: chartTheme.tooltip.label }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <ul className="mt-2 grid grid-cols-2 gap-1">
                      {expensePieData.map((item) => (
                        <li key={item.name} className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.fill }} />
                          <span>{item.name}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">Sem despesas no período.</p>
                )}
              </div>
            </div>

            {/* Line chart — resultado trend */}
            {chartSeries.length > 1 && (
              <div className="mt-4 rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-700/50 dark:bg-zinc-900/50">
                <p className="mb-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Tendência do resultado</p>
                <ResponsiveContainer width="100%" height={170}>
                  <LineChart data={chartSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={formatCurrencyShort} width={70} tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={currencyTooltipFormatter} contentStyle={{ fontSize: 12, borderRadius: 10, border: `1px solid ${chartTheme.tooltip.border}`, background: chartTheme.tooltip.background, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }} labelStyle={{ fontWeight: 600, color: chartTheme.tooltip.label }} />
                    <ReferenceLine y={0} stroke={chartTheme.grid} strokeDasharray="4 2" />
                    <Line type="monotone" dataKey="Resultado" stroke={theme === "dark" ? "#60a5fa" : "#0f4c81"} strokeWidth={2.5} dot={{ fill: theme === "dark" ? "#60a5fa" : "#0f4c81", r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Multi-company comparative section ── */}
            {isMultiCompany && comparativeSeries.length > 0 && (
              <div className="mt-4 rounded-xl border border-purple-100 bg-purple-50/30 p-4 dark:border-purple-900/30 dark:bg-purple-950/10">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400">
                    {Icons.building}
                  </span>
                  <p className="text-xs font-semibold text-purple-800 dark:text-purple-300">Receitas por empresa</p>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={comparativeSeries} barCategoryGap="25%" barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={formatCurrencyShort} width={70} tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={currencyTooltipFormatter} contentStyle={{ fontSize: 12, borderRadius: 10, border: `1px solid ${chartTheme.tooltip.border}`, background: chartTheme.tooltip.background, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }} labelStyle={{ fontWeight: 600, color: chartTheme.tooltip.label }} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    {companiesData.map((company, i) => (
                      <Bar
                        key={company.companyId}
                        dataKey={company.companyName}
                        fill={COMPANY_COLORS[i % COMPANY_COLORS.length]}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Heatmap: Resultado por empresa × período ── */}
            {isMultiCompany && heatmapData && (
              <div className="mt-4 rounded-xl border border-zinc-100 bg-white p-4 dark:border-zinc-700/50 dark:bg-zinc-900/50">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                    {Icons.chart}
                  </span>
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Mapa de calor — Resultado por empresa × período</p>
                </div>
                <HeatmapChart
                  data={heatmapData}
                  subtitle="Cada célula mostra o Resultado (Receitas − Despesas) da empresa naquele período"
                />
              </div>
            )}
          </div>

          {/* ══ RECEITAS + DESPESAS ══ */}
          <div className="mt-5 grid gap-4 lg:grid-cols-2">

            {/* RECEITAS GROUP */}
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-5 dark:border-emerald-900/30 dark:bg-emerald-950/10 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                  {Icons.trending}
                </span>
                <h2 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Receitas</h2>
                <div className="ml-2 h-px flex-1 bg-emerald-200/70 dark:bg-emerald-900/40" />
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(get(d, "RECEITAS_TOTAL"))}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <KpiCard label="Faturamento" value={get(d, "FATURAMENTO")} color="green"
                  sub="NFs emitidas" icon={Icons.invoice} />
                <KpiCard label="NFs Recebidas" value={get(d, "NFS_RECEBIDAS")} color="teal"
                  sub="Pagamentos recebidos" icon={Icons.invoice} />
                <KpiCard label="Rendimento Bruto" value={get(d, "RENDIMENTO_BRUTO")} color="blue"
                  sub="Aplicações financeiras" icon={Icons.chart} />
                <KpiCard label="Aluguel" value={get(d, "ALUGUEL")} color="teal"
                  icon={Icons.building} />
              </div>

              {(get(d, "LRA2_INVEST") + get(d, "LRA3_INVEST") + get(d, "B_VISTA_INVEST") + get(d, "TRAPICHE_INVEST")) > 0 ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <KpiCard label="LRA2 (Invest.)" value={get(d, "LRA2_INVEST")} color="blue" />
                  <KpiCard label="LRA3 (Invest.)" value={get(d, "LRA3_INVEST")} color="blue" />
                  <KpiCard label="B. Vista (Invest.)" value={get(d, "B_VISTA_INVEST")} color="blue" />
                  <KpiCard label="Trapiche (Invest.)" value={get(d, "TRAPICHE_INVEST")} color="blue" />
                </div>
              ) : null}

              {/* NFs comparison */}
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "NFs Emitidas", value: get(d, "FATURAMENTO"), color: "text-emerald-700 dark:text-emerald-400" },
                  { label: "NFs Recebidas", value: get(d, "NFS_RECEBIDAS"), color: "text-teal-700 dark:text-teal-400" },
                  {
                    label: "Diferença",
                    value: get(d, "FATURAMENTO") - get(d, "NFS_RECEBIDAS"),
                    color: get(d, "FATURAMENTO") - get(d, "NFS_RECEBIDAS") >= 0 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400",
                  },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center rounded-xl border border-emerald-100 bg-white/80 px-4 py-3 dark:border-emerald-900/30 dark:bg-zinc-800/50">
                    <div>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">{label}</p>
                      <p className={`mt-0.5 text-base font-bold ${color}`}>{formatCurrency(value)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* DESPESAS GROUP */}
            <div className="rounded-2xl border border-red-100 bg-red-50/20 p-5 dark:border-red-900/30 dark:bg-red-950/10 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400">
                  {Icons.tax}
                </span>
                <h2 className="text-sm font-bold text-red-800 dark:text-red-300">Despesas</h2>
                <div className="ml-2 h-px flex-1 bg-red-200/70 dark:bg-red-900/40" />
                <span className="text-xs font-semibold text-red-700 dark:text-red-400">
                  {formatCurrency(get(d, "DESPESAS_TOTAL"))}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <KpiCard label="Impostos" value={get(d, "IMPOSTOS")} color="red" icon={Icons.tax} />
                <KpiCard label="IOF / IRRF" value={get(d, "IOF_IRRF")} color="red" icon={Icons.dollar} />
                <KpiCard label="Demais Despesas" value={get(d, "DEMAIS_DESPESAS")} color="amber" icon={Icons.chart} />
                <KpiCard label="Condomínio" value={get(d, "CONDOMINIO")} color="amber" icon={Icons.building} />
              </div>

              {(get(d, "LRA2_DESP") + get(d, "LRA3_DESP") + get(d, "B_VISTA_DESP") + get(d, "TRAPICHE_DESP")) > 0 ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <KpiCard label="LRA2 (Desp.)" value={get(d, "LRA2_DESP")} color="red" />
                  <KpiCard label="LRA3 (Desp.)" value={get(d, "LRA3_DESP")} color="red" />
                  <KpiCard label="B. Vista (Desp.)" value={get(d, "B_VISTA_DESP")} color="red" />
                  <KpiCard label="Trapiche (Desp.)" value={get(d, "TRAPICHE_DESP")} color="red" />
                </div>
              ) : null}
            </div>

          </div>

          {/* ══ BOTTOM ROW ══ */}
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {/* Saldo Bancário */}
            <div className="rounded-2xl border border-purple-100 bg-purple-50/20 p-5 dark:border-purple-900/30 dark:bg-purple-950/10">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400">
                  {Icons.bank}
                </span>
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Saldos Bancários</h3>
              </div>
              <KpiCard label="Saldo Disponível" value={get(d, "SD_BANCARIO")} color="purple"
                sub="Soma de todas as contas 1.1.1" icon={Icons.bank} />
            </div>

            {/* Rendimento Passivo */}
            <div className="rounded-2xl border border-teal-100 bg-teal-50/20 p-5 dark:border-teal-900/30 dark:bg-teal-950/10">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400">
                  {Icons.trending}
                </span>
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Rendimento Passivo</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <KpiCard label="Rentabilidade" value={get(d, "RENTABILIDADE")} color="teal"
                  sub="Rend. bruto − IOF/IRRF" icon={Icons.trending} />
                <KpiCard label="Aluguel Líquido" value={get(d, "ALUGUEL_LIQUIDO")} color="teal"
                  sub="Aluguel − Condomínio" icon={Icons.building} />
              </div>
            </div>

            {/* Distribuição de Lucros */}
            <div className="rounded-2xl border border-amber-100 bg-amber-50/20 p-5 dark:border-amber-900/30 dark:bg-amber-950/10">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
                  {Icons.dollar}
                </span>
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Distribuição de Lucros</h3>
              </div>
              <KpiCard label="Distribuição de Lucros" value={get(d, "DISTRIB_LUCROS")} color="purple"
                icon={Icons.dollar} />
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
