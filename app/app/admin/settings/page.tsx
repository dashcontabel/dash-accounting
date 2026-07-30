"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import AppShell from "@/app/components/app-shell";

type MeResponse = {
  user?: { id: string; email: string; role: "ADMIN" | "CLIENT" };
  allowedCompanies?: Array<{ id: string; name: string; groupId: string }>;
  activeCompanyId?: string | null;
};

type TenantDisplayMode = "ALL" | "SELECTED";

type TenantDisplaySettings = {
  mode: TenantDisplayMode;
  visibleTenantKeys: string[];
};

type TenantPaymentStatus = "PAID" | "OPEN" | "PARTIAL";

type TenantItem = {
  key: string;
  description: string;
  totalCredit: number;
  annualForecast: number;
  balance: number;
  payment?: {
    provisioned: number;
    paid: number;
    openBalance: number;
    status: TenantPaymentStatus;
  };
};

type TenantSummaryResponse = {
  hasTenantData: boolean;
  items: TenantItem[];
};

const currentYear = String(new Date().getFullYear());

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusLabel(status: TenantPaymentStatus) {
  if (status === "PAID") return "Pago";
  if (status === "PARTIAL") return "Parcial";
  return "Aberto";
}

function statusClasses(status: TenantPaymentStatus) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (status === "PARTIAL") return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse["user"]>();
  const [companies, setCompanies] = useState<NonNullable<MeResponse["allowedCompanies"]>>([]);
  const [companyId, setCompanyId] = useState("");
  const [year, setYear] = useState(currentYear);
  const [mode, setMode] = useState<TenantDisplayMode>("ALL");
  const [visibleTenantKeys, setVisibleTenantKeys] = useState<string[]>([]);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [search, setSearch] = useState("");
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await response.json()) as MeResponse;

      if (!response.ok || data.user?.role !== "ADMIN") {
        router.push("/");
        return;
      }

      const allowedCompanies = data.allowedCompanies ?? [];
      setMe(data.user);
      setCompanies(allowedCompanies);
      setCompanyId((current) => current || data.activeCompanyId || allowedCompanies[0]?.id || "");
    } finally {
      setLoadingSession(false);
    }
  }, [router]);

  const loadTenantParameters = useCallback(async (selectedCompanyId: string, selectedYear: string) => {
    if (!selectedCompanyId || !/^\d{4}$/.test(selectedYear)) return;

    setLoadingTenants(true);
    try {
      const params = new URLSearchParams({ companyId: selectedCompanyId });
      const tenantParams = new URLSearchParams({
        companyId: selectedCompanyId,
        year: selectedYear,
        includeHidden: "true",
      });

      const [settingsResponse, tenantsResponse] = await Promise.all([
        fetch(`/api/admin/settings/tenant-display?${params.toString()}`, { cache: "no-store" }),
        fetch(`/api/dashboard/tenants?${tenantParams.toString()}`, { cache: "no-store" }),
      ]);

      if (!settingsResponse.ok || !tenantsResponse.ok) {
        toast.error("Nao foi possivel carregar as parametrizacoes.");
        return;
      }

      const settingsData = (await settingsResponse.json()) as { settings: TenantDisplaySettings };
      const tenantsData = (await tenantsResponse.json()) as TenantSummaryResponse;

      setMode(settingsData.settings.mode);
      setVisibleTenantKeys(settingsData.settings.visibleTenantKeys);
      setTenants(tenantsData.items ?? []);
    } finally {
      setLoadingTenants(false);
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    void loadTenantParameters(companyId, year);
  }, [companyId, loadTenantParameters, year]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function toggleTenant(key: string) {
    setVisibleTenantKeys((current) =>
      current.includes(key)
        ? current.filter((candidate) => candidate !== key)
        : [...current, key].sort(),
    );
  }

  async function handleSave() {
    if (!companyId) return;

    setSaving(true);
    try {
      const response = await fetch("/api/admin/settings/tenant-display", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          mode,
          visibleTenantKeys: mode === "ALL" ? [] : visibleTenantKeys,
        }),
      });
      const data = (await response.json()) as { settings?: TenantDisplaySettings; error?: string };

      if (!response.ok || !data.settings) {
        toast.error(data.error ?? "Falha ao salvar.");
        return;
      }

      setMode(data.settings.mode);
      setVisibleTenantKeys(data.settings.visibleTenantKeys);
      toast.success("Parametrizacao salva.");
    } finally {
      setSaving(false);
    }
  }

  const selectedKeys = useMemo(() => {
    if (mode === "ALL") return tenants.map((tenant) => tenant.key);
    return visibleTenantKeys;
  }, [mode, tenants, visibleTenantKeys]);

  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const filteredTenants = useMemo(() => {
    const query = normalizeSearch(search);
    if (!query) return tenants;
    return tenants.filter((tenant) => normalizeSearch(tenant.description).includes(query));
  }, [search, tenants]);

  const allTenantKeys = useMemo(() => tenants.map((tenant) => tenant.key).sort(), [tenants]);

  return (
    <AppShell role={me?.role ?? null} email={me?.email ?? null} onLogout={handleLogout}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Configuracoes</h1>
            <p className="mt-1 text-sm text-[--text-muted]">Parametrizacoes</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="text-xs font-medium text-[--text-muted]">
              Empresa
              <select
                className="mt-1 h-10 min-w-64 rounded-xl border border-[--border] bg-[--surface-2] px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-brand/30 dark:[color-scheme:dark]"
                value={companyId}
                onChange={(event) => setCompanyId(event.target.value)}
                disabled={loadingSession}
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-[--text-muted]">
              Ano
              <input
                className="mt-1 h-10 w-28 rounded-xl border border-[--border] bg-[--surface-2] px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-brand/30 dark:[color-scheme:dark]"
                value={year}
                onChange={(event) => setYear(event.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
              />
            </label>
          </div>
        </div>

        <div className="flex gap-1 rounded-xl border border-[--border] bg-[--surface-2] p-1">
          <button
            type="button"
            className="rounded-lg bg-[--surface] px-4 py-2 text-sm font-medium text-foreground shadow-sm"
          >
            Parametrizacoes
          </button>
        </div>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Locatarios do dashboard</h2>
              <p className="mt-1 text-xs text-[--text-muted]">
                {mode === "ALL"
                  ? `${tenants.length} locatario${tenants.length === 1 ? "" : "s"} visivel${tenants.length === 1 ? "" : "s"}`
                  : `${visibleTenantKeys.length} de ${tenants.length} selecionado${visibleTenantKeys.length === 1 ? "" : "s"}`}
              </p>
            </div>

            <div className="flex rounded-xl border border-[--border] bg-[--surface-2] p-1">
              {(["ALL", "SELECTED"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMode(option)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    mode === option
                      ? "bg-[--surface] text-foreground shadow-sm"
                      : "text-[--text-muted] hover:text-foreground"
                  }`}
                >
                  {option === "ALL" ? "Todos" : "Selecionados"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <input
              className="h-10 w-full rounded-xl border border-[--border] bg-[--surface-2] px-3 text-sm text-foreground outline-none placeholder:text-[--text-muted] focus:ring-2 focus:ring-brand/30 sm:max-w-xs"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar locatario"
            />

            {mode === "SELECTED" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setVisibleTenantKeys(allTenantKeys)}
                  className="rounded-xl border border-[--border] px-3 py-2 text-xs font-medium text-foreground hover:bg-[--surface-2]"
                >
                  Selecionar todos
                </button>
                <button
                  type="button"
                  onClick={() => setVisibleTenantKeys([])}
                  className="rounded-xl border border-[--border] px-3 py-2 text-xs font-medium text-foreground hover:bg-[--surface-2]"
                >
                  Limpar
                </button>
              </div>
            )}
          </div>

          {loadingTenants ? (
            <p className="py-6 text-sm text-[--text-muted]">Carregando...</p>
          ) : filteredTenants.length === 0 ? (
            <p className="py-6 text-sm text-[--text-muted]">Nenhum locatario encontrado.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[--border]">
              <div className="max-h-[34rem] overflow-auto">
                {filteredTenants.map((tenant) => {
                  const checked = selectedSet.has(tenant.key);
                  const paid = tenant.payment?.paid ?? tenant.totalCredit;
                  const open = tenant.payment?.openBalance ?? Math.max(tenant.annualForecast - tenant.totalCredit, 0);
                  const status = tenant.payment?.status;

                  return (
                    <label
                      key={tenant.key}
                      className="grid cursor-pointer grid-cols-[auto_1fr] gap-3 border-b border-[--border] px-4 py-3 last:border-b-0 hover:bg-[--surface-2] sm:grid-cols-[auto_1fr_auto]"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-[--border] text-brand focus:ring-brand/30"
                        checked={checked}
                        disabled={mode === "ALL"}
                        onChange={() => toggleTenant(tenant.key)}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{tenant.description}</p>
                        <p className="mt-1 text-xs text-[--text-muted]">
                          Pago {formatCurrency(paid)} · Aberto {formatCurrency(open)}
                        </p>
                      </div>
                      {status && (
                        <span className={`w-fit rounded-full px-2 py-1 text-[11px] font-semibold ${statusClasses(status)}`}>
                          {statusLabel(status)}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || loadingTenants || !companyId}
              className="rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar parametrizacao"}
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
