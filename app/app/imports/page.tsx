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
  sourceType: "XLSX";
  status: "PENDING" | "PROCESSING" | "DONE" | "FAILED";
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

type SummaryPayload = Record<string, number>;

export default function ImportsPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeUser | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [referenceMonth, setReferenceMonth] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
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

  async function loadBatchDetails(batchId: string) {
    const response = await fetch(`/api/imports/${batchId}`, { cache: "no-store" });
    if (!response.ok) return;

    const data = (await response.json()) as {
      summary?: { dataJson?: SummaryPayload } | null;
      batch?: { totalsJson?: { summary?: SummaryPayload } | null };
    };

    setSummary(
      data.summary?.dataJson ??
        (data.batch?.totalsJson as { summary?: SummaryPayload } | undefined)?.summary ??
        null,
    );
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

      const response = await fetch("/api/imports/xlsx", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as {
        error?: string;
        idempotent?: boolean;
        batchId?: string;
        summary?: SummaryPayload | null;
      };

      if (!response.ok) {
        setMessage(data.error ?? "Falha no upload.");
        return;
      }

      setMessage(data.idempotent ? "Arquivo ja importado para este periodo." : "Importacao concluida.");
      setSelectedBatchId(data.batchId ?? null);
      setSummary(data.summary ?? null);
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
    setSelectedBatchId(null);
    setSummary(null);
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

  async function handleSelectBatch(batchId: string) {
    setSelectedBatchId(batchId);
    await loadBatchDetails(batchId);
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
          <h1 className="text-2xl font-semibold text-foreground">Importar Balancete XLSX</h1>
          <p className="mt-1 text-sm text-[--text-muted]">
            Upload mensal com mapeamento por conta, idempotência e resumo consolidado.
          </p>
        </div>
      </div>

      <form
        onSubmit={(event) => void handleUpload(event)}
        className="mt-6 rounded-xl border border-[--border] bg-[--surface] p-5 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium text-foreground">
            Empresa
            <select
              value={selectedCompanyId}
              onChange={(event) => void handleCompanyChange(event.target.value)}
              disabled={me?.role !== "ADMIN"}
              className="mt-1 w-full rounded-xl border border-[--border] bg-[--surface-2] px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-60"
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

          <label className="text-sm font-medium text-foreground">
            Mês de referência
            <input
              type="month"
              value={referenceMonth}
              onChange={(event) => setReferenceMonth(event.target.value)}
              className="mt-1 w-full rounded-xl border border-[--border] bg-[--surface-2] px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40"
              required
            />
          </label>

          <label className="text-sm font-medium text-foreground">
            Arquivo XLSX
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="mt-1 w-full rounded-xl border border-[--border] bg-[--surface-2] px-3 py-2.5 text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-1 file:text-sm file:font-medium file:text-brand"
              required
            />
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={!canUpload || isUploading}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {isUploading ? "Processando..." : "Importar XLSX"}
          </button>
          <p className="text-xs text-[--text-muted]">Limite: 10 MB por arquivo</p>
        </div>
      </form>

      {message ? (
        <p className="mt-4 rounded-lg border border-[--border] bg-[--surface-2] px-3 py-2 text-sm text-foreground">
          {message}
        </p>
      ) : null}

      {summary ? (
        <section className="mt-6 rounded-xl border border-[--border] bg-[--surface] p-5 shadow-sm">
          <h2 className="text-base font-semibold text-foreground">Resumo consolidado</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(summary).map(([field, value]) => (
              <article key={field} className="rounded-lg border border-[--border] bg-[--surface-2] px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-[--text-muted]">{field}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {Number(value).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {isLoading ? <p className="mt-6 text-sm text-[--text-muted]">Carregando...</p> : null}

      {!isLoading ? (
        <section className="mt-6 space-y-3">
          {batches.length === 0 ? (
            <p className="text-sm text-[--text-muted]">Nenhum batch importado para a empresa selecionada.</p>
          ) : null}

          {batches.map((batch) => (
            <article
              key={batch.id}
              className={`rounded-xl border bg-[--surface] p-4 shadow-sm transition-colors ${
                selectedBatchId === batch.id
                  ? "border-brand ring-1 ring-brand/30"
                  : "border-[--border]"
              }`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {batch.fileName || "Arquivo sem nome"} — {batch.referenceMonth}
                  </p>
                  <p className="text-xs text-[--text-muted]">{new Date(batch.createdAt).toLocaleString("pt-BR")}</p>
                </div>
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                    batch.status === "DONE"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                      : batch.status === "FAILED"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                  }`}
                >
                  {batch.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-[--text-muted]">
                Linhas processadas: {batch.processedRows} / {batch.totalRows}
              </p>
              {batch.lastError ? (
                <p className="mt-2 text-sm text-red-700 dark:text-red-400">Erro: {batch.lastError}</p>
              ) : null}
              <button
                type="button"
                onClick={() => void handleSelectBatch(batch.id)}
                className="mt-3 rounded-lg border border-[--border] bg-[--surface-2] px-3 py-1.5 text-xs font-medium text-foreground hover:bg-[--border] transition-colors"
              >
                Ver detalhes
              </button>
            </article>
          ))}
        </section>
      ) : null}
    </AppShell>
  );
}
