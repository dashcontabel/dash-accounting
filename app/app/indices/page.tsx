"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

import AppShell from "@/app/components/app-shell";
import MultiCompanySelect from "@/app/components/multi-company-select";
import PeriodFilter from "@/app/components/period-filter";
import { useTheme } from "@/app/components/theme-provider";
import {
  aggregateSummaries,
  mergeCompanySummaries,
  type PeriodGranularity,
  type MonthlySummary,
} from "@/lib/dashboard/periods";
import { companyDataCache, consumeStaleCompanyIds } from "@/lib/dashboard/cache";
import type { CompanyData } from "@/lib/dashboard/types";

// ── Types ────────────────────────────────────────────────────────────────────

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

type IndiceStatus = "good" | "warning" | "bad" | "undefined";

// ── Index definitions ─────────────────────────────────────────────────────────

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

const INDICES_CONFIG = [
  {
    key: "LC",
    label: "Liquidez Corrente",
    abbrev: "LC",
    formula: "Ativo Circulante / Passivo Circulante",
    formulaShort: "AC / PC",
    focusAnalitico: "Capacidade de pagamento no curto prazo",
    interpretations: {
      good: "Acima de 1,00 — folga financeira operacional.",
      warning: "Entre 0,50 e 1,00 — atenção ao fluxo de caixa.",
      bad: "Abaixo de 0,50 — risco de capital de giro negativo.",
    },
    thresholds: { good: 1.0, warning: 0.5 },
    chartColor: "#10b981",
    calculate: (d: Record<string, number>): number | null => {
      const pc = d["PASSIVO_CIRCULANTE"] ?? 0;
      if (pc === 0) return null;
      return (d["ATIVO_CIRCULANTE"] ?? 0) / pc;
    },
    requiredFields: ["ATIVO_CIRCULANTE", "PASSIVO_CIRCULANTE"],
  },
  {
    key: "LS",
    label: "Liquidez Seca",
    abbrev: "LS",
    formula: "(Ativo Circulante − Estoques) / Passivo Circulante",
    formulaShort: "(AC − Est.) / PC",
    focusAnalitico: "Solvência imediata sem depender de vendas",
    interpretations: {
      good: "Próxima ou acima de 1,00 — independência de estoques.",
      warning: "Entre 0,50 e 0,99 — empresa depende parcialmente de vendas.",
      bad: "Abaixo de 0,50 — alto risco se as vendas travarem.",
    },
    thresholds: { good: 1.0, warning: 0.5 },
    chartColor: "#0f4c81",
    calculate: (d: Record<string, number>): number | null => {
      const pc = d["PASSIVO_CIRCULANTE"] ?? 0;
      if (pc === 0) return null;
      return ((d["ATIVO_CIRCULANTE"] ?? 0) - (d["ESTOQUES"] ?? 0)) / pc;
    },
    requiredFields: ["ATIVO_CIRCULANTE", "PASSIVO_CIRCULANTE", "ESTOQUES"],
  },
  {
    key: "LI",
    label: "Liquidez Imediata",
    abbrev: "LI",
    formula: "Disponibilidades / Passivo Circulante",
    formulaShort: "Disp. / PC",
    focusAnalitico: "Recursos prontos para uso (caixa e bancos)",
    interpretations: {
      good: "Acima de 0,30 — caixa suficiente para emergências imediatas.",
      warning: "Entre 0,10 e 0,29 — caixa apertado; monitorar folha de pagamento.",
      bad: "Abaixo de 0,10 — risco elevado de inadimplência imediata.",
    },
    thresholds: { good: 0.3, warning: 0.1 },
    chartColor: "#f59e0b",
    calculate: (d: Record<string, number>): number | null => {
      const pc = d["PASSIVO_CIRCULANTE"] ?? 0;
      if (pc === 0) return null;
      return (d["DISPONIBILIDADES"] ?? 0) / pc;
    },
    requiredFields: ["DISPONIBILIDADES", "PASSIVO_CIRCULANTE"],
  },
  {
    key: "LG",
    label: "Liquidez Geral",
    abbrev: "LG",
    formula: "(AC + RLP) / (PC + PNC)",
    formulaShort: "(AC + RLP) / (PC + PNC)",
    focusAnalitico: "Segurança financeira em longo prazo",
    interpretations: {
      good: "Acima de 1,00 — estrutura financeira sólida no longo prazo.",
      warning: "Entre 0,50 e 1,00 — empresa em processo de alavancagem; monitorar.",
      bad: "Abaixo de 0,50 — endividamento estrutural preocupante.",
    },
    thresholds: { good: 1.0, warning: 0.5 },
    chartColor: "#a855f7",
    calculate: (d: Record<string, number>): number | null => {
      const pc = d["PASSIVO_CIRCULANTE"] ?? 0;
      const pnc = d["PASSIVO_NAO_CIRCULANTE"] ?? 0;
      const denom = pc + pnc;
      if (denom === 0) return null;
      return ((d["ATIVO_CIRCULANTE"] ?? 0) + (d["REALIZAVEL_LONGO_PRAZO"] ?? 0)) / denom;
    },
    requiredFields: [
      "ATIVO_CIRCULANTE",
      "PASSIVO_CIRCULANTE",
      "REALIZAVEL_LONGO_PRAZO",
      "PASSIVO_NAO_CIRCULANTE",
    ],
  },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

function getStatus(
  value: number | null,
  thresholds: { good: number; warning: number },
): IndiceStatus {
  if (value === null) return "undefined";
  if (value >= thresholds.good) return "good";
  if (value >= thresholds.warning) return "warning";
  return "bad";
}

function formatRatio(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_STYLES: Record<IndiceStatus, { card: string; value: string; badge: string; dot: string }> = {
  good: {
    card: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50",
    value: "text-emerald-700 dark:text-emerald-300",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  warning: {
    card: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50",
    value: "text-amber-700 dark:text-amber-300",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  bad: {
    card: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900/50",
    value: "text-red-700 dark:text-red-300",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
    dot: "bg-red-500",
  },
  undefined: {
    card: "bg-zinc-50 border-zinc-200 dark:bg-zinc-800/40 dark:border-zinc-700",
    value: "text-zinc-400 dark:text-zinc-500",
    badge: "bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400",
    dot: "bg-zinc-400",
  },
};

// ── Index Card ─────────────────────────────────────────────────────────────────

function IndexCard({
  config,
  value,
  isMapped,
}: {
  config: (typeof INDICES_CONFIG)[number];
  value: number | null;
  isMapped: boolean;
}) {
  const status = isMapped ? getStatus(value, config.thresholds) : "undefined";
  const s = STATUS_STYLES[status];
  const interpretation = isMapped && status !== "undefined"
    ? config.interpretations[status]
    : null;

  return (
    <article className={`rounded-2xl border p-5 transition-shadow hover:shadow-md ${s.card}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {config.label}
          </p>
          <code className="mt-0.5 block text-[11px] text-zinc-400 dark:text-zinc-500">
            {config.formulaShort}
          </code>
        </div>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-bold text-xs ${s.badge}`}>
          {config.abbrev}
        </span>
      </div>

      <p className={`mt-4 text-3xl font-bold tabular-nums tracking-tight ${s.value}`}>
        {isMapped ? formatRatio(value) : "—"}
      </p>

      {isMapped ? (
        <>
          {status !== "undefined" && (
            <div className="mt-3 flex items-start gap-2">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
              <p className="text-[12px] leading-snug text-zinc-600 dark:text-zinc-400">
                {interpretation}
              </p>
            </div>
          )}
          <p className="mt-3 text-[11px] text-zinc-400 dark:text-zinc-500">
            {config.focusAnalitico}
          </p>
        </>
      ) : (
        <div className="mt-3 rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-700/50">
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Aguardando mapeamento das contas:{" "}
            <span className="font-mono font-semibold">
              {config.requiredFields.join(", ")}
            </span>
          </p>
        </div>
      )}
    </article>
  );
}

// ── Tooltip customizado ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function IndiceTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
      <p className="mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">{label}</p>
      {payload.map((entry: { name: string; value: number; color: string }) => (
        <div key={entry.name} className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span className="font-medium text-zinc-700 dark:text-zinc-200">{entry.name}:</span>
          <span className="tabular-nums text-zinc-800 dark:text-zinc-100">
            {formatRatio(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function IndicesPage() {
  const router = useRouter();
  const { theme } = useTheme();

  const chartTheme = {
    grid: theme === "dark" ? "#2d3748" : "#e4e4e7",
    tick: theme === "dark" ? "#6b7280" : "#a1a1aa",
  };

  // ── Auth state
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"ADMIN" | "CLIENT" | null>(null);
  const [allowedCompanies, setAllowedCompanies] = useState<
    Array<{ id: string; name: string; groupId: string }>
  >([]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);

  // ── Data state
  const [companiesData, setCompaniesData] = useState<CompanyData[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // ── Period state
  const [granularity, setGranularity] = useState<PeriodGranularity>("monthly");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [rangeFrom, setRangeFrom] = useState("01");
  const [rangeTo, setRangeTo] = useState("12");

  // ── Auth & company list ────────────────────────────────────────────────────

  useEffect(() => {
    let isMounted = true;

    async function loadMe() {
      for (const id of consumeStaleCompanyIds()) {
        companyDataCache.delete(id);
      }
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

  // ── Load summaries ────────────────────────────────────────────────────────

  const loadSummaries = useCallback(async (ids: string[]) => {
    if (ids.length === 0) { setCompaniesData([]); return; }

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
              summaries: c.summaries.map((s) => ({
                ...s,
                referenceMonth: s.referenceMonth.slice(0, 7),
              })),
            });
          }
        }
      } catch {
        // non-fatal
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

  // ── Derived data ──────────────────────────────────────────────────────────

  const mergedSummaries = useMemo(
    () => mergeCompanySummaries(companiesData),
    [companiesData],
  );

  const years = useMemo(
    () => [...new Set(mergedSummaries.map((s) => s.referenceMonth.slice(0, 4)))].sort(),
    [mergedSummaries],
  );

  const monthsForYear = useMemo(
    () =>
      mergedSummaries
        .filter((s) => s.referenceMonth.startsWith(selectedYear))
        .map((s) => s.referenceMonth),
    [mergedSummaries, selectedYear],
  );

  const aggregatedPeriods = useMemo(
    () =>
      aggregateSummaries(
        mergedSummaries,
        granularity,
        selectedYear,
        rangeFrom,
        rangeTo,
      ),
    [mergedSummaries, granularity, selectedYear, rangeFrom, rangeTo],
  );

  const activePeriod = useMemo(
    () =>
      granularity === "monthly"
        ? null
        : (aggregatedPeriods[aggregatedPeriods.length - 1] ?? null),
    [granularity, aggregatedPeriods],
  );

  // Reset year/month when data loads
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

  // Active period data
  const activeSummary = useMemo(() => {
    if (granularity === "monthly") {
      return mergedSummaries.find(
        (s) => s.referenceMonth === `${selectedYear}-${selectedMonth}`,
      );
    }
    if (!activePeriod) return undefined;
    return {
      referenceMonth: activePeriod.label,
      dataJson: activePeriod.dataJson,
    };
  }, [mergedSummaries, granularity, selectedYear, selectedMonth, activePeriod]);

  const d = activeSummary?.dataJson ?? {};

  // Detect whether balance sheet fields have been mapped at all
  const hasAnyMapping = useMemo(() => {
    const allFields = [
      "ATIVO_CIRCULANTE",
      "PASSIVO_CIRCULANTE",
      "ESTOQUES",
      "DISPONIBILIDADES",
      "REALIZAVEL_LONGO_PRAZO",
      "PASSIVO_NAO_CIRCULANTE",
    ];
    return mergedSummaries.some((s) =>
      allFields.some((f) => s.dataJson[f] !== undefined),
    );
  }, [mergedSummaries]);

  // Per-index values
  const indexValues = useMemo(
    () =>
      INDICES_CONFIG.map((cfg) => ({
        key: cfg.key,
        value: cfg.calculate(d),
        isMapped: cfg.requiredFields.some((f) => d[f] !== undefined),
      })),
    [d],
  );

  // Historical line chart data (monthly for selected year)
  const historicalSeries = useMemo(() => {
    const monthlyPeriods = aggregateSummaries(
      mergedSummaries,
      "monthly",
      selectedYear,
      "01",
      "12",
    );
    return monthlyPeriods.map((p) => {
      const row: Record<string, string | number | null> = { period: p.label };
      for (const cfg of INDICES_CONFIG) {
        row[cfg.abbrev] = cfg.calculate(p.dataJson);
      }
      return row;
    });
  }, [mergedSummaries, selectedYear]);

  const hasHistoricalData = historicalSeries.some((row) =>
    INDICES_CONFIG.some((cfg) => row[cfg.abbrev] !== null),
  );

  // ── Empty states ──────────────────────────────────────────────────────────

  const isLoading = !userEmail || (selectedCompanyIds.length > 0 && loadingSummary);
  const hasNoData = !loadingSummary && mergedSummaries.length === 0 && selectedCompanyIds.length > 0;

  return (
    <AppShell role={userRole} email={userEmail} onLogout={undefined}>
      <div className="mx-auto max-w-6xl space-y-6 px-4 pb-10 pt-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Índices de Liquidez
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Análise da capacidade de pagamento e saúde financeira das empresas selecionadas.
          </p>
        </div>

        {/* Filters */}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <MultiCompanySelect
            companies={allowedCompanies}
            selected={selectedCompanyIds}
            onChange={setSelectedCompanyIds}
          />
          {loadingSummary && (
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Carregando…
            </div>
          )}
        </div>

        {mergedSummaries.length > 0 && (
          <PeriodFilter
            granularity={granularity}
            year={selectedYear}
            month={selectedMonth}
            rangeFrom={rangeFrom}
            rangeTo={rangeTo}
            years={years}
            monthsForYear={monthsForYear}
            onGranularityChange={setGranularity}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
            onRangeFromChange={setRangeFrom}
            onRangeToChange={setRangeTo}
          />
        )}

        {/* Setup notice when no balance sheet fields are mapped */}
        {!isLoading && mergedSummaries.length > 0 && !hasAnyMapping && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-800/50 dark:bg-amber-950/20">
            <div className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 shrink-0 text-amber-500"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-300">
                  Mapeamentos de balanço patrimonial não configurados
                </p>
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                  Para calcular os índices, o administrador precisa criar mapeamentos com os
                  campos:{" "}
                  <code className="rounded bg-amber-100 px-1 py-0.5 text-xs font-mono dark:bg-amber-900/50">
                    ATIVO_CIRCULANTE
                  </code>
                  ,{" "}
                  <code className="rounded bg-amber-100 px-1 py-0.5 text-xs font-mono dark:bg-amber-900/50">
                    PASSIVO_CIRCULANTE
                  </code>
                  ,{" "}
                  <code className="rounded bg-amber-100 px-1 py-0.5 text-xs font-mono dark:bg-amber-900/50">
                    ESTOQUES
                  </code>
                  ,{" "}
                  <code className="rounded bg-amber-100 px-1 py-0.5 text-xs font-mono dark:bg-amber-900/50">
                    DISPONIBILIDADES
                  </code>
                  ,{" "}
                  <code className="rounded bg-amber-100 px-1 py-0.5 text-xs font-mono dark:bg-amber-900/50">
                    REALIZAVEL_LONGO_PRAZO
                  </code>
                  ,{" "}
                  <code className="rounded bg-amber-100 px-1 py-0.5 text-xs font-mono dark:bg-amber-900/50">
                    PASSIVO_NAO_CIRCULANTE
                  </code>
                  .
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
              />
            ))}
          </div>
        )}

        {/* No company selected */}
        {!isLoading && selectedCompanyIds.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <svg
              className="h-10 w-10 text-zinc-300 dark:text-zinc-600"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"
              />
            </svg>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Selecione uma empresa para ver os índices.
            </p>
          </div>
        )}

        {/* No data imported */}
        {hasNoData && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Nenhum dado importado para a empresa selecionada.
            </p>
          </div>
        )}

        {/* Index cards */}
        {!isLoading && mergedSummaries.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {indexValues.map((iv) => {
                const cfg = INDICES_CONFIG.find((c) => c.key === iv.key)!;
                return (
                  <IndexCard
                    key={iv.key}
                    config={cfg}
                    value={iv.value}
                    isMapped={iv.isMapped}
                  />
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                Saudável
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                Atenção
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                Risco
              </span>
            </div>

            {/* Formula reference table */}
            <section className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800/60">
              <div className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-700">
                <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                  Referência — Fórmulas e Interpretações
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-700">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Índice
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Fórmula
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Foco Analítico
                      </th>
                      <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 lg:table-cell">
                        Interpretação (bom)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {INDICES_CONFIG.map((cfg, i) => {
                      const iv = indexValues.find((v) => v.key === cfg.key)!;
                      const status = iv.isMapped
                        ? getStatus(iv.value, cfg.thresholds)
                        : "undefined";
                      const s = STATUS_STYLES[status];
                      return (
                        <tr
                          key={cfg.key}
                          className={`${i < INDICES_CONFIG.length - 1 ? "border-b border-zinc-100 dark:border-zinc-700" : ""}`}
                        >
                          <td className="px-5 py-3 font-medium text-zinc-800 dark:text-zinc-100">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex h-6 w-8 items-center justify-center rounded-md text-[11px] font-bold ${s.badge}`}
                              >
                                {cfg.abbrev}
                              </span>
                              <span className="hidden sm:inline">{cfg.label}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">
                            <code className="text-xs">{cfg.formula}</code>
                          </td>
                          <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">
                            {cfg.focusAnalitico}
                          </td>
                          <td className="hidden px-5 py-3 text-zinc-600 dark:text-zinc-400 lg:table-cell">
                            {cfg.interpretations.good}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Historical chart */}
            {hasHistoricalData && (
              <section className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800/60">
                <div className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-700">
                  <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                    Evolução Histórica — {selectedYear}
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                    Linha de referência em 1,00 indica equilíbrio financeiro mínimo.
                  </p>
                </div>
                <div className="p-5">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={historicalSeries}
                      margin={{ top: 4, right: 8, bottom: 0, left: -16 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                      <XAxis
                        dataKey="period"
                        tick={{ fontSize: 11, fill: chartTheme.tick }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: chartTheme.tick }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => v.toFixed(2)}
                      />
                      <Tooltip content={<IndiceTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                        formatter={(value: string) => (
                          <span className="text-zinc-600 dark:text-zinc-300">{value}</span>
                        )}
                      />
                      <ReferenceLine y={1} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1} />
                      {INDICES_CONFIG.map((cfg) => (
                        <Line
                          key={cfg.key}
                          type="monotone"
                          dataKey={cfg.abbrev}
                          name={cfg.label}
                          stroke={cfg.chartColor}
                          strokeWidth={2}
                          dot={{ r: 3, fill: cfg.chartColor }}
                          activeDot={{ r: 5 }}
                          connectNulls={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
