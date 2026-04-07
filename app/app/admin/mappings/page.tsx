"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { confirmToast } from "@/app/components/confirm-toast";

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

type FormState = {
  dashboardField: string;
  matchType: "EXACT" | "PREFIX" | "LIST";
  codesRaw: string; // comma-separated
  valueColumn: "saldo_atual" | "debito" | "credito" | "saldo_anterior";
  aggregation: "SUM" | "ABS_SUM";
  isCalculated: boolean;
  formula: string;
};

const INITIAL_FORM: FormState = {
  dashboardField: "",
  matchType: "PREFIX",
  codesRaw: "",
  valueColumn: "credito",
  aggregation: "SUM",
  isCalculated: false,
  formula: "",
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

  // Modal state
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

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
    const seedToastId = toast.loading("Inicializando mapeamentos padrão...");
    try {
      const res = await fetch("/api/admin/mappings/seed", { method: "POST" });
      const data = (await res.json()) as { message?: string; count?: number; error?: string };
      if (res.ok) {
        toast.success(`${data.message ?? "OK"} (${data.count ?? 0} regras criadas)`, { id: seedToastId });
        await load();
      } else {
        toast.error(data.error ?? "Erro ao inicializar.", { id: seedToastId });
      }
    } catch {
      toast.error("Erro de rede.", { id: seedToastId });
    } finally {
      setSeeding(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setIsOpen(true);
  }

  function openEdit(m: MappingRow) {
    setEditingId(m.id);
    setForm({
      dashboardField: m.dashboardField,
      matchType: m.matchType as FormState["matchType"],
      codesRaw: m.codes.join(", "),
      valueColumn: m.valueColumn as FormState["valueColumn"],
      aggregation: m.aggregation as FormState["aggregation"],
      isCalculated: m.isCalculated,
      formula: m.formula ?? "",
    });
    setIsOpen(true);
  }

  async function handleSave() {
    setSaving(true);

    const codes = form.codesRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = editingId
      ? {
          matchType: form.matchType,
          codes,
          valueColumn: form.valueColumn,
          aggregation: form.aggregation,
          isCalculated: form.isCalculated,
          formula: form.isCalculated && form.formula ? form.formula : null,
        }
      : {
          dashboardField: form.dashboardField.trim().toUpperCase(),
          matchType: form.matchType,
          codes,
          valueColumn: form.valueColumn,
          aggregation: form.aggregation,
          isCalculated: form.isCalculated,
          formula: form.isCalculated && form.formula ? form.formula : null,
        };

    const url = editingId ? `/api/admin/mappings/${editingId}` : "/api/admin/mappings";
    const method = editingId ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Falha ao salvar.");
        return;
      }
      toast.success(editingId ? "Mapeamento atualizado com sucesso." : "Mapeamento criado com sucesso.");
      setIsOpen(false);
      await load();
    } catch {
      toast.error("Erro de rede.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!await confirmToast("Remover este mapeamento? Imports futuros não calcularão mais este campo.")) return;
    const res = await fetch(`/api/admin/mappings/${id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      const data = (await res.json()) as { error?: string };
      toast.error(data.error ?? "Falha ao remover.");
      return;
    }
    toast.success("Mapeamento removido.");
    await load();
  }

  const inputCls =
    "mt-1 w-full rounded-xl border border-[--border] bg-[--surface-2] px-3 py-2.5 text-sm text-foreground placeholder:text-[--text-muted] focus:outline-none focus:ring-2 focus:ring-brand/40 dark:[color-scheme:dark] dark:bg-[#1a2540] dark:text-zinc-100 [&_option]:dark:bg-[#1a2540] [&_option]:dark:text-zinc-100";

  return (
    <AppShell role={me?.role ?? null} email={me?.email ?? null} onLogout={handleLogout}>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[--border] bg-[--surface-2] p-6">
          <div>
            <h2 className="text-base font-semibold text-[--foreground]">Mapeamentos de Contas</h2>
            <p className="mt-1 text-sm text-[--text-muted]">
              Define como os códigos do balancete se transformam nos campos do dashboard. Alterações afetam apenas imports futuros.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openCreate}
              className="rounded-xl border border-brand bg-brand/10 px-4 py-2 text-sm font-medium text-brand hover:bg-brand/20 transition-colors"
            >
              + Novo Mapeamento
            </button>
            <button
              onClick={() => void handleSeed()}
              disabled={seeding}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {seeding ? "Inicializando..." : mappings.length === 0 ? "Inicializar Padrão" : "↺ Resetar Padrão"}
            </button>
          </div>
        </div>

        {/* Empty state */}
        {!isLoading && mappings.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300">
            Nenhum mapeamento configurado. Clique em <strong>Inicializar Padrão</strong> ou crie manualmente.
          </div>
        ) : null}

        {/* Mobile cards */}
        {mappings.length > 0 && (
          <div className="grid gap-3 md:hidden">
            {mappings.map((m) => (
              <article
                key={m.id}
                className={`rounded-xl border border-[--border] p-4 ${
                  m.isCalculated ? "bg-blue-50/40 dark:bg-blue-950/20" : "bg-[--surface]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="break-all font-mono text-xs font-semibold text-foreground">{m.dashboardField}</p>
                  {m.isCalculated ? (
                    <span className="shrink-0 rounded-md bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">Calculado</span>
                  ) : (
                    <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">{m.matchType}</span>
                  )}
                </div>
                <p className="mt-2 break-all font-mono text-xs text-[--text-muted]">
                  {m.isCalculated
                    ? (m.formula ?? "—")
                    : m.codes.length > 0
                      ? m.codes.join(", ")
                      : <span className="italic opacity-60">sem códigos</span>}
                </p>
                {!m.isCalculated && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[--text-muted]">
                    <span>Coluna: <strong className="text-foreground">{VALUE_COLUMN_LABELS[m.valueColumn] ?? m.valueColumn}</strong></span>
                    <span>Agregação: <strong className="text-foreground">{m.aggregation}</strong></span>
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(m)}
                    className="rounded-lg border border-[--border] bg-[--surface-2] px-3 py-1.5 text-xs font-medium text-foreground hover:bg-[--border] transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(m.id)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors dark:border-red-800/50 dark:bg-red-950/20 dark:text-red-400"
                  >
                    Remover
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Desktop table */}
        {mappings.length > 0 && (
          <div className="hidden overflow-hidden rounded-xl border border-[--border] md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[--border] bg-[--surface-2] text-xs font-medium uppercase tracking-wide text-[--text-muted]">
                <tr>
                  <th className="px-4 py-3">Campo</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Códigos / Fórmula</th>
                  <th className="px-4 py-3">Coluna</th>
                  <th className="px-4 py-3">Agregação</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--border]">
                {mappings.map((m) => (
                  <tr key={m.id} className={`hover:bg-[--surface-2] transition-colors ${m.isCalculated ? "bg-blue-50/40 dark:bg-blue-950/20" : ""}`}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{m.dashboardField}</td>
                    <td className="px-4 py-3">
                      {m.isCalculated ? (
                        <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">Calculado</span>
                      ) : (
                        <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">{m.matchType}</span>
                      )}
                    </td>
                    <td className="max-w-xs px-4 py-3 font-mono text-xs text-[--text-muted]">
                      <span className="block break-all">
                        {m.isCalculated
                          ? (m.formula ?? "—")
                          : m.codes.length > 0
                            ? m.codes.join(", ")
                            : <span className="italic opacity-60">sem códigos</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[--text-muted]">
                      {m.isCalculated ? "—" : (VALUE_COLUMN_LABELS[m.valueColumn] ?? m.valueColumn)}
                    </td>
                    <td className="px-4 py-3 text-[--text-muted]">{m.isCalculated ? "—" : m.aggregation}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(m)}
                          className="rounded-lg border border-[--border] bg-[--surface-2] px-3 py-1.5 text-xs font-medium text-foreground hover:bg-[--border] transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(m.id)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors dark:border-red-800/50 dark:bg-red-950/20 dark:text-red-400"
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {mappings.length > 0 && (
          <p className="text-xs text-zinc-400">
            Campos <em>sem códigos</em> (LRA2, LRA3, etc.) são específicos por empresa e devem ser configurados manualmente.
            Alterações de mapeamento <strong>não recalculam</strong> dados já importados — reimporte o arquivo para atualizar.
          </p>
        )}
      </div>

      {/* Modal create / edit */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[--border] bg-white dark:bg-[#0d1527] p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-foreground">
              {editingId ? "Editar Mapeamento" : "Novo Mapeamento"}
            </h3>

            <div className="mt-4 space-y-4">
              {/* Campo do Dashboard */}
              <label className="block text-sm font-medium text-foreground">
                Campo do Dashboard
                {editingId ? (
                  <p className="mt-1 rounded-xl border border-[--border] bg-[--surface-2] px-3 py-2.5 font-mono text-sm text-[--text-muted]">
                    {form.dashboardField}
                  </p>
                ) : (
                  <input
                    type="text"
                    value={form.dashboardField}
                    onChange={(e) => setForm((c) => ({ ...c, dashboardField: e.target.value }))}
                    placeholder="Ex: FATURAMENTO"
                    className={inputCls}
                  />
                )}
              </label>

              {/* Calculado toggle */}
              <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={form.isCalculated}
                  onChange={(e) => setForm((c) => ({ ...c, isCalculated: e.target.checked }))}
                  className="h-4 w-4 rounded border-[--border] accent-brand"
                />
                Campo calculado por fórmula
              </label>

              {form.isCalculated ? (
                <label className="block text-sm font-medium text-foreground">
                  Fórmula
                  <input
                    type="text"
                    value={form.formula}
                    onChange={(e) => setForm((c) => ({ ...c, formula: e.target.value }))}
                    placeholder="Ex: {RECEITA_BRUTA} - {DEDUCOES}"
                    className={inputCls}
                  />
                  <span className="mt-1 block text-xs text-[--text-muted]">Use {"{CAMPO}"} para referenciar outros campos.</span>
                </label>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-foreground">
                      Tipo de Correspondência
                      <select
                        value={form.matchType}
                        onChange={(e) => setForm((c) => ({ ...c, matchType: e.target.value as FormState["matchType"] }))}
                        className={inputCls}
                      >
                        <option value="PREFIX">PREFIX — começa com</option>
                        <option value="EXACT">EXACT — exato</option>
                        <option value="LIST">LIST — lista exata</option>
                      </select>
                    </label>

                    <label className="block text-sm font-medium text-foreground">
                      Coluna de Valor
                      <select
                        value={form.valueColumn}
                        onChange={(e) => setForm((c) => ({ ...c, valueColumn: e.target.value as FormState["valueColumn"] }))}
                        className={inputCls}
                      >
                        <option value="credito">Crédito</option>
                        <option value="debito">Débito</option>
                        <option value="saldo_atual">Saldo Atual</option>
                        <option value="saldo_anterior">Saldo Anterior</option>
                      </select>
                    </label>
                  </div>

                  <label className="block text-sm font-medium text-foreground">
                    Agregação
                    <select
                      value={form.aggregation}
                      onChange={(e) => setForm((c) => ({ ...c, aggregation: e.target.value as FormState["aggregation"] }))}
                      className={inputCls}
                    >
                      <option value="SUM">SUM — soma direta</option>
                      <option value="ABS_SUM">ABS_SUM — soma dos valores absolutos</option>
                    </select>
                  </label>

                  <label className="block text-sm font-medium text-foreground">
                    Códigos de Conta
                    <input
                      type="text"
                      value={form.codesRaw}
                      onChange={(e) => setForm((c) => ({ ...c, codesRaw: e.target.value }))}
                      placeholder="Ex: 4.1.1, 4.1.2"
                      className={inputCls}
                    />
                    <span className="mt-1 block text-xs text-[--text-muted]">Separe os códigos por vírgula.</span>
                  </label>
                </>
              )}

            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl border border-[--border] bg-[--surface-2] px-4 py-2 text-sm font-medium text-foreground hover:bg-[--border] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || (!form.isCalculated ? false : !form.formula.trim()) || (!editingId && !form.dashboardField.trim())}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}


