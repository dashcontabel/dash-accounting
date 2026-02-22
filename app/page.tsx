"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "./components/app-shell";

type MeResponse = {
  user?: {
    id: string;
    email: string;
    name: string | null;
    role: "ADMIN" | "CLIENT";
    status: "ACTIVE" | "INACTIVE";
  };
  allowedCompanies?: Array<{
    id: string;
    name: string;
    groupId: string;
  }>;
  activeCompanyId?: string | null;
  error?: string;
};

function hashFromString(value: string) {
  return value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function buildMockMetrics(companyId: string) {
  const seed = hashFromString(companyId);
  const saldo = 150000 + (seed % 20000);
  const faturamento = 320000 + (seed % 50000);
  const rentabilidade = Number((((faturamento - saldo) / faturamento) * 100).toFixed(1));

  const monthly = Array.from({ length: 6 }).map((_, index) => {
    const month = new Date(2026, index + 1, 1).toLocaleString("pt-BR", {
      month: "short",
    });
    const value = 40 + ((seed + index * 13) % 55);
    return { month, value };
  });

  const tableRows = [
    { conta: "Receita Operacional", valor: faturamento },
    { conta: "Custos", valor: saldo * 0.55 },
    { conta: "Despesas Administrativas", valor: saldo * 0.2 },
    { conta: "Resultado", valor: faturamento - saldo * 0.75 },
  ];

  return { saldo, faturamento, rentabilidade, monthly, tableRows };
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function Home() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"ADMIN" | "CLIENT" | null>(null);
  const [allowedCompanies, setAllowedCompanies] = useState<
    Array<{ id: string; name: string; groupId: string }>
  >([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [persistAsDefault, setPersistAsDefault] = useState(true);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [contextMessage, setContextMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadMe() {
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
            data.activeCompanyId ?? (companies.length === 1 ? companies[0].id : "");

          setUserEmail(data.user.email);
          setUserRole(data.user.role);
          setAllowedCompanies(companies);
          setSelectedCompanyId(initialCompanyId);
          setPersistAsDefault(companies.length <= 1);
        }
      } catch {
        router.push("/login");
      }
    }

    loadMe();

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function saveDefaultCompany(companyId: string) {
    const response = await fetch("/api/context/active-company", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ companyId }),
    });

    return response.ok;
  }

  async function handleSelectCompany(companyId: string) {
    setSelectedCompanyId(companyId);
    setContextMessage(null);

    if (!companyId || !persistAsDefault) return;

    setIsSavingCompany(true);
    const ok = await saveDefaultCompany(companyId);
    setContextMessage(ok ? "Empresa padrao atualizada." : "Nao foi possivel salvar empresa padrao.");
    setIsSavingCompany(false);
  }

  async function handleTogglePersist(checked: boolean) {
    setPersistAsDefault(checked);
    setContextMessage(null);

    if (!checked || !selectedCompanyId) return;

    setIsSavingCompany(true);
    const ok = await saveDefaultCompany(selectedCompanyId);
    setContextMessage(ok ? "Empresa padrao atualizada." : "Nao foi possivel salvar empresa padrao.");
    setIsSavingCompany(false);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const selectedCompany = allowedCompanies.find((company) => company.id === selectedCompanyId) ?? null;
  const mockMetrics = useMemo(
    () => (selectedCompanyId ? buildMockMetrics(selectedCompanyId) : null),
    [selectedCompanyId],
  );

  return (
    <AppShell role={userRole} email={userEmail} onLogout={handleLogout}>
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-7">
        <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <label htmlFor="active-company-select" className="block text-sm font-medium text-zinc-700">
              Empresa ativa
            </label>
            <select
              id="active-company-select"
              value={selectedCompanyId}
              onChange={(event) => void handleSelectCompany(event.target.value)}
              disabled={isSavingCompany || allowedCompanies.length === 0}
              className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-zinc-900 outline-none transition focus:border-[#0f4c81] disabled:bg-zinc-100"
            >
              <option value="" disabled>
                Selecione uma empresa
              </option>
              {allowedCompanies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={persistAsDefault || allowedCompanies.length <= 1}
              disabled={allowedCompanies.length <= 1}
              onChange={(event) => void handleTogglePersist(event.target.checked)}
            />
            Definir como empresa padrao
          </label>
        </div>
        {contextMessage ? <p className="mt-3 text-sm text-zinc-600">{contextMessage}</p> : null}
      </div>

      {!selectedCompany ? (
        <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 sm:p-7 text-sm text-zinc-600">
          Selecione uma empresa para visualizar saldo, faturamento, rentabilidade e demonstrativos.
        </div>
      ) : null}

      {selectedCompany && mockMetrics ? (
        <>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <article className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Saldo</p>
              <p className="mt-2 text-xl font-semibold text-zinc-900">{formatCurrency(mockMetrics.saldo)}</p>
            </article>
            <article className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Faturamento</p>
              <p className="mt-2 text-xl font-semibold text-zinc-900">
                {formatCurrency(mockMetrics.faturamento)}
              </p>
            </article>
            <article className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-6">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Rentabilidade</p>
              <p className="mt-2 text-xl font-semibold text-zinc-900">{mockMetrics.rentabilidade}%</p>
            </article>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-zinc-200 bg-white p-6">
              <h2 className="text-base font-semibold text-zinc-900">Demonstrativo (Tabela)</h2>
              <p className="mt-1 text-xs text-zinc-500">Visualizacao desktop</p>
              <div className="mt-3 hidden overflow-hidden rounded-lg border border-zinc-200 md:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-zinc-500">
                    <tr>
                      <th className="px-3 py-2">Conta</th>
                      <th className="px-3 py-2">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockMetrics.tableRows.map((row) => (
                      <tr key={row.conta} className="border-t border-zinc-100">
                        <td className="px-3 py-2">{row.conta}</td>
                        <td className="px-3 py-2">{formatCurrency(row.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 grid gap-2 md:hidden">
                {mockMetrics.tableRows.map((row) => (
                  <div key={row.conta} className="rounded-lg border border-zinc-200 p-3">
                    <p className="text-sm font-medium text-zinc-800">{row.conta}</p>
                    <p className="mt-1 text-sm text-zinc-600">{formatCurrency(row.valor)}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-zinc-200 bg-white p-6">
              <h2 className="text-base font-semibold text-zinc-900">Evolucao (Grafico)</h2>
              <p className="mt-1 text-xs text-zinc-500">Mock visual para apresentacao</p>
              <div className="mt-4 flex h-48 items-end gap-3 rounded-lg border border-zinc-100 bg-[#f8fbff] p-3">
                {mockMetrics.monthly.map((item) => (
                  <div key={item.month} className="flex flex-1 flex-col items-center">
                    <div className="flex h-32 w-full items-end justify-center">
                      <div
                        className="w-6 rounded-t-md bg-gradient-to-t from-[#0f4c81] to-[#3b82f6]"
                        style={{ height: `${item.value}%` }}
                        title={`${item.month} - ${item.value}`}
                      />
                    </div>
                    <span className="mt-2 text-[11px] uppercase text-zinc-500">{item.month}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
