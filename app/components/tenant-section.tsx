"use client";

import { useEffect, useMemo, useState } from "react";

type TenantPaymentStatus = "PAID" | "OPEN" | "PARTIAL";

type TenantPaymentMonthStatus = {
  tenantKey: string;
  tenantName: string;
  referenceMonth: string;
  costCenter: string | null;
  provisioned: number;
  paid: number;
  openBalance: number;
  status: TenantPaymentStatus;
};

type TenantPaymentSummary = {
  provisioned: number;
  paid: number;
  openBalance: number;
  status: TenantPaymentStatus;
  monthly: TenantPaymentMonthStatus[];
};

type TenantItem = {
  key: string;
  description: string;
  byCostCenter: Record<string, number>;
  totalCredit: number;
  annualForecast: number;
  balance: number;
  payment?: TenantPaymentSummary;
};

type TenantSummaryResponse = {
  hasTenantData: boolean;
  hasTenantPaymentData?: boolean;
  year: string;
  companyId: string;
  totalMonths: number;
  costCenters: string[];
  paymentCostCenters?: string[];
  paymentCompetencies?: string[];
  items: TenantItem[];
};

type ApiErrorResponse = {
  error?: string;
};

type TenantFilters = {
  tenant: string;
  costCenter: string;
  competency: string;
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCurrencyShort(value: number) {
  if (Math.abs(value) >= 1_000_000) return `R$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `R$${(value / 1_000).toFixed(1)}k`;
  return `R$${value.toFixed(0)}`;
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function monthLabel(referenceMonth: string) {
  const [year, month] = referenceMonth.split("-");
  if (!year || !month) return referenceMonth;
  return `${month}/${year}`;
}

function statusLabel(status: TenantPaymentStatus) {
  if (status === "PAID") return "Pago";
  if (status === "PARTIAL") return "Parcialmente pago";
  return "Em aberto";
}

function statusClasses(status: TenantPaymentStatus) {
  if (status === "PAID") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  }
  if (status === "PARTIAL") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  }
  return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
}

function paymentStatusFromTotals(provisioned: number, paid: number): TenantPaymentStatus {
  if (paid >= provisioned - 0.005) return "PAID";
  if (paid <= 0.005) return "OPEN";
  return "PARTIAL";
}

function summarizePayment(monthly: TenantPaymentMonthStatus[]): TenantPaymentSummary {
  const provisioned = roundMoney(monthly.reduce((sum, item) => sum + item.provisioned, 0));
  const paid = roundMoney(monthly.reduce((sum, item) => sum + item.paid, 0));
  const openBalance = roundMoney(monthly.reduce((sum, item) => sum + item.openBalance, 0));

  return {
    provisioned,
    paid,
    openBalance,
    status: paymentStatusFromTotals(provisioned, paid),
    monthly,
  };
}

const OTHER_CC_COLORS = [
  {
    dot: "bg-violet-500",
    text: "text-violet-600 dark:text-violet-400",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  },
  {
    dot: "bg-cyan-500",
    text: "text-cyan-600 dark:text-cyan-400",
    badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  },
  {
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
];

function ccStyle(cc: string, idx: number) {
  const n = cc.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (n.includes("condomin")) {
    return {
      dot: "bg-violet-500",
      text: "text-violet-600 dark:text-violet-400",
      badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    };
  }
  if (n.includes("placa") || (n.includes("adm") && !n.includes("admin"))) {
    return {
      dot: "bg-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
      badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    };
  }
  return OTHER_CC_COLORS[idx % OTHER_CC_COLORS.length]!;
}

function applyFilters(item: TenantItem, filters: TenantFilters): TenantItem | null {
  if (filters.tenant !== "all" && item.description !== filters.tenant) return null;

  if (!item.payment) {
    if (filters.competency !== "all") return null;
    if (filters.costCenter !== "all" && !item.byCostCenter[filters.costCenter]) return null;
    return item;
  }

  const monthly = item.payment.monthly.filter((month) => {
    const costCenterMatches =
      filters.costCenter === "all" || (month.costCenter ?? "__null__") === filters.costCenter;
    const competencyMatches = filters.competency === "all" || month.referenceMonth === filters.competency;
    return costCenterMatches && competencyMatches;
  });

  if (monthly.length === 0) return null;

  const payment = summarizePayment(monthly);
  return {
    ...item,
    totalCredit: payment.paid,
    annualForecast: payment.provisioned,
    balance: payment.openBalance,
    payment,
  };
}

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
  const hasPayment = Boolean(item.payment);
  const received = item.payment?.paid ?? item.totalCredit;
  const expected = item.payment?.provisioned ?? item.annualForecast;
  const balance = item.payment?.openBalance ?? Math.max(0, expected - received);
  const receivedPct = expected > 0 ? Math.min((received / expected) * 100, 100) : 100;
  const remainingPct = 100 - receivedPct;
  const status = item.payment?.status ?? (received >= expected ? "PAID" : "PARTIAL");

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-shadow hover:shadow-md dark:border-zinc-700/50 dark:bg-zinc-900/50">
      <button
        type="button"
        className="w-full px-4 pb-3 pt-4 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="mb-2.5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight text-zinc-800 dark:text-zinc-100">
              {item.description}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Locatario
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold tabular-nums text-blue-600 dark:text-blue-400">
              {formatCurrencyShort(received)}
            </p>
            <p className="text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
              / {formatCurrencyShort(expected)}
              {!hasPayment ? "/ano" : ""}
            </p>
          </div>
        </div>

        <div
          className="relative h-5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
          title={`Pago: ${formatCurrency(received)} - Provisionado: ${formatCurrency(expected)}`}
        >
          {receivedPct > 0 && (
            <div
              className="absolute left-0 top-0 flex h-full items-center justify-center bg-blue-500 transition-all"
              style={{ width: `${receivedPct}%` }}
            >
              {receivedPct >= 16 && (
                <span className="select-none text-[9px] font-bold text-white">
                  {receivedPct.toFixed(0)}%
                </span>
              )}
            </div>
          )}
          {remainingPct > 0 && status !== "PAID" && (
            <div
              className="absolute top-0 flex h-full items-center justify-center bg-red-400/80 transition-all dark:bg-red-500/70"
              style={{ left: `${receivedPct}%`, width: `${remainingPct}%` }}
            >
              {remainingPct >= 16 && (
                <span className="select-none text-[9px] font-bold text-white">
                  {remainingPct.toFixed(0)}%
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
          <span className="flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Pago: {formatCurrency(received)}
          </span>
          {hasPayment && (
            <span className={`rounded-full px-2 py-0.5 font-semibold ${statusClasses(status)}`}>
              {statusLabel(status)}
            </span>
          )}
          {balance > 0 ? (
            <span className="flex items-center gap-1 font-medium text-red-500 dark:text-red-400">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              Em aberto: {formatCurrency(balance)}
            </span>
          ) : (
            <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Quitado
            </span>
          )}
          <span className="ml-auto text-zinc-400 dark:text-zinc-500">
            {open ? "ocultar" : "detalhar"}
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-zinc-100 bg-zinc-50/50 px-4 py-3 dark:border-zinc-700/50 dark:bg-zinc-800/30">
          {item.payment && (
            <>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Status mensal
              </p>
              <div className="space-y-2">
                {item.payment.monthly.map((month) => (
                  <div
                    key={`${month.referenceMonth}-${month.costCenter ?? "sem-cc"}`}
                    className="border-b border-zinc-200 pb-2 last:border-b-0 last:pb-0 dark:border-zinc-700/60"
                  >
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200">
                        {monthLabel(month.referenceMonth)}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClasses(month.status)}`}>
                        {statusLabel(month.status)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div>
                        <p className="uppercase text-zinc-400 dark:text-zinc-500">Provisionado</p>
                        <p className="font-bold tabular-nums text-zinc-700 dark:text-zinc-200">
                          {formatCurrency(month.provisioned)}
                        </p>
                      </div>
                      <div>
                        <p className="uppercase text-zinc-400 dark:text-zinc-500">Pago</p>
                        <p className="font-bold tabular-nums text-blue-600 dark:text-blue-400">
                          {formatCurrency(month.paid)}
                        </p>
                      </div>
                      <div>
                        <p className="uppercase text-zinc-400 dark:text-zinc-500">Aberto</p>
                        <p className="font-bold tabular-nums text-red-500 dark:text-red-400">
                          {formatCurrency(month.openBalance)}
                        </p>
                      </div>
                    </div>
                    {month.costCenter && (
                      <p className="mt-1 truncate text-[10px] text-zinc-400 dark:text-zinc-500">
                        {month.costCenter}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {costCenters.some((cc) => (item.byCostCenter[cc] ?? 0) > 0) && (
            <div className={item.payment ? "mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700/60" : ""}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Composicao do recebido
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
                      <span className="flex-1 truncate text-xs text-zinc-600 dark:text-zinc-300">{cc}</span>
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
            </div>
          )}

          {!item.payment && totalMonths < 12 && (
            <p className="mt-2 text-[10px] text-zinc-400 dark:text-zinc-500">
              Previsao anual extrapolada: media de {totalMonths} mes{totalMonths !== 1 ? "es" : ""} x 12.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TenantSummary({
  items,
  costCenters,
}: {
  items: TenantItem[];
  costCenters: string[];
}) {
  const hasPayment = items.some((item) => item.payment);
  const totalReceived = items.reduce((sum, item) => sum + (item.payment?.paid ?? item.totalCredit), 0);
  const totalExpected = items.reduce((sum, item) => sum + (item.payment?.provisioned ?? item.annualForecast), 0);
  const totalBalance = roundMoney(items.reduce((sum, item) => sum + (item.payment?.openBalance ?? Math.max(0, item.annualForecast - item.totalCredit)), 0));
  const receivedPct = totalExpected > 0 ? Math.min((totalReceived / totalExpected) * 100, 100) : 100;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-700/50 dark:bg-zinc-800/30">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        Consolidado - todos os locatarios
      </p>

      <div className="mb-3 flex flex-col gap-1.5 sm:grid sm:grid-cols-3 sm:gap-3">
        <div className="flex items-baseline justify-between gap-2 sm:block">
          <p className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Pago</p>
          <p className="text-sm font-bold tabular-nums text-blue-600 dark:text-blue-400">
            {formatCurrency(totalReceived)}
          </p>
        </div>
        <div className="flex items-baseline justify-between gap-2 sm:block">
          <p className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Em aberto</p>
          <p className="text-sm font-bold tabular-nums text-red-500 dark:text-red-400">
            {formatCurrency(totalBalance)}
          </p>
        </div>
        <div className="flex items-baseline justify-between gap-2 sm:block">
          <p className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            {hasPayment ? "Provisionado" : "Previsao/ano"}
          </p>
          <p className="text-sm font-bold tabular-nums text-zinc-700 dark:text-zinc-200">
            {formatCurrency(totalExpected)}
          </p>
        </div>
      </div>

      <div className="relative h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className="absolute left-0 top-0 h-full bg-blue-500 transition-all"
          style={{ width: `${receivedPct}%` }}
        />
      </div>
      <p className="mt-1 text-right text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
        {receivedPct.toFixed(1)}% pago
      </p>

      {costCenters.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {costCenters.map((cc, idx) => {
            const total = items.reduce((sum, item) => sum + (item.byCostCenter[cc] ?? 0), 0);
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

function TenantFilters({
  filters,
  onChange,
  tenants,
  costCenters,
  competencies,
}: {
  filters: TenantFilters;
  onChange: (filters: TenantFilters) => void;
  tenants: string[];
  costCenters: string[];
  competencies: string[];
}) {
  const selectClass =
    "h-8 rounded-lg border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-600 outline-none transition focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <select
        className={selectClass}
        value={filters.tenant}
        aria-label="Locatario"
        onChange={(event) => onChange({ ...filters, tenant: event.target.value })}
      >
        <option value="all">Todos os locatarios</option>
        {tenants.map((tenant) => (
          <option key={tenant} value={tenant}>
            {tenant}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        value={filters.costCenter}
        aria-label="Centro de custo"
        onChange={(event) => onChange({ ...filters, costCenter: event.target.value })}
      >
        <option value="all">Todos os centros</option>
        {costCenters.map((costCenter) => (
          <option key={costCenter} value={costCenter}>
            {costCenter}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        value={filters.competency}
        aria-label="Competencia"
        onChange={(event) => onChange({ ...filters, competency: event.target.value })}
      >
        <option value="all">Todas as competencias</option>
        {competencies.map((competency) => (
          <option key={competency} value={competency}>
            {monthLabel(competency)}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function TenantSection({
  companyId,
  year,
}: {
  companyId: string;
  year: string;
}) {
  const [data, setData] = useState<TenantSummaryResponse | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [filters, setFilters] = useState<TenantFilters>({
    tenant: "all",
    costCenter: "all",
    competency: "all",
  });
  const requestKey = `${companyId}|${year}`;

  useEffect(() => {
    if (!companyId || !year) {
      return;
    }

    let cancelled = false;

    fetch(`/api/dashboard/tenants?companyId=${encodeURIComponent(companyId)}&year=${encodeURIComponent(year)}`)
      .then(async (response) => {
        const json = (await response.json().catch(() => null)) as TenantSummaryResponse | ApiErrorResponse | null;

        if (!response.ok) {
          const message =
            json && "error" in json && json.error
              ? json.error
              : "Erro ao carregar dados de locatarios.";
          throw new Error(message);
        }

        if (!json || !("items" in json) || !Array.isArray(json.items)) {
          throw new Error("Resposta invalida ao carregar locatarios.");
        }

        return json;
      })
      .then((json: TenantSummaryResponse) => {
        if (!cancelled) {
          setData(json);
          setError(null);
          setFilters({ tenant: "all", costCenter: "all", competency: "all" });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setData(null);
          setError({
            key: requestKey,
            message: err instanceof Error ? err.message : "Erro ao carregar dados de locatarios.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, requestKey, year]);

  const dataItems = useMemo(() => (Array.isArray(data?.items) ? data.items : []), [data]);
  const tenants = useMemo(() => dataItems.map((item) => item.description), [dataItems]);
  const costCenters = useMemo(() => {
    const merged = new Set([...(data?.costCenters ?? []), ...(data?.paymentCostCenters ?? [])]);
    return [...merged].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [data]);
  const competencies = data?.paymentCompetencies ?? [];
  const filteredItems = useMemo(() => {
    if (!data) return [];
    return dataItems
      .map((item) => applyFilters(item, filters))
      .filter((item): item is TenantItem => Boolean(item));
  }, [data, dataItems, filters]);
  const dataMatchesRequest = data?.companyId === companyId && data.year === year;
  const activeError = error?.key === requestKey ? error.message : null;
  const loading = Boolean(companyId && year && !dataMatchesRequest && !activeError);

  if (loading) {
    return (
      <div className="mt-4 flex items-center gap-2 py-6 pl-1 text-xs text-zinc-400 dark:text-zinc-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Carregando locatarios...
      </div>
    );
  }

  if (activeError) {
    return <p className="mt-4 text-xs text-red-500 dark:text-red-400">{activeError}</p>;
  }

  if (!data || !dataMatchesRequest || !data.hasTenantData) return null;

  return (
    <section className="mt-4">
      <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 0 0-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
          </svg>
        </span>
        <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
          Locatarios
          <span className="ml-1.5 font-normal text-zinc-400 dark:text-zinc-500">
            - pago x provisionado - {year}
          </span>
        </h2>
        <div className="ml-1 hidden h-px flex-1 bg-zinc-200 dark:bg-zinc-700 sm:block" />
        <div className="flex w-full items-center gap-3 text-[10px] text-zinc-400 sm:ml-auto sm:w-auto">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            Pago
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            Em aberto
          </span>
        </div>
      </div>

      {data.hasTenantPaymentData && (
        <TenantFilters
          filters={filters}
          onChange={setFilters}
          tenants={tenants}
          costCenters={costCenters}
          competencies={competencies}
        />
      )}

      {filteredItems.length === 0 ? (
        <p className="py-5 text-xs text-zinc-400 dark:text-zinc-500">Nenhum locatario encontrado.</p>
      ) : (
        <>
          <div className="mb-4">
            <TenantSummary items={filteredItems} costCenters={costCenters} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => (
              <TenantCard
                key={item.key}
                item={item}
                costCenters={costCenters}
                totalMonths={data.totalMonths}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
