"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/app/components/app-shell";

const OWNER_EMAIL = "owner@dashcontabil.com";

type UserRole = "ADMIN" | "CLIENT";

type AuditAction =
  | "LOGIN"
  | "IMPORT_CREATE"
  | "IMPORT_DELETE"
  | "USER_CREATE"
  | "USER_UPDATE"
  | "COMPANY_CREATE"
  | "COMPANY_UPDATE"
  | "COMPANY_DELETE";

type AuditLog = {
  id: string;
  action: AuditAction;
  entity: string;
  entityId: string | null;
  companyId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
  } | null;
};

type Pagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type MeResponse = {
  user?: { id: string; email: string; role: UserRole };
};

const ACTION_LABELS: Record<AuditAction, string> = {
  LOGIN: "Login",
  IMPORT_CREATE: "Importação",
  IMPORT_DELETE: "Exclusão de Importação",
  USER_CREATE: "Criação de Usuário",
  USER_UPDATE: "Atualização de Usuário",
  COMPANY_CREATE: "Criação de Empresa",
  COMPANY_UPDATE: "Atualização de Empresa",
  COMPANY_DELETE: "Exclusão de Empresa",
};

const ACTION_COLORS: Record<AuditAction, string> = {
  LOGIN: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  IMPORT_CREATE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  IMPORT_DELETE: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  USER_CREATE: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  USER_UPDATE: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  COMPANY_CREATE: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  COMPANY_UPDATE: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  COMPANY_DELETE: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AuditLogPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse["user"]>();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const load = useCallback(
    async (currentPage: number) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ page: String(currentPage), limit: "50" });
        if (filterAction) params.set("action", filterAction);
        if (filterFrom) params.set("from", new Date(filterFrom).toISOString());
        if (filterTo) {
          const to = new Date(filterTo);
          to.setHours(23, 59, 59, 999);
          params.set("to", to.toISOString());
        }

        const res = await fetch(`/api/admin/audit?${params.toString()}`);
        if (!res.ok) {
          router.push("/");
          return;
        }
        const data = (await res.json()) as { logs: AuditLog[]; pagination: Pagination };
        setLogs(data.logs);
        setPagination(data.pagination);
      } finally {
        setIsLoading(false);
      }
    },
    [filterAction, filterFrom, filterTo, router],
  );

  // Verify session and owner access
  useEffect(() => {
    async function checkMe() {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await res.json()) as MeResponse;
      if (!res.ok || !data.user || data.user.role !== "ADMIN" || data.user.email !== OWNER_EMAIL) {
        router.push("/");
        return;
      }
      setMe(data.user);
    }
    void checkMe();
  }, [router]);

  useEffect(() => {
    if (me) void load(page);
  }, [me, page, load]);

  function handleSearch() {
    setPage(1);
    void load(1);
  }

  function handleClearFilters() {
    setFilterAction("");
    setFilterFrom("");
    setFilterTo("");
    setPage(1);
  }

  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[--background]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0f4c81] border-t-transparent" />
      </div>
    );
  }

  return (
    <AppShell role={me.role} email={me.email} onLogout={handleLogout}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">

        {/* Header */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Log de Auditoria</h1>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              Registro de todas as ações críticas realizadas na plataforma
            </p>
          </div>
          {pagination && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {pagination.total.toLocaleString("pt-BR")} evento{pagination.total !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-45 flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Ação
              </label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="">Todas as ações</option>
                {Object.entries(ACTION_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div className="min-w-40 flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                De
              </label>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>

            <div className="min-w-40 flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Até
              </label>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSearch}
                className="rounded-xl bg-[#0f4c81] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0d3d6b]"
              >
                Filtrar
              </button>
              {(filterAction || filterFrom || filterTo) && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0f4c81] border-t-transparent" />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-20 text-center text-sm text-zinc-400">Nenhum evento encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Data/Hora</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Ação</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Usuário</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Entidade</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {logs.map((log) => (
                    <>
                      <tr
                        key={log.id}
                        className="cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ACTION_COLORS[log.action]}`}>
                            {ACTION_LABELS[log.action]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {log.user ? (
                            <div>
                              <p className="font-medium text-zinc-900 dark:text-white">{log.user.name ?? log.user.email}</p>
                              {log.user.name && (
                                <p className="text-xs text-zinc-400">{log.user.email}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                          <p>{log.entity}</p>
                          {log.entityId && (
                            <p className="font-mono text-xs text-zinc-400">{log.entityId}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="text-xs text-[#0f4c81] underline-offset-2 hover:underline dark:text-blue-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedId(expandedId === log.id ? null : log.id);
                            }}
                          >
                            {expandedId === log.id ? "fechar" : "ver"}
                          </button>
                        </td>
                      </tr>
                      {expandedId === log.id && (
                        <tr key={`${log.id}-detail`} className="bg-zinc-50 dark:bg-zinc-800/30">
                          <td colSpan={5} className="px-6 pb-4 pt-2">
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">Metadata</p>
                            <pre className="overflow-x-auto rounded-xl border border-zinc-200 bg-white p-3 font-mono text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                            {log.companyId && (
                              <p className="mt-2 text-xs text-zinc-400">
                                Empresa: <span className="font-mono">{log.companyId}</span>
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Página {pagination.page} de {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page === pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-xl border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
