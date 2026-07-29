"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/app/components/app-shell";
import MultiCompanySelect from "@/app/components/multi-company-select";
import { companyDataCache, consumeStaleCompanyIds } from "@/lib/dashboard/cache";
import {
  RENTABILIDADE_MONTH_LABELS,
  RENTABILIDADE_MONTHS,
  buildRentabilidadeStatement,
  type RentabilidadeMonth,
  type RentabilidadeRow,
} from "@/lib/dashboard/rentabilidade";
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

type DetailState = {
  row: RentabilidadeRow;
  referenceMonth: string;
} | null;

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function valueTone(value: number | null | undefined): string {
  if (value === null || value === undefined) return "text-zinc-400 dark:text-zinc-500";
  if (value < 0) return "text-red-600 dark:text-red-400";
  if (value > 0) return "text-[#0f4c81] dark:text-blue-300";
  return "text-zinc-500 dark:text-zinc-400";
}

function shortValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return formatCurrency(value);
}

function getMonthLabel(referenceMonth: string): string {
  const [year, month] = referenceMonth.split("-");
  const monthLabel = RENTABILIDADE_MONTH_LABELS[(month ?? "01") as RentabilidadeMonth] ?? month;
  return `${monthLabel}/${year?.slice(2) ?? ""}`;
}

function lastDayLabel(year: string, month: string): string {
  const day = new Date(Number(year), Number(month), 0).getDate();
  return `${String(day).padStart(2, "0")}/${month}/${year}`;
}

function SummaryCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number | null | undefined;
  tone: "blue" | "green" | "red" | "amber";
  icon: React.ReactNode;
}) {
  const styles = {
    blue: "border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300",
    green: "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300",
    red: "border-red-100 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300",
    amber: "border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
  };

  return (
    <article className={`rounded-xl border p-4 ${styles[tone]}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="min-w-0 text-[11px] font-bold uppercase text-zinc-500 dark:text-zinc-400">
          {label}
        </p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/70 dark:bg-zinc-900/40">
          {icon}
        </span>
      </div>
      <p className="truncate text-lg font-extrabold tabular-nums">{shortValue(value)}</p>
    </article>
  );
}

function DetailModal({
  detail,
  onClose,
}: {
  detail: DetailState;
  onClose: () => void;
}) {
  if (!detail) return null;

  const monthDetail = detail.row.months[detail.referenceMonth];
  if (!monthDetail) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div>
            <p className="text-xs font-semibold uppercase text-zinc-400 dark:text-zinc-500">
              {getMonthLabel(detail.referenceMonth)}
            </p>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              {detail.row.companyName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <DetailMetric label="Rendimento bruto" value={monthDetail.grossYield} />
          <DetailMetric label="IOF / IRRF" value={monthDetail.taxWithheld} negative />
          <DetailMetric label="Rentabilidade liquida" value={monthDetail.netYield} highlight />
          <DetailMetric label="Saldo bancario" value={monthDetail.closingBalance} />
        </div>
      </div>
    </div>
  );
}

function DetailMetric({
  label,
  value,
  highlight,
  negative,
}: {
  label: string;
  value: number | null;
  highlight?: boolean;
  negative?: boolean;
}) {
  const color = highlight
    ? "text-[#0f4c81] dark:text-blue-300"
    : negative
      ? "text-red-600 dark:text-red-400"
      : "text-zinc-800 dark:text-zinc-100";

  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/60">
      <p className="text-[11px] font-semibold uppercase text-zinc-400 dark:text-zinc-500">
        {label}
      </p>
      <p className={`mt-1 text-base font-bold tabular-nums ${color}`}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="h-24 animate-pulse rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
        />
      ))}
    </div>
  );
}

export default function RentabilidadePage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"ADMIN" | "CLIENT" | null>(null);
  const [allowedCompanies, setAllowedCompanies] = useState<
    Array<{ id: string; name: string; groupId: string }>
  >([]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [companiesData, setCompaniesData] = useState<CompanyData[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [contextMessage, setContextMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState("");
  const [rangeFrom, setRangeFrom] = useState<RentabilidadeMonth>("01");
  const [rangeTo, setRangeTo] = useState<RentabilidadeMonth>("12");
  const [detail, setDetail] = useState<DetailState>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
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
          const initialCompanyId = data.activeCompanyId ?? companies[0]?.id ?? "";

          setUserEmail(data.user.email);
          setUserRole(data.user.role);
          setAllowedCompanies(companies);
          setSelectedCompanyIds(initialCompanyId ? [initialCompanyId] : []);
        }
      } catch {
        router.push("/login");
      }
    }

    void loadSession();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const loadSummaries = useCallback(async (ids: string[], forceRefresh = false) => {
    setErrorMessage(null);
    if (ids.length === 0) {
      setCompaniesData([]);
      return;
    }

    for (const id of consumeStaleCompanyIds()) {
      companyDataCache.delete(id);
    }

    if (forceRefresh) {
      for (const id of ids) companyDataCache.delete(id);
    }

    const missingIds = ids.filter((id) => !companyDataCache.has(id));
    if (missingIds.length > 0) {
      setLoadingSummary(true);
      try {
        const params = new URLSearchParams();
        for (const id of missingIds) params.append("companyId", id);

        const response = await fetch(`/api/dashboard/summary?${params.toString()}`);
        const body = (await response.json()) as { companies?: CompanyData[]; error?: string };

        if (!response.ok || !body.companies) {
          setErrorMessage(body.error ?? "Nao foi possivel carregar os dados.");
          return;
        }

        for (const company of body.companies) {
          companyDataCache.set(company.companyId, {
            ...company,
            summaries: company.summaries.map((summary) => ({
              ...summary,
              referenceMonth: summary.referenceMonth.slice(0, 7),
            })),
          });
        }
      } catch {
        setErrorMessage("Nao foi possivel carregar os dados.");
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
  }, [loadSummaries, selectedCompanyIds]);

  const availableMonths = useMemo(
    () =>
      [
        ...new Set(
          companiesData.flatMap((company) =>
            company.summaries.map((summary) => summary.referenceMonth.slice(0, 7)),
          ),
        ),
      ].sort(),
    [companiesData],
  );

  const years = useMemo(
    () => [...new Set(availableMonths.map((month) => month.slice(0, 4)))].sort(),
    [availableMonths],
  );

  useEffect(() => {
    if (availableMonths.length === 0) {
      setSelectedYear("");
      return;
    }

    if (selectedYear && years.includes(selectedYear)) return;

    const latest = availableMonths[availableMonths.length - 1]!;
    const [year, month] = latest.split("-");
    setSelectedYear(year ?? "");
    setRangeFrom("01");
    setRangeTo((month as RentabilidadeMonth) ?? "12");
  }, [availableMonths, selectedYear, years]);

  const statement = useMemo(
    () =>
      selectedYear
        ? buildRentabilidadeStatement(companiesData, selectedYear, rangeFrom, rangeTo)
        : null,
    [companiesData, rangeFrom, rangeTo, selectedYear],
  );

  const selectedPeriodLabel = useMemo(() => {
    if (!selectedYear) return "-";
    return `${RENTABILIDADE_MONTH_LABELS[rangeFrom]} a ${RENTABILIDADE_MONTH_LABELS[rangeTo]}/${selectedYear}`;
  }, [rangeFrom, rangeTo, selectedYear]);

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
      setContextMessage(ok ? "Empresa padrao atualizada." : "Nao foi possivel salvar empresa padrao.");
      setIsSavingCompany(false);
    }
  }

  function handleYearChange(year: string) {
    setSelectedYear(year);
    const monthsForYear = availableMonths.filter((month) => month.startsWith(year));
    const latest = monthsForYear[monthsForYear.length - 1]?.slice(5, 7) as RentabilidadeMonth | undefined;
    setRangeFrom("01");
    setRangeTo(latest ?? "12");
  }

  function handleRangeFromChange(month: RentabilidadeMonth) {
    setRangeFrom(month);
    if (month > rangeTo) setRangeTo(month);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const isLoading = !userEmail || (selectedCompanyIds.length > 0 && loadingSummary);
  const hasNoData =
    !isLoading &&
    selectedCompanyIds.length > 0 &&
    companiesData.every((company) => company.summaries.length === 0);

  const totalRow = statement?.totalRow;
  const allSelected = allowedCompanies.length > 0 && selectedCompanyIds.length === allowedCompanies.length;

  return (
    <AppShell role={userRole} email={userEmail} onLogout={handleLogout}>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Rentabilidade
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Demonstrativo por empresa, periodo e saldo bancario.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-28 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Ano
              <select
                value={selectedYear}
                onChange={(event) => handleYearChange(event.target.value)}
                disabled={years.length === 0}
                className="mt-1 h-10 w-full rounded-xl border border-[--border] bg-[--surface-2] px-3 text-sm font-semibold text-[--foreground] outline-none focus:ring-2 focus:ring-[#0f4c81]/20 dark:[color-scheme:dark]"
              >
                {years.length === 0 ? <option value="">-</option> : null}
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-28 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              De
              <select
                value={rangeFrom}
                onChange={(event) => handleRangeFromChange(event.target.value as RentabilidadeMonth)}
                disabled={!selectedYear}
                className="mt-1 h-10 w-full rounded-xl border border-[--border] bg-[--surface-2] px-3 text-sm font-semibold text-[--foreground] outline-none focus:ring-2 focus:ring-[#0f4c81]/20 dark:[color-scheme:dark]"
              >
                {RENTABILIDADE_MONTHS.map((month) => (
                  <option key={month} value={month}>
                    {RENTABILIDADE_MONTH_LABELS[month]}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-28 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Ate
              <select
                value={rangeTo}
                onChange={(event) => setRangeTo(event.target.value as RentabilidadeMonth)}
                disabled={!selectedYear}
                className="mt-1 h-10 w-full rounded-xl border border-[--border] bg-[--surface-2] px-3 text-sm font-semibold text-[--foreground] outline-none focus:ring-2 focus:ring-[#0f4c81]/20 dark:[color-scheme:dark]"
              >
                {RENTABILIDADE_MONTHS.filter((month) => month >= rangeFrom).map((month) => (
                  <option key={month} value={month}>
                    {RENTABILIDADE_MONTH_LABELS[month]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <MultiCompanySelect
              companies={allowedCompanies}
              selected={selectedCompanyIds}
              onChange={(ids) => void handleSelectCompanies(ids)}
              disabled={isSavingCompany}
            />
          </div>

          {allowedCompanies.length > 1 && (
            <button
              type="button"
              onClick={() => void handleSelectCompanies(allowedCompanies.map((company) => company.id))}
              disabled={allSelected || isSavingCompany}
              className="h-10 rounded-xl border border-[--border] bg-[--surface] px-3 text-xs font-semibold text-zinc-600 hover:bg-[--surface-2] disabled:opacity-40 dark:text-zinc-300"
            >
              Todas
            </button>
          )}

          <button
            type="button"
            onClick={() => void loadSummaries(selectedCompanyIds, true)}
            disabled={loadingSummary || selectedCompanyIds.length === 0}
            title="Atualizar dados"
            className="flex h-10 items-center gap-1.5 rounded-xl border border-[--border] bg-[--surface] px-3 text-xs font-semibold text-zinc-600 hover:bg-[--surface-2] disabled:opacity-40 dark:text-zinc-300"
          >
            <svg
              className={`h-3.5 w-3.5 ${loadingSummary ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Atualizar
          </button>
        </div>

        {contextMessage && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">{contextMessage}</p>
        )}

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        {isLoading && <LoadingBlock />}

        {!isLoading && selectedCompanyIds.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 py-14 text-center dark:border-zinc-700">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Selecione uma empresa para ver a rentabilidade.
            </p>
          </div>
        )}

        {hasNoData && (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 py-14 text-center dark:border-zinc-700">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Nenhum dado importado para a selecao atual.
            </p>
          </div>
        )}

        {!isLoading && statement && statement.rows.length > 0 && !hasNoData && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label="Rentab. liquida"
                value={totalRow?.accumulatedNetYield}
                tone="green"
                icon={
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                }
              />
              <SummaryCard
                label="Rendimento bruto"
                value={totalRow?.accumulatedGrossYield}
                tone="blue"
                icon={
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 9v1" />
                  </svg>
                }
              />
              <SummaryCard
                label="IOF / IRRF"
                value={totalRow?.accumulatedTaxWithheld}
                tone="red"
                icon={
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m5 5h.01M19 5v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2z" />
                  </svg>
                }
              />
              <SummaryCard
                label="Saldo final"
                value={totalRow?.finalBalance}
                tone="amber"
                icon={
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                }
              />
            </div>

            <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60">
              <div className="flex flex-col gap-1 border-b border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                    Demonstrativo de rentabilidade
                  </h2>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    {selectedPeriodLabel}
                  </p>
                </div>
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  {statement.rows.length} empresa{statement.rows.length === 1 ? "" : "s"}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                      <th className="sticky left-0 z-10 w-52 bg-white px-4 py-3 text-left text-[11px] font-extrabold uppercase text-zinc-500 shadow-[1px_0_0_rgba(212,212,216,0.75)] dark:bg-zinc-900 dark:text-zinc-400 dark:shadow-[1px_0_0_rgba(63,63,70,0.9)]">
                        Empresa
                      </th>
                      <th className="w-36 border-l border-zinc-100 px-3 py-3 text-right text-[11px] font-extrabold uppercase text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                        Saldo 31/12/{Number(selectedYear) - 1}
                      </th>
                      {statement.columns.map((column) => (
                        <th
                          key={column.key}
                          className={`w-32 border-l border-zinc-100 px-3 py-3 text-right text-[11px] font-extrabold uppercase dark:border-zinc-800 ${
                            column.kind === "quarter"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                              : "text-blue-700 dark:text-blue-300"
                          }`}
                        >
                          {column.label}
                        </th>
                      ))}
                      <th className="w-36 border-l border-zinc-100 bg-amber-50 px-3 py-3 text-right text-[11px] font-extrabold uppercase text-amber-700 dark:border-zinc-800 dark:bg-amber-950/30 dark:text-amber-300">
                        Saldo {lastDayLabel(selectedYear, rangeTo)}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.rows.map((row) => (
                      <RentabilidadeTableRow
                        key={row.companyId}
                        row={row}
                        columns={statement.columns}
                        onMonthClick={setDetail}
                      />
                    ))}
                    <RentabilidadeTableRow
                      row={statement.totalRow}
                      columns={statement.columns}
                      onMonthClick={setDetail}
                      total
                    />
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <DetailModal detail={detail} onClose={() => setDetail(null)} />
      </div>
    </AppShell>
  );
}

function RentabilidadeTableRow({
  row,
  columns,
  onMonthClick,
  total = false,
}: {
  row: RentabilidadeRow;
  columns: ReturnType<typeof buildRentabilidadeStatement>["columns"];
  onMonthClick: (detail: DetailState) => void;
  total?: boolean;
}) {
  const rowClass = total
    ? "bg-[#0f4c81] text-white"
    : "border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/40";
  const stickyClass = total
    ? "bg-[#0f4c81] text-white shadow-[1px_0_0_rgba(255,255,255,0.2)]"
    : "bg-white text-zinc-800 shadow-[1px_0_0_rgba(212,212,216,0.75)] dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-[1px_0_0_rgba(63,63,70,0.9)]";

  return (
    <tr className={rowClass}>
      <th className={`sticky left-0 z-10 px-4 py-3 text-left text-sm font-extrabold ${stickyClass}`}>
        {row.companyName}
      </th>
      <MoneyCell value={row.openingBalance} total={total} muted />
      {columns.map((column) => {
        if (column.kind === "quarter") {
          return (
            <MoneyCell
              key={column.key}
              value={row.quarters[column.key] ?? null}
              total={total}
              emphasis
            />
          );
        }

        const monthDetail = row.months[column.key];
        return (
          <td
            key={column.key}
            className={`border-l border-zinc-100 px-3 py-2 text-right tabular-nums dark:border-zinc-800 ${
              total ? "border-white/10 text-blue-50" : ""
            }`}
          >
            {monthDetail?.hasData ? (
              <button
                type="button"
                onClick={() => onMonthClick({ row, referenceMonth: column.key })}
                className={`w-full rounded-lg px-2 py-1 text-right text-sm font-semibold transition hover:bg-[#0f4c81]/8 dark:hover:bg-blue-900/20 ${
                  total ? "text-white hover:bg-white/10" : valueTone(monthDetail.netYield)
                }`}
                aria-label={`Detalhar ${row.companyName} ${column.label}`}
              >
                {formatCurrency(monthDetail.netYield)}
              </button>
            ) : (
              <span className={total ? "text-blue-100/60" : "text-zinc-400 dark:text-zinc-500"}>
                -
              </span>
            )}
          </td>
        );
      })}
      <MoneyCell value={row.finalBalance} total={total} muted />
    </tr>
  );
}

function MoneyCell({
  value,
  total,
  muted,
  emphasis,
}: {
  value: number | null;
  total?: boolean;
  muted?: boolean;
  emphasis?: boolean;
}) {
  const color = total
    ? "text-white"
    : emphasis
      ? "text-emerald-700 dark:text-emerald-300"
      : muted
        ? "text-zinc-700 dark:text-zinc-200"
        : valueTone(value);

  return (
    <td
      className={`border-l border-zinc-100 px-3 py-3 text-right text-sm font-semibold tabular-nums dark:border-zinc-800 ${
        total ? "border-white/10" : ""
      } ${color}`}
    >
      {formatCurrency(value)}
    </td>
  );
}
