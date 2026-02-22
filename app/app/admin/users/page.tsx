"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/app/components/app-shell";

type UserRole = "ADMIN" | "CLIENT";
type UserStatus = "ACTIVE" | "INACTIVE";

type Company = {
  id: string;
  name: string;
};

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  status: UserStatus;
  companyIds: string[];
  companies: Company[];
};

type MeResponse = {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
};

type UserPayload = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  status: UserStatus;
  companyIds: string[];
};

const initialForm: UserPayload = {
  name: "",
  email: "",
  password: "",
  role: "CLIENT",
  status: "ACTIVE",
  companyIds: [],
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse["user"]>();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState<UserPayload>(initialForm);
  const [message, setMessage] = useState<string | null>(null);

  const title = editingUser ? "Editar usuario" : "Novo usuario";

  const canSubmit = useMemo(() => {
    if (!form.email.trim()) return false;
    if (!editingUser && form.password.length < 8) return false;
    return true;
  }, [editingUser, form.email, form.password.length]);

  const load = useCallback(async () => {
    const [meRes, usersRes, companiesRes] = await Promise.all([
      fetch("/api/auth/me", { cache: "no-store" }),
      fetch("/api/admin/users", { cache: "no-store" }),
      fetch("/api/admin/companies", { cache: "no-store" }),
    ]);

    if (!meRes.ok) {
      router.push("/login");
      return;
    }
    if (!usersRes.ok || !companiesRes.ok) {
      setMessage("Nao foi possivel carregar os dados.");
      return;
    }

    const meData = (await meRes.json()) as MeResponse;
    const usersData = (await usersRes.json()) as { users: UserRow[] };
    const companiesData = (await companiesRes.json()) as { companies: Company[] };

    setMe(meData.user);
    setUsers(usersData.users);
    setCompanies(companiesData.companies);
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

  function openCreateModal() {
    setEditingUser(null);
    setForm(initialForm);
    setIsOpen(true);
    setMessage(null);
  }

  function openEditModal(user: UserRow) {
    setEditingUser(user);
    setForm({
      name: user.name ?? "",
      email: user.email,
      password: "",
      role: user.role,
      status: user.status,
      companyIds: user.companyIds,
    });
    setIsOpen(true);
    setMessage(null);
  }

  function toggleCompany(companyId: string) {
    setForm((current) => {
      const has = current.companyIds.includes(companyId);
      return {
        ...current,
        companyIds: has
          ? current.companyIds.filter((id) => id !== companyId)
          : [...current.companyIds, companyId],
      };
    });
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setMessage(null);

    const payload = {
      ...form,
      name: form.name.trim() || undefined,
      companyIds: form.role === "CLIENT" ? form.companyIds : [],
      ...(editingUser ? {} : { password: form.password }),
      ...(editingUser && !form.password ? { password: undefined } : {}),
    };

    const url = editingUser ? `/api/admin/users/${editingUser.id}` : "/api/admin/users";
    const method = editingUser ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setMessage(data.error ?? "Falha ao salvar usuario.");
      return;
    }

    setIsOpen(false);
    await load();
  }

  async function handleDelete(userId: string) {
    if (!confirm("Deseja remover este usuario?")) return;

    const response = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setMessage(data.error ?? "Falha ao remover usuario.");
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
          <h1 className="text-2xl font-semibold text-zinc-900">Usuarios</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Gerencie perfis administrativos e clientes com controle por empresa.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="rounded-xl bg-[#0f4c81] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0d416d]"
        >
          Novo usuario
        </button>
      </div>

      {message ? <p className="mt-4 text-sm text-red-600">{message}</p> : null}
      {isLoading ? <p className="mt-6 text-sm text-zinc-600">Carregando...</p> : null}

      {!isLoading ? (
        <>
          <div className="mt-6 grid gap-3 md:hidden">
            {users.map((user) => (
              <article
                key={user.id}
                className="w-full min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-900">{user.name ?? "-"}</p>
                    <p className="break-all text-xs text-zinc-500">{user.email}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">
                    {user.role}
                  </span>
                </div>
                <div className="mt-3 min-w-0 space-y-1 text-xs text-zinc-600">
                  <p>Status: {user.status}</p>
                  <p className="break-words">
                    Empresas:{" "}
                    {user.companies.length > 0
                      ? user.companies.map((company) => company.name).join(", ")
                      : "-"}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
                    onClick={() => openEditModal(user)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    onClick={() => void handleDelete(user.id)}
                  >
                    Remover
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 hidden overflow-hidden rounded-xl border border-zinc-200 bg-white md:block">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-[#f8fafc] text-zinc-500">
                <th className="px-4 py-3 pr-4">Nome</th>
                <th className="px-4 py-3 pr-4">Email</th>
                <th className="px-4 py-3 pr-4">Perfil</th>
                <th className="px-4 py-3 pr-4">Status</th>
                <th className="px-4 py-3 pr-4">Empresas</th>
                <th className="px-4 py-3">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-zinc-100">
                  <td className="px-4 py-3 pr-4">{user.name ?? "-"}</td>
                  <td className="px-4 py-3 pr-4">{user.email}</td>
                  <td className="px-4 py-3 pr-4">
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 pr-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        user.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 pr-4">
                    {user.companies.length > 0
                      ? user.companies.map((company) => company.name).join(", ")
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
                        onClick={() => openEditModal(user)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        onClick={() => void handleDelete(user.id)}
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/55 p-4">
          <form
            onSubmit={(event) => void handleSave(event)}
            className="w-full max-h-[90vh] max-w-xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl"
          >
            <h2 className="text-xl font-semibold text-zinc-900">{title}</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Defina dados do usuario e escopo de empresas para CLIENT.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-zinc-700">
                Nome
                <input
                  value={form.name}
                  onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2.5"
                />
              </label>
              <label className="text-sm text-zinc-700">
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((c) => ({ ...c, email: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2.5"
                />
              </label>
              <label className="text-sm text-zinc-700">
                Senha {editingUser ? "(opcional)" : ""}
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((c) => ({ ...c, password: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2.5"
                />
              </label>
              <label className="text-sm text-zinc-700">
                Perfil
                <select
                  value={form.role}
                  onChange={(event) =>
                    setForm((c) => ({ ...c, role: event.target.value as UserRole }))
                  }
                  className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2.5"
                >
                  <option value="CLIENT">CLIENT</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </label>
              <label className="text-sm text-zinc-700">
                Status
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((c) => ({ ...c, status: event.target.value as UserStatus }))
                  }
                  className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2.5"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </label>
            </div>

            {form.role === "CLIENT" ? (
              <div className="mt-4 rounded-xl border border-zinc-200 bg-[#f8fafc] p-3">
                <p className="text-sm font-medium text-zinc-700">Empresas vinculadas</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {companies.map((company) => (
                    <label key={company.id} className="flex items-center gap-2 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        checked={form.companyIds.includes(company.id)}
                        onChange={() => toggleCompany(company.id)}
                      />
                      {company.name}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                        className="rounded-xl border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-xl bg-[#0f4c81] px-4 py-2 text-sm text-white hover:bg-[#0d416d] disabled:bg-zinc-400"
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
