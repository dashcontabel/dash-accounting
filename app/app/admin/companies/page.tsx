"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/app/components/app-shell";

type Company = {
  id: string;
  name: string;
  document: string | null;
  isActive: boolean;
  groupId: string;
  group: {
    id: string;
    name: string;
  };
};

type Group = {
  id: string;
  name: string;
  isActive: boolean;
};

type MeResponse = {
  user?: {
    id: string;
    email: string;
    role: "ADMIN" | "CLIENT";
  };
};

type CompanyForm = {
  name: string;
  document: string;
  groupId: string;
  isActive: boolean;
};

const initialForm: CompanyForm = {
  name: "",
  document: "",
  groupId: "",
  isActive: true,
};

export default function AdminCompaniesPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse["user"]>();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState<CompanyForm>(initialForm);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [meRes, companiesRes, groupsRes] = await Promise.all([
      fetch("/api/auth/me", { cache: "no-store" }),
      fetch("/api/admin/companies", { cache: "no-store" }),
      fetch("/api/admin/groups", { cache: "no-store" }),
    ]);

    if (!meRes.ok) {
      router.push("/login");
      return;
    }
    if (!companiesRes.ok || !groupsRes.ok) {
      setMessage("Nao foi possivel carregar os dados.");
      return;
    }

    const meData = (await meRes.json()) as MeResponse;
    const companiesData = (await companiesRes.json()) as { companies: Company[] };
    const groupsData = (await groupsRes.json()) as { groups: Group[] };

    setMe(meData.user);
    setCompanies(companiesData.companies);
    setGroups(groupsData.groups);
  }, [router]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        await load();
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...initialForm,
      groupId: groups.find((group) => group.isActive)?.id ?? "",
    });
    setIsOpen(true);
  }

  function openEdit(company: Company) {
    setEditing(company);
    setForm({
      name: company.name,
      document: company.document ?? "",
      groupId: company.groupId,
      isActive: company.isActive,
    });
    setIsOpen(true);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setMessage(null);

    const url = editing ? `/api/admin/companies/${editing.id}` : "/api/admin/companies";
    const method = editing ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        document: form.document.trim() || null,
      }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setMessage(data.error ?? "Falha ao salvar empresa.");
      return;
    }

    setIsOpen(false);
    await load();
  }

  async function handleDelete(companyId: string) {
    if (!confirm("Deseja remover esta empresa?")) return;
    const response = await fetch(`/api/admin/companies/${companyId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setMessage(data.error ?? "Falha ao remover empresa.");
      return;
    }
    await load();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <AppShell role={me?.role ?? null} email={me?.email ?? null} onLogout={handleLogout}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Empresas</h1>
          <p className="mt-1 text-sm text-[--text-muted]">
            Estruture empresas por grupo com status operacional claro.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 dark:hover:opacity-80"
        >
          Nova empresa
        </button>
      </div>

      {message ? <p className="mt-4 text-sm text-red-600 dark:text-red-400">{message}</p> : null}
      {isLoading ? <p className="mt-6 text-sm text-[--text-muted]">Carregando...</p> : null}

      {!isLoading ? (
        <>
          {/* Mobile card list */}
          <div className="mt-6 grid gap-3 md:hidden">
            {companies.map((company) => (
              <article
                key={company.id}
                className="rounded-xl border border-[--border] bg-[--surface] p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{company.name}</p>
                    <p className="text-xs text-[--text-muted]">Grupo: {company.group?.name ?? "-"}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                      company.isActive
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700/40 dark:text-zinc-400"
                    }`}
                  >
                    {company.isActive ? "ATIVO" : "INATIVO"}
                  </span>
                </div>
                <p className="mt-3 text-xs text-[--text-muted]">
                  Documento: {company.document ?? "-"}
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(company)}
                    className="rounded-lg border border-[--border] bg-[--surface-2] px-2 py-1 text-xs text-foreground hover:bg-[--border]"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(company.id)}
                    className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    Remover
                  </button>
                </div>
              </article>
            ))}
          </div>

          {/* Desktop table */}
          <div className="mt-6 hidden overflow-hidden rounded-xl border border-[--border] bg-[--surface] md:block">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[--border] bg-[--surface-2] text-[--text-muted]">
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Documento</th>
                  <th className="px-4 py-3 font-medium">Grupo</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.id} className="border-b border-[--border] last:border-0 hover:bg-[--surface-2] transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{company.name}</td>
                    <td className="px-4 py-3 text-[--text-muted]">{company.document ?? "-"}</td>
                    <td className="px-4 py-3 text-[--text-muted]">{company.group?.name ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          company.isActive
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700/40 dark:text-zinc-400"
                        }`}
                      >
                        {company.isActive ? "ATIVO" : "INATIVO"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(company)}
                          className="rounded-lg border border-[--border] bg-[--surface-2] px-2 py-1 text-xs text-foreground hover:bg-[--border]"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(company.id)}
                          className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
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
        </>
      ) : null}

      {isOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form
            onSubmit={(event) => void handleSave(event)}
            className="w-full max-w-lg rounded-2xl border border-[--border] bg-[--surface] p-6 shadow-2xl"
          >
            <h2 className="text-xl font-semibold text-foreground">
              {editing ? "Editar empresa" : "Nova empresa"}
            </h2>
            <p className="mt-1 text-sm text-[--text-muted]">
              Defina identificação, grupo e disponibilidade operacional.
            </p>

            <div className="mt-4 grid gap-4">
              <label className="text-sm font-medium text-foreground">
                Nome
                <input
                  value={form.name}
                  onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[--border] bg-[--surface-2] px-3 py-2.5 text-foreground placeholder:text-[--text-muted] focus:outline-none focus:ring-2 focus:ring-brand/40"
                  required
                />
              </label>
              <label className="text-sm font-medium text-foreground">
                Documento
                <input
                  value={form.document}
                  onChange={(event) => setForm((c) => ({ ...c, document: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[--border] bg-[--surface-2] px-3 py-2.5 text-foreground placeholder:text-[--text-muted] focus:outline-none focus:ring-2 focus:ring-brand/40"
                />
              </label>
              <label className="text-sm font-medium text-foreground">
                Grupo
                <select
                  value={form.groupId}
                  onChange={(event) => setForm((c) => ({ ...c, groupId: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[--border] bg-[--surface-2] px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40"
                  required
                >
                  <option value="" disabled>
                    Selecione um grupo
                  </option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm((c) => ({ ...c, isActive: event.target.checked }))}
                  className="rounded border-[--border] accent-brand"
                />
                Empresa ativa
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl border border-[--border] bg-[--surface-2] px-4 py-2 text-sm text-foreground hover:bg-[--border]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </AppShell>
  );
}
