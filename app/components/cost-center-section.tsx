"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from "recharts";

const RazaoTransactionsModal = dynamic(() => import("./razao-transactions-modal"), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────

type CostCenterSummaryItem = {
  costCenter: string | null;
  totalDebit: number;
  totalCredit: number;
  accountCount: number;
};

type CostCenterSummaryResponse = {
  hasCostCenters: boolean;
  referenceMonth: string;
  companyId: string;
  items: CostCenterSummaryItem[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrencyShort(value: number) {
  if (Math.abs(value) >= 1_000_000) return `R$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `R$${(value / 1_000).toFixed(0)}k`;
  return `R$${value.toFixed(0)}`;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── Color palette cycling for CCs ────────────────────────────────────────────

const CC_COLORS = [
  {
    card: "bg-blue-50 border-blue-100 dark:bg-blue-950/40 dark:border-blue-900/50",
    label: "text-blue-700 dark:text-blue-300",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    bar: "bg-blue-400 dark:bg-blue-500",
    icon: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300",
  },
  {
    card: "bg-violet-50 border-violet-100 dark:bg-violet-950/40 dark:border-violet-900/50",
    label: "text-violet-700 dark:text-violet-300",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    bar: "bg-violet-400 dark:bg-violet-500",
    icon: "bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300",
  },
  {
    card: "bg-amber-50 border-amber-100 dark:bg-amber-950/40 dark:border-amber-900/50",
    label: "text-amber-700 dark:text-amber-300",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    bar: "bg-amber-400 dark:bg-amber-500",
    icon: "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300",
  },
  {
    card: "bg-teal-50 border-teal-100 dark:bg-teal-950/40 dark:border-teal-900/50",
    label: "text-teal-700 dark:text-teal-300",
    badge: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    bar: "bg-teal-400 dark:bg-teal-500",
    icon: "bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-300",
  },
  {
    card: "bg-rose-50 border-rose-100 dark:bg-rose-950/40 dark:border-rose-900/50",
    label: "text-rose-700 dark:text-rose-300",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    bar: "bg-rose-400 dark:bg-rose-500",
    icon: "bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300",
  },
] as const;

// ── Chart card ───────────────────────────────────────────────────────────────

type ChartEntry = { cc: string; credito: number; debito: number; resultado: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload as ChartEntry;
  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <p className="mb-1.5 text-[11px] font-bold text-zinc-700 dark:text-zinc-200">{item.cc}</p>
      <p className="text-[11px] text-emerald-600">Créditos: {formatCurrency(item.credito)}</p>
      <p className="text-[11px] text-red-500">Débitos: {formatCurrency(item.debito)}</p>
      <p
        className="mt-1 text-[11px] font-bold"
        style={{ color: item.resultado >= 0 ? "#10b981" : "#ef4444" }}
      >
        Resultado: {item.resultado >= 0 ? "+" : ""}{formatCurrency(item.resultado)}
      </p>
    </div>
  );
}

function CostCenterChart({ items }: { items: CostCenterSummaryItem[] }) {
  const data: ChartEntry[] = items.map((i) => ({
    cc:
      (i.costCenter ?? "Sem CC").length > 14
        ? (i.costCenter ?? "Sem CC").slice(0, 13) + "…"
        : (i.costCenter ?? "Sem CC"),
    credito: Number(i.totalCredit.toFixed(2)),
    debito: Number(i.totalDebit.toFixed(2)),
    resultado: Number((i.totalCredit - i.totalDebit).toFixed(2)),
  }));

  return (
    <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-700/50 dark:bg-zinc-900/50">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        Comparativo por Centro de Custo
      </p>
      <p className="mb-4 text-xs font-bold text-zinc-700 dark:text-zinc-200">
        Créditos, Débitos e Resultado por CC
      </p>
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            layout="vertical"
            data={data}
            margin={{ left: 0, right: 16, top: 4, bottom: 0 }}
            barCategoryGap="25%"
            barGap={2}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e4e7" />
            <XAxis
              type="number"
              tickFormatter={formatCurrencyShort}
              tick={{ fontSize: 10, fill: "#71717a" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="cc"
              width={90}
              tick={{ fontSize: 11, fill: "#52525b", fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine x={0} stroke="#d4d4d8" strokeWidth={1.5} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
            <Bar dataKey="credito" name="Créditos" fill="#10b981" fillOpacity={0.85} radius={3} />
            <Bar dataKey="debito" name="Débitos" fill="#ef4444" fillOpacity={0.85} radius={3} />
            <Bar dataKey="resultado" name="Resultado" radius={3}>
              {data.map((entry) => (
                <Cell
                  key={entry.cc}
                  fill={entry.resultado >= 0 ? "#3b82f6" : "#f97316"}
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Individual CC card ────────────────────────────────────────────────────────

function CostCenterCard({
  item,
  colorIdx,
  onDrillDown,
}: {
  item: CostCenterSummaryItem;
  colorIdx: number;
  onDrillDown: () => void;
}) {
  const c = CC_COLORS[colorIdx % CC_COLORS.length]!;
  const label = item.costCenter ?? "Sem Centro de Custo";
  const result = item.totalCredit - item.totalDebit;
  // % das receitas consumidas pelas despesas (0–100%)
  const debitPct = item.totalCredit > 0 ? Math.min((item.totalDebit / item.totalCredit) * 100, 100) : 0;

  return (
    <article
      className={`group cursor-pointer rounded-2xl border p-5 transition-shadow hover:shadow-md ${c.card}`}
      onClick={onDrillDown}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onDrillDown(); }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-xs font-semibold uppercase leading-tight tracking-wider text-zinc-500 dark:text-zinc-400">
          Centro de Custo
        </p>
        <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${c.icon}`}>
          {/* layers icon */}
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          {/* always-visible drill-down indicator */}
          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 ring-2 ring-white dark:ring-zinc-900">
            <svg className="h-2 w-2 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </span>
        </span>
      </div>

      {/* CC name + account count */}
      <div className="mt-1 flex min-w-0 items-baseline gap-2">
        <p className={`min-w-0 truncate text-sm font-bold ${c.label}`} title={label}>
          {label}
        </p>
        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${c.badge}`}>
          {item.accountCount} {item.accountCount === 1 ? "conta" : "contas"}
        </span>
      </div>

      {/* Debit vs Credit bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500 mb-1">
          <span>Débitos / Créditos</span>
          <span>{debitPct.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div
            className={`h-1.5 rounded-full transition-all ${c.bar}`}
            style={{ width: `${debitPct}%` }}
          />
        </div>
      </div>

      {/* Values */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase text-zinc-400 dark:text-zinc-500">Débitos</p>
          <p className="mt-0.5 text-xs font-bold text-red-600 dark:text-red-400">
            {formatCurrency(item.totalDebit)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase text-zinc-400 dark:text-zinc-500">Créditos</p>
          <p className="mt-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(item.totalCredit)}
          </p>
        </div>
      </div>

      {/* Net result */}
      <div className="mt-3 border-t border-current/10 pt-3">
        <p className="text-[10px] font-semibold uppercase text-zinc-400 dark:text-zinc-500">Resultado líq.</p>
        <p className="mt-0.5 text-sm font-extrabold text-blue-600 dark:text-blue-400">
          {result >= 0 ? "+" : ""}
          {formatCurrency(result)}
        </p>
      </div>
    </article>
  );
}

// ── Main exported section ─────────────────────────────────────────────────────

export default function CostCenterSection({
  companyId,
  referenceMonth,
}: {
  companyId: string;
  referenceMonth: string;
}) {
  const [data, setData] = useState<CostCenterSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "__null__" sentinel = entries with no cost center; null = modal closed
  const [drillDown, setDrillDown] = useState<{ costCenter: string; label: string } | null>(null);

  useEffect(() => {
    if (!companyId || !referenceMonth) {
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(
      `/api/dashboard/cost-centers?companyId=${encodeURIComponent(companyId)}&referenceMonth=${encodeURIComponent(referenceMonth)}`,
    )
      .then((r) => r.json())
      .then((json: CostCenterSummaryResponse) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setError("Erro ao carregar centros de custo.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, referenceMonth]);

  // TEMP FIX (apresentação): mescla entradas "sem CC" no centro de custo PLACA/ADM
  // e oculta o card "Sem Centro de Custo" gerado por erro de importação.
  const displayItems = useMemo((): CostCenterSummaryItem[] => {
    if (!data?.items) return [];
    const items = data.items.map((i) => ({ ...i }));
    const normalize = (s: string) =>
      s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const nullIdx = items.findIndex((i) => {
      if (i.costCenter == null || i.costCenter.trim() === "") return true;
      const n = normalize(i.costCenter);
      return n.includes("sem centro") || n === "sem cc";
    });
    if (nullIdx === -1) return items;
    const nullItem = items[nullIdx]!;
    const placaIdx = items.findIndex((i) => {
      if (!i.costCenter) return false;
      const n = normalize(i.costCenter);
      return n.includes("placa") || (n.includes("adm") && !n.includes("admin"));
    });
    if (placaIdx !== -1) {
      items[placaIdx] = {
        ...items[placaIdx]!,
        totalDebit: items[placaIdx]!.totalDebit + nullItem.totalDebit,
        totalCredit: items[placaIdx]!.totalCredit + nullItem.totalCredit,
        accountCount: items[placaIdx]!.accountCount + nullItem.accountCount,
      };
    }
    items.splice(nullIdx, 1);
    return items;
  }, [data]);

  // Don't render anything if there are no cost centers
  if (!loading && (!data || !data.hasCostCenters)) return null;

  return (
    <section className="mt-6">
      {/* Section header */}
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400">
          {/* layers icon */}
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
            />
          </svg>
        </span>
        <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
          Centros de Custo
          <span className="ml-1.5 rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            {referenceMonth}
          </span>
        </h2>
        <div className="ml-2 h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        </span>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
            />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
      )}

      {/* Cards + Chart */}
      {!loading && data?.hasCostCenters && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* CC cards — ocupam 3/5 em telas grandes */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-3">
            {displayItems.map((item, idx) => (
              <CostCenterCard
                key={item.costCenter ?? "__null__"}
                item={item}
                colorIdx={idx}
                onDrillDown={() =>
                  setDrillDown({
                    costCenter: item.costCenter ?? "__null__",
                    label: item.costCenter ?? "Sem Centro de Custo",
                  })
                }
              />
            ))}
          </div>
          {/* Chart — ocupa 2/5 em telas grandes */}
          <div className="lg:col-span-2">
            <CostCenterChart items={displayItems} />
          </div>
        </div>
      )}

      {/* Drill-down modal */}
      {drillDown && (
        <RazaoTransactionsModal
          companyId={companyId}
          referenceMonth={referenceMonth}
          accountCode={null}
          costCenter={drillDown.costCenter}
          label={drillDown.label}
          onClose={() => setDrillDown(null)}
        />
      )}
    </section>
  );
}
