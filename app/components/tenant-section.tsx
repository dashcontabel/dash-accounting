"use client";

import { useEffect, useMemo, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type TenantItem = {
  description: string;
  byCostCenter: Record<string, number>;
  totalCredit: number;
  annualForecast: number;
  balance: number;
};

type TenantSummaryResponse = {
  hasTenantData: boolean;
  year: string;
  companyId: string;
  totalMonths: number;
  costCenters: string[];
  items: TenantItem[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCurrencyShort(value: number) {
  if (Math.abs(value) >= 1_000_000) return `R$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `R$${(value / 1_000).toFixed(1)}k`;
  return `R$${value.toFixed(0)}`;
}

// Palette cycling for "other" cost centers beyond the two primary ones
const OTHER_CC_COLORS = [
  { dot: "bg-violet-500", text: "text-violet-600 dark:text-violet-400", badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  { dot: "bg-cyan-500",   text: "text-cyan-600 dark:text-cyan-400",     badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" },
  { dot: "bg-amber-500",  text: "text-amber-600 dark:text-amber-400",   badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
];

function ccStyle(cc: string, idx: number) {
  const n = cc.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (n.includes("condomin"))
    return { dot: "bg-violet-500", text: "text-violet-600 dark:text-violet-400", badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" };
  if (n.includes("placa") || (n.includes("adm") && !n.includes("admin")))
    return { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" };
  return OTHER_CC_COLORS[idx % OTHER_CC_COLORS.length]!;
}

// ── Individual tenant card ────────────────────────────────────────────────────

function TenantCard({
  item,
  costCenters,
  totalMonths,
}: {
  item: TenantItem;
  costCenters: string[];
  totalMonths: number;
}) {
  const [open, setOpen] = useState(false);

  const received = item.totalCredit;
  const forecast = item.annualForecast;
  const receivedPct = forecast > 0 ? Math.min((received / forecast) * 100, 100) : 100;
  const remainingPct = 100 - receivedPct;
  const isComplete = received >= forecast;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700/50 dark:bg-zinc-900/50 overflow-hidden transition-shadow hover:shadow-md">
      {/* ── Header (always visible, clickable) ── */}
      <button
        type="button"
        className="w-full px-4 pt-4 pb-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="min-w-0">
            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100 truncate leading-tight">
              {item.description}
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
              Locatário
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {formatCurrencyShort(received)}
            </p>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 tabular-nums">
              / {formatCurrencyShort(forecast)}/ano
            </p>
          </div>
        </div>

        {/* ── Progress bar: blue = received, red = a receber ── */}
        <div
          className="relative h-5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
          title={`Recebido: ${formatCurrency(received)} · Previsão anual: ${formatCurrency(forecast)}`}
        >
          {/* Blue: already received */}
          {receivedPct > 0 && (
            <div
              className="absolute left-0 top-0 h-full bg-blue-500 flex items-center justify-center transition-all"
              style={{ width: `${receivedPct}%` }}
            >
              {receivedPct >= 16 && (
                <span className="text-[9px] font-bold text-white select-none">
                  {receivedPct.toFixed(0)}%
                </span>
              )}
            </div>
          )}
          {/* Red: not yet received */}
          {remainingPct > 0 && !isComplete && (
            <div
              className="absolute top-0 h-full bg-red-400/80 dark:bg-red-500/70 flex items-center justify-center transition-all"
              style={{ left: `${receivedPct}%`, width: `${remainingPct}%` }}
            >
              {remainingPct >= 16 && (
                <span className="text-[9px] font-bold text-white select-none">
                  {remainingPct.toFixed(0)}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Legend ── */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Recebido: {formatCurrency(received)}
          </span>
          {isComplete ? (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Quitado ✓
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-500 dark:text-red-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              A receber: {formatCurrency(Math.max(0, forecast - received))}
            </span>
          )}
          <span className="ml-auto text-zinc-400 dark:text-zinc-500">
            {open ? "▲ ocultar" : "▼ ver composição"}
          </span>
        </div>
      </button>

      {/* ── Expanded: CC breakdown ── */}
      {open && (
        <div className="border-t border-zinc-100 dark:border-zinc-700/50 px-4 py-3 bg-zinc-50/50 dark:bg-zinc-800/30">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Composição do recebido
          </p>
          <div className="flex flex-col gap-1.5">
            {costCenters.map((cc, idx) => {
              const amount = item.byCostCenter[cc] ?? 0;
              if (amount === 0) return null;
              const c = ccStyle(cc, idx);
              const pct = received > 0 ? (amount / received) * 100 : 0;
              return (
                <div key={cc} className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${c.dot}`} />
                  <span className="flex-1 text-xs text-zinc-600 dark:text-zinc-300 truncate">{cc}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.badge}`}>
                    {pct.toFixed(1)}%
                  </span>
                  <span className={`text-xs font-bold tabular-nums ${c.text}`}>
                    {formatCurrency(amount)}
                  </span>
                </div>
              );
            })}
          </div>
          {totalMonths < 12 && (
            <p className="mt-2 text-[10px] text-zinc-400 dark:text-zinc-500">
              ⓘ Previsão anual extrapolada: média de {totalMonths} mês{totalMonths !== 1 ? "es" : ""} × 12.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Consolidated summary card ─────────────────────────────────────────────────

function TenantSummary({
  items,
  costCenters,
}: {
  items: TenantItem[];
  costCenters: string[];
}) {
  const totalReceived = items.reduce((s, i) => s + i.totalCredit, 0);
  const totalForecast = items.reduce((s, i) => s + i.annualForecast, 0);
  const totalBalance  = Math.max(0, totalForecast - totalReceived);
  const receivedPct   = totalForecast > 0 ? Math.min((totalReceived / totalForecast) * 100, 100) : 100;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-700/50 dark:bg-zinc-800/30">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        Consolidado — todos os locatários
      </p>

      {/* KPI row — stacks on mobile, 3 cols on sm+ */}
      <div className="mb-3 flex flex-col gap-1.5 sm:grid sm:grid-cols-3 sm:gap-3">
        <div className="flex items-baseline justify-between gap-2 sm:block">
          <p className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Recebido</p>
          <p className="text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums">
            {formatCurrency(totalReceived)}
          </p>
        </div>
        <div className="flex items-baseline justify-between gap-2 sm:block">
          <p className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">A Receber</p>
          <p className="text-sm font-bold text-red-500 dark:text-red-400 tabular-nums">
            {formatCurrency(totalBalance)}
          </p>
        </div>
        <div className="flex items-baseline justify-between gap-2 sm:block">
          <p className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Previsão/ano</p>
          <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200 tabular-nums">
            {formatCurrency(totalForecast)}
          </p>
        </div>
      </div>

      {/* Global progress bar */}
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className="absolute left-0 top-0 h-full bg-blue-500 transition-all"
          style={{ width: `${receivedPct}%` }}
        />
      </div>
      <p className="mt-1 text-right text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
        {receivedPct.toFixed(1)}% recebido
      </p>

      {/* CC breakdown badges */}
      {costCenters.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {costCenters.map((cc, idx) => {
            const total = items.reduce((s, i) => s + (i.byCostCenter[cc] ?? 0), 0);
            if (total === 0) return null;
            const c = ccStyle(cc, idx);
            return (
              <span
                key={cc}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${c.badge}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                {cc}: {formatCurrency(total)}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main exported component ───────────────────────────────────────────────────

export default function TenantSection({
  companyId,
  year,
}: {
  companyId: string;
  year: string;
}) {
  const [data, setData] = useState<TenantSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || !year) {
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(
      `/api/dashboard/tenants?companyId=${encodeURIComponent(companyId)}&year=${encodeURIComponent(year)}`,
    )
      .then((r) => r.json())
      .then((json: TenantSummaryResponse) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setError("Erro ao carregar dados de locatários.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, year]);

  // TEMP FIX (apresentação): mescla "Sem Centro de Custo" no PLACA/ADM.
  const displayData = useMemo((): TenantSummaryResponse | null => {
    if (!data) return null;
    const norm = (s: string) =>
      s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const isSemCC = (cc: string) => {
      const n = norm(cc);
      return n.includes("sem centro") || n === "sem cc" || cc.trim() === "";
    };
    const isPlaca = (cc: string) => {
      const n = norm(cc);
      return n.includes("placa") || (n.includes("adm") && !n.includes("admin"));
    };
    const semCCKey = data.costCenters.find(isSemCC);
    const placaKey = data.costCenters.find(isPlaca);
    if (!semCCKey) return data;
    const newCostCenters = data.costCenters.filter((cc) => !isSemCC(cc));
    const newItems = data.items.map((item) => {
      const semVal = item.byCostCenter[semCCKey] ?? 0;
      if (semVal === 0) return item;
      const newByCostCenter = { ...item.byCostCenter };
      delete newByCostCenter[semCCKey];
      if (placaKey) {
        newByCostCenter[placaKey] = (newByCostCenter[placaKey] ?? 0) + semVal;
      }
      return { ...item, byCostCenter: newByCostCenter };
    });
    return { ...data, costCenters: newCostCenters, items: newItems };
  }, [data]);

  if (loading) {
    return (
      <div className="mt-4 flex items-center gap-2 py-6 pl-1 text-xs text-zinc-400 dark:text-zinc-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Carregando locatários…
      </div>
    );
  }

  if (error) {
    return <p className="mt-4 text-xs text-red-500 dark:text-red-400">{error}</p>;
  }

  // Hide silently when there is no tenant data for this company
  if (!displayData || !displayData.hasTenantData) return null;

  return (
    <section className="mt-4">
      {/* Section header */}
      <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </span>
        <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
          Locatários
          <span className="ml-1.5 font-normal text-zinc-400 dark:text-zinc-500">
            — recebido × previsão · {year}
          </span>
        </h2>
        <div className="ml-1 hidden h-px flex-1 bg-zinc-200 dark:bg-zinc-700 sm:block" />
        {/* Legend — moves to its own line on mobile */}
        <div className="flex w-full items-center gap-3 text-[10px] text-zinc-400 sm:w-auto sm:ml-auto">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            Recebido
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            A receber
          </span>
        </div>
      </div>

      {/* Consolidated summary */}
      <div className="mb-4">
        <TenantSummary items={displayData.items} costCenters={displayData.costCenters} />
      </div>

      {/* Per-tenant cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {displayData.items.map((item, idx) => (
          <TenantCard
            key={idx}
            item={item}
            costCenters={displayData.costCenters}
            totalMonths={displayData.totalMonths}
          />
        ))}
      </div>
    </section>
  );
}
