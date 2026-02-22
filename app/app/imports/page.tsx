"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/app/components/app-shell";

type MeUser = {
  id: string;
  email: string;
  role: "ADMIN" | "CLIENT";
};

type Company = {
  id: string;
  name: string;
};

type ImportBatch = {
  id: string;
  referenceMonth: string;
  status: "PROCESSING" | "SUCCESS" | "FAILED";
  fileName: string | null;
  totalRows: number;
  processedRows: number;
  lastError: string | null;
  createdAt: string;
};

type MeResponse = {
  user?: MeUser;
  allowedCompanies?: Company[];
  activeCompanyId?: string | null;
};

export default function ImportsPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeUser | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [referenceMonth, setReferenceMonth] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canUpload = useMemo(
    () => Boolean(file && selectedCompanyId && referenceMonth),
    [file, selectedCompanyId, referenceMonth],
  );

  async function loadBatches(companyId: string) {
    if (!companyId) return;
    const response = await fetch(`/api/imports?companyId=${companyId}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error ?? "Falha ao carregar imports.");
    }
    const data = (await response.json()) as { batches: ImportBatch[] };
    setBatches(data.batches);
  }

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) {
          router.push("/login");
          return;
        }
        const data = (await response.json()) as MeResponse;
        if (!data.user) {
          router.push("/login");
          return;
        }
        const allowedCompanies = data.allowedCompanies ?? [];
        const initialCompanyId =
          data.user.role === "ADMIN"
            ? data.activeCompanyId ?? allowedCompanies[0]?.id ?? ""
            : allowedCompanies[0]?.id ?? "";

        if (!isMounted) return;
        setMe(data.user);
        setCompanies(allowedCompanies);
        setSelectedCompanyId(initialCompanyId);
        setReferenceMonth(new Date().toISOString().slice(0, 7));

        if (initialCompanyId) {
          await loadBatches(initialCompanyId);
        }
      } catch (error) {
        if (!isMounted) return;
        setMessage(error instanceof Error ? error.message : "Falha ao carregar pagina.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    if (!canUpload || !file) return;

    setMessage(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("companyId", selectedCompanyId);
      formData.append("referenceMonth", referenceMonth);

      const response = await fetch("/api/imports", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        error?: string;
        message?: string;
        idempotent?: boolean;
      };

      if (!response.ok) {
        setMessage(data.error ?? "Falha no upload.");
        return;
      }

      setMessage(
        data.idempotent
          ? data.message ?? "Arquivo ja importado anteriormente."
          : "Importacao realizada com sucesso.",
      );
      setFile(null);
      await loadBatches(selectedCompanyId);
    } catch {
      setMessage("Falha no upload.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleCompanyChange(companyId: string) {
    setSelectedCompanyId(companyId);
    setMessage(null);
    if (companyId) {
      try {
        await loadBatches(companyId);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Falha ao carregar imports.");
      }
    } else {
      setBatches([]);
    }
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
          <h1 className="text-2xl font-semibold text-zinc-900">Importar Balancete CSV</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Faça upload mensal com validação, rastreabilidade e idempotência.
          </p>
        </div>
      </div>

      <form onSubmit={(event) => void handleUpload(event)} className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm text-zinc-700">
            Empresa
            <select
              value={selectedCompanyId}
              onChange={(event) => void handleCompanyChange(event.target.value)}
              disabled={me?.role !== "ADMIN"}
              className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2.5"
            >
              <option value="" disabled>
                Selecione
              </option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-zinc-700">
            Mes de referencia
            <input
              type="month"
              value={referenceMonth}
              onChange={(event) => setReferenceMonth(event.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2.5"
              required
            />
          </label>
          <label className="text-sm text-zinc-700">
            Arquivo CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2.5 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1"
              required
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={!canUpload || isUploading}
            className="rounded-xl bg-[#0f4c81] px-4 py-2 text-sm font-medium text-white disabled:bg-zinc-400"
          >
            {isUploading ? "Processando..." : "Importar"}
          </button>
          <p className="text-xs text-zinc-500">Limite: 5MB por arquivo</p>
        </div>
      </form>

      {message ? (
        <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          {message}
        </p>
      ) : null}

      {isLoading ? <p className="mt-6 text-sm text-zinc-600">Carregando...</p> : null}

      {!isLoading ? (
        <div className="mt-6 space-y-3">
          {batches.length === 0 ? (
            <p className="text-sm text-zinc-600">Nenhum batch importado para a empresa selecionada.</p>
          ) : null}
          {batches.map((batch) => (
            <article key={batch.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">
                    {batch.fileName || "Arquivo sem nome"} - {batch.referenceMonth}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {new Date(batch.createdAt).toLocaleString("pt-BR")}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                    batch.status === "SUCCESS"
                      ? "bg-emerald-50 text-emerald-700"
                      : batch.status === "FAILED"
                        ? "bg-red-50 text-red-700"
                        : "bg-blue-50 text-blue-700"
                  }`}
                >
                  {batch.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-700">
                Linhas processadas: {batch.processedRows} / {batch.totalRows}
              </p>
              {batch.lastError ? (
                <p className="mt-2 text-sm text-red-700">Erro: {batch.lastError}</p>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </AppShell>
  );
}
