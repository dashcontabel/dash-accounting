"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/app/components/app-shell";

type MeResponse = {
  user?: { id: string; email: string; role: "ADMIN" | "CLIENT" };
};

type MappingRow = {
  id: string;
  dashboardField: string;
  matchType: string;
  codes: string[];
  valueColumn: string;
  aggregation: string;
  isCalculated: boolean;
  formula: string | null;
};

const VALUE_COLUMN_LABELS: Record<string, string> = {
  saldo_atual: "Saldo Atual",
  saldo_anterior: "Saldo Anterior",
  debito: "Débito",
  credito: "Crédito",
};

export default function AdminMappingsPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse["user"]>();
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const [meRes, mappingsRes] = await Promise.all([
      fetch("/api/auth/me", { cache: "no-store" }),
      fetch("/api/admin/mappings", { cache: "no-store" }),
    ]);

    const meData = (await meRes.json()) as MeResponse;
    if (!meRes.ok || meData.user?.role !== "ADMIN") {
      router.push("/");
      return;
    }
    setMe(meData.user);

    if (mappingsRes.ok) {
      const data = (await mappingsRes.json()) as { mappings: MappingRow[] };
      setMappings(data.mappings ?? []);
    }
    setIsLoading(false);
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function handleSeed() {
    setSeeding(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/mappings/seed", { method: "POST" });
      const data = (await res.json()) as { message?: string; count?: number; error?: string };
      if (res.ok) {
        setMessage({ text: `${data.message ?? "OK"} (${data.count ?? 0} regras criadas)`, ok: true });
        await load();
      } else {
        setMessage({ text: data.error ?? "Erro ao inicializar.", ok: false });
      }
    } catch {
      setMessage({ text: "Erro de rede.", ok: false });
    } finally {
      setSeeding(false);
    }
  }

  return (
    <AppShell role={me?.role ?? null} email={me?.email ?? null} onLogout={handleLogout}>
      <div className="space-y-6">

        {/* Header + seed button */}
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[--border] bg-[--surface-2] p-6">
          <div>
            <h2 className="text-base font-semibold text-[--foreground]">Mapeamentos de Contas</h2>
            <p className="mt-1 text-sm text-[--text-muted]">
              Define como os códigos do balancete se transformam nos campos do dashboard (Faturamento, Despesas, etc.).
            </p>
          </div>
          <button
            onClick={() => void handleSeed()}
            disabled={seeding}
            className="rounded-xl bg-[#0f4c81] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0d3f6e] disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            {seeding ? "Inicializando..." : mappings.length === 0 ? "Inicializar Mapeamentos Padrão" : "↺ Resetar para Padrão"}
          </button>
        </div>

        {message ? (
          <div className={`rounded-xl border p-4 text-sm ${message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-red-200 bg-red-50 text-red-800 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-300"}`}>
            {message.text}
          </div>
        ) : null}

        {/* Empty state */}
        {!isLoading && mappings.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300">
            Nenhum mapeamento configurado. Clique em <strong>Inicializar Mapeamentos Padrão</strong> para criar as regras baseadas no Balancete de referência.
          </div>
        ) : null}

        {/* Mappings table */}
        {mappings.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-[--border]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[--border] bg-[--surface-2] text-xs font-medium uppercase tracking-wide text-[--text-muted]">
                <tr>
                  <th className="px-4 py-3">Campo do Dashboard</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Códigos / Fórmula</th>
                  <th className="px-4 py-3">Coluna</th>
                  <th className="px-4 py-3">Agregação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--border]">
                {mappings.map((m) => (
                  <tr key={m.id} className={m.isCalculated ? "bg-blue-50/40 dark:bg-blue-950/20" : ""}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[--foreground]">{m.dashboardField}</td>
                    <td className="px-4 py-3">
                      {m.isCalculated ? (
                        <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">Calculado</span>
                      ) : (
                        <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">{m.matchType}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[--text-muted]">
                      {m.isCalculated
                        ? m.formula ?? "—"
                        : m.codes.length > 0
                          ? m.codes.join(", ")
                          : <span className="italic opacity-60">sem códigos (configurar)</span>}
                    </td>
                    <td className="px-4 py-3 text-[--text-muted]">
                      {m.isCalculated ? "—" : (VALUE_COLUMN_LABELS[m.valueColumn] ?? m.valueColumn)}
                    </td>
                    <td className="px-4 py-3 text-[--text-muted]">{m.isCalculated ? "—" : m.aggregation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {mappings.length > 0 ? (
          <p className="text-xs text-zinc-400">
            Campos com <span className="font-medium text-zinc-500">sem códigos (configurar)</span> são para produtos específicos de cada empresa (LRA2, LRA3, etc.) e precisam ser configurados manualmente via API.
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
