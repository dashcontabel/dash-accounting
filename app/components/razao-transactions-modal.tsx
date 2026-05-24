"use client";

import { useEffect, useRef, useState } from "react";

type RazaoEntry = {
  id: string;
  entryDate: string;
  accountCode: string;
  accountName: string;
  lot: string | null;
  counterpartCode: string | null;
  counterpartName: string | null;
  description: string | null;
  debit: number;
  credit: number;
  balance: number;
};

type ApiResponse = {
  entries: RazaoEntry[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  error?: string;
};

const MONTH_LABELS: Record<string, string> = {
  "01": "Janeiro",  "02": "Fevereiro", "03": "Março",    "04": "Abril",
  "05": "Maio",     "06": "Junho",     "07": "Julho",    "08": "Agosto",
  "09": "Setembro", "10": "Outubro",   "11": "Novembro", "12": "Dezembro",
};

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${MONTH_LABELS[m ?? ""] ?? m}/${y}`;
}

function formatDate(isoOrDate: string) {
  const raw = String(isoOrDate).slice(0, 10); // "YYYY-MM-DD"
  const [y, m, day] = raw.split("-");
  return `${day}/${m}/${y}`;
}

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function RazaoTransactionsModal({
  companyId,
  referenceMonth,
  accountCode,
  costCenter,
  label,
  onClose,
}: {
  companyId: string;
  referenceMonth: string;
  accountCode: string | null;
  /** When set, filters entries to this cost center. Use "__null__" for entries with no CC. */
  costCenter?: string | null;
  label: string;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<RazaoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, page: 1 });
  const overlayRef = useRef<HTMLDivElement>(null);

  // Fetch whenever page or filter changes
  useEffect(() => {
    const params = new URLSearchParams({ companyId, referenceMonth, page: String(page) });
    if (accountCode) params.set("accountCode", accountCode);
    if (costCenter !== undefined && costCenter !== null) params.set("costCenter", costCenter);

    setLoading(true);
    fetch(`/api/dashboard/transactions?${params.toString()}`)
      .then((r) => r.json() as Promise<ApiResponse>)
      .then((data) => {
        setEntries(data.entries ?? []);
        if (data.pagination) setPagination(data.pagination);
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [companyId, referenceMonth, accountCode, costCenter, page]);

  // Close on backdrop click
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-6"
    >
      <div className="flex w-full max-w-[98vw] flex-col rounded-t-2xl bg-white shadow-2xl dark:bg-zinc-900 sm:rounded-2xl 2xl:max-w-[1600px]"
        style={{ maxHeight: "90vh" }}
      >
        {/* ── Header ── */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Lançamentos do Razão Contábil
            </p>
            <h2 className="mt-0.5 truncate text-sm font-bold text-zinc-800 dark:text-zinc-100">
              {label}
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                {monthLabel(referenceMonth)}
                {!loading && pagination.total > 0 && (
                  <>
                    {" · "}
                    <span className="font-medium text-zinc-500 dark:text-zinc-400">
                      {pagination.total} lançamento{pagination.total !== 1 ? "s" : ""}
                    </span>
                  </>
                )}
              </p>
              {costCenter !== undefined && costCenter !== null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                  <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                  {costCenter === "__null__" ? "Sem Centro de Custo" : costCenter}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Fechar"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0f4c81] border-t-transparent dark:border-blue-400" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <svg className="h-12 w-12 text-zinc-200 dark:text-zinc-700" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
                Sem lançamentos detalhados para este período.
              </p>
              <p className="max-w-xs text-xs text-zinc-300 dark:text-zinc-600">
                Importe um arquivo de Razão Contábil para visualizar os lançamentos individuais.
              </p>
            </div>
          ) : (
            <div>
              <table className="w-full border-collapse text-xs" style={{ minWidth: "860px" }}>
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-800/50">
                    <th className="px-4 py-2.5 text-left font-semibold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Data</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-zinc-500 dark:text-zinc-400">Lote</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Conta</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Contrapartida</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-zinc-500 dark:text-zinc-400">Histórico</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Débito</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Crédito</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-zinc-50 transition-colors hover:bg-zinc-50/60 dark:border-zinc-800/60 dark:hover:bg-zinc-800/30"
                    >
                      <td className="px-4 py-2.5 tabular-nums text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                        {formatDate(e.entryDate)}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-400 dark:text-zinc-500">
                        {e.lot ?? <span className="text-zinc-200 dark:text-zinc-700">—</span>}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">{e.accountCode}</span>
                        <span className="ml-1.5 text-zinc-600 dark:text-zinc-300">{e.accountName}</span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {e.counterpartCode && (
                          <span className="mr-1 font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                            {e.counterpartCode}
                          </span>
                        )}
                        <span className="text-zinc-600 dark:text-zinc-300">
                          {e.counterpartName ?? <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                        </span>
                      </td>
                      <td
                        className="max-w-xs truncate px-4 py-2.5 text-zinc-500 dark:text-zinc-400"
                        title={e.description ?? ""}
                      >
                        {e.description ?? <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                      </td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${e.debit > 0 ? "text-red-600 dark:text-red-400" : "text-zinc-200 dark:text-zinc-700"}`}>
                        {e.debit > 0 ? fmtBrl(e.debit) : "—"}
                      </td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${e.credit > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-200 dark:text-zinc-700"}`}>
                        {e.credit > 0 ? fmtBrl(e.credit) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-zinc-700 dark:text-zinc-200">
                        {fmtBrl(e.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Footer / Pagination ── */}
        {!loading && pagination.totalPages > 1 && (
          <div className="flex shrink-0 items-center justify-between gap-4 border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              Página {pagination.page} de {pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                ← Anterior
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Próxima →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
