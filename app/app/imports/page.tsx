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
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [batchSummaries, setBatchSummaries] = useState<Record<string, SummaryPayload | null>>({});
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canUpload = useMemo(
    () => Boolean(file && selectedCompanyId && referenceMonth && me?.role === "ADMIN"),
    [file, selectedCompanyId, referenceMonth, me?.role],
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

    const resolved =
      data.summary?.dataJson ??
      (data.batch?.totalsJson as { summary?: SummaryPayload } | undefined)?.summary ??
      null;

    setBatchSummaries((prev) => ({ ...prev, [batchId]: resolved }));
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
      const newBatchId = data.batchId ?? null;
      if (newBatchId) {
        setBatchSummaries((prev) => ({ ...prev, [newBatchId]: data.summary ?? null }));
        setExpandedBatchId(newBatchId);
      }
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
    setExpandedBatchId(null);
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

  async function handleToggleBatch(batchId: string) {
    if (expandedBatchId === batchId) {
      setExpandedBatchId(null);
      return;
    }
    setExpandedBatchId(batchId);
    if (!(batchId in batchSummaries)) {
      setLoadingDetailId(batchId);
      await loadBatchDetails(batchId);
      setLoadingDetailId(null);
    }
  }

  async function handleDeleteBatch(batchId: string, label: string) {
    if (!confirm(`Excluir o import "${label}"?\nOs dados do dashboard deste mês também serão removidos.`)) return;

    setDeletingBatchId(batchId);
    setMessage(null);
    try {
      const response = await fetch(`/api/imports/${batchId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setMessage(data.error ?? "Falha ao excluir import.");
        return;
      }
      if (expandedBatchId === batchId) setExpandedBatchId(null);
      setBatchSummaries((prev) => { const next = { ...prev }; delete next[batchId]; return next; });
      await loadBatches(selectedCompanyId);
    } catch {
      setMessage("Falha ao excluir import.");
    } finally {
      setDeletingBatchId(null);
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
          <h1 className="text-2xl font-semibold text-foreground">Importar Balancete XLSX</h1>
          <p className="mt-1 text-sm text-[--text-muted]">
            Upload mensal com mapeamento por conta, idempotência e resumo consolidado.
          </p>
        </div>
      </div>

      {me?.role !== "ADMIN" && (
        <div className="mt-6 rounded-xl border border-[--border] bg-[--surface] p-5 text-sm text-[--text-muted]">
          Apenas administradores podem realizar importações.
        </div>
      )}

      {me?.role === "ADMIN" && (
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
              className="mt-1 w-full rounded-xl border border-[--border] bg-[--surface-2] px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-60 dark:scheme-dark dark:bg-[#1a2540] dark:text-zinc-100 [&_option]:dark:bg-[#1a2540] [&_option]:dark:text-zinc-100"
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
              className="mt-1 w-full rounded-xl border border-[--border] bg-[--surface-2] px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40 dark:scheme-dark dark:bg-[#1a2540] dark:text-zinc-100"
              required
            />
          </label>

          <label className="text-sm font-medium text-foreground">
            Arquivo (XLSX / XLS / CSV)
            <input
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
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
            {isUploading ? "Processando..." : "Importar"}
          </button>
          <p className="text-xs text-[--text-muted]">Limite: 10 MB por arquivo</p>
        </div>
      </form>
      )}

      {message ? (
        <p className="mt-4 rounded-lg border border-[--border] bg-[--surface-2] px-3 py-2 text-sm text-foreground">
          {message}
        </p>
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
                expandedBatchId === batch.id
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
                <div className="flex items-center gap-2">
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
                  {me?.role === "ADMIN" && (
                    <button
                      type="button"
                      disabled={deletingBatchId === batch.id}
                      onClick={() => void handleDeleteBatch(batch.id, `${batch.fileName ?? "import"} (${batch.referenceMonth})`)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-40 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                      title="Excluir import"
                    >
                      {deletingBatchId === batch.id ? (
                        "..."
                      ) : (
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                      Excluir
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-sm text-[--text-muted]">
                Linhas processadas: {batch.processedRows} / {batch.totalRows}
              </p>
              {batch.lastError ? (
                <p className="mt-2 text-sm text-red-700 dark:text-red-400">Erro: {batch.lastError}</p>
              ) : null}
              <button
                type="button"
                onClick={() => void handleToggleBatch(batch.id)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[--border] bg-[--surface-2] px-3 py-1.5 text-xs font-medium text-foreground hover:bg-[--border] transition-colors"
              >
                {expandedBatchId === batch.id ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    Recolher
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Ver detalhes
                  </>
                )}
              </button>

              {expandedBatchId === batch.id && (
                <div className="mt-4 border-t border-[--border] pt-4">
                  {loadingDetailId === batch.id ? (
                    <p className="text-xs text-[--text-muted]">Carregando detalhes...</p>
                  ) : batchSummaries[batch.id] ? (
                    <>
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[--text-muted]">
                        Resumo consolidado
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(batchSummaries[batch.id]!).map(([field, value]) => (
                          <div
                            key={field}
                            className="rounded-lg border border-[--border] bg-[--surface-2] px-3 py-2"
                          >
                            <p className="text-xs uppercase tracking-wide text-[--text-muted]">{field}</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                              {Number(value).toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-[--text-muted]">Nenhum resumo disponível para este import.</p>
                  )}
                </div>
              )}
            </article>
          ))}
        </section>
      ) : null}
    </AppShell>
  );
}
