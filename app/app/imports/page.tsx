"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { confirmToast } from "@/app/components/confirm-toast";

import AppShell from "@/app/components/app-shell";
import { markCompanyStale, setActionHint } from "@/lib/dashboard/cache";

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

type BatchFileResult = {
  file: File;
  status: "pending" | "uploading" | "done" | "warning" | "error";
  message: string;
  detectedMonth: string | null;
};

const MAX_BATCH_FILES = 12;

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
  const [fileInputKey, setFileInputKey] = useState(0);

  // Batch import state
  const [batchMode, setBatchMode] = useState(false);
  const [batchFileResults, setBatchFileResults] = useState<BatchFileResult[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchInputKey, setBatchInputKey] = useState(0);

  // List filter + pagination
  const [filterMonth, setFilterMonth] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "DONE" | "FAILED" | "PENDING" | "PROCESSING">("");
  const [filterName, setFilterName] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 8;

  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      if (filterMonth && b.referenceMonth !== filterMonth) return false;
      if (filterStatus && b.status !== filterStatus) return false;
      if (filterName && !(b.fileName ?? "").toLowerCase().includes(filterName.toLowerCase())) return false;
      return true;
    });
  }, [batches, filterMonth, filterStatus, filterName]);

  const totalPages = Math.max(1, Math.ceil(filteredBatches.length / PAGE_SIZE));
  const pagedBatches = filteredBatches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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
    setCurrentPage(1);
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
        toast.error(error instanceof Error ? error.message : "Falha ao carregar pagina.");
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

    setIsUploading(true);
    const uploadToastId = toast.loading("Processando importação...");

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
        toast.error(data.error ?? "Falha no upload.", { id: uploadToastId });
        return;
      }

      if (data.idempotent) {
        toast.warning("Arquivo já importado para este período.", { id: uploadToastId });
      } else {
        toast.success("Importação concluída com sucesso!", { id: uploadToastId });
        markCompanyStale(selectedCompanyId);
        setActionHint(selectedCompanyId, { action: "import", referenceMonth });
      }
      const newBatchId = data.batchId ?? null;
      if (newBatchId) {
        setBatchSummaries((prev) => ({ ...prev, [newBatchId]: data.summary ?? null }));
        setExpandedBatchId(newBatchId);
      }
      // Reset file state and input element so the button unlocks for the next import
      setFile(null);
      setFileInputKey((k) => k + 1);
      await loadBatches(selectedCompanyId);
    } catch {
      toast.error("Falha no upload. Verifique sua conexão e tente novamente.", { id: uploadToastId });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleCompanyChange(companyId: string) {
    setSelectedCompanyId(companyId);
    setExpandedBatchId(null);

    if (companyId) {
      try {
        await loadBatches(companyId);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Falha ao carregar imports.");
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
    if (!await confirmToast(`Excluir o import "${label}"? Os dados do dashboard deste mês também serão removidos.`)) return;

    setDeletingBatchId(batchId);
    const deleteToastId = toast.loading("Excluindo import...");
    try {
      const response = await fetch(`/api/imports/${batchId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        toast.error(data.error ?? "Falha ao excluir import.", { id: deleteToastId });
        return;
      }
      toast.success("Import excluído com sucesso.", { id: deleteToastId });
      const deletedMonth = batches.find((b) => b.id === batchId)?.referenceMonth ?? "";
      markCompanyStale(selectedCompanyId);
      if (deletedMonth) setActionHint(selectedCompanyId, { action: "delete", referenceMonth: deletedMonth });
      if (expandedBatchId === batchId) setExpandedBatchId(null);
      setBatchSummaries((prev) => { const next = { ...prev }; delete next[batchId]; return next; });
      await loadBatches(selectedCompanyId);
    } catch {
      toast.error("Falha ao excluir import.", { id: deleteToastId });
    } finally {
      setDeletingBatchId(null);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function handleBatchUpload() {
    if (isBatchRunning || batchFileResults.length === 0 || !selectedCompanyId) return;

    setIsBatchRunning(true);

    for (let i = 0; i < batchFileResults.length; i++) {
      setBatchFileResults((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "uploading", message: "Processando..." } : r)),
      );

      try {
        const formData = new FormData();
        formData.append("file", batchFileResults[i]!.file);
        formData.append("companyId", selectedCompanyId);
        // No referenceMonth — server auto-detects from file

        const response = await fetch("/api/imports/xlsx", { method: "POST", body: formData });
        const data = (await response.json()) as {
          error?: string;
          idempotent?: boolean;
          batchId?: string;
        };

        if (!response.ok) {
          setBatchFileResults((prev) =>
            prev.map((r, idx) =>
              idx === i ? { ...r, status: "error", message: data.error ?? "Falha no upload." } : r,
            ),
          );
        } else if (data.idempotent) {
          setBatchFileResults((prev) =>
            prev.map((r, idx) =>
              idx === i ? { ...r, status: "warning", message: "Arquivo já importado para este período." } : r,
            ),
          );
        } else {
          setBatchFileResults((prev) =>
            prev.map((r, idx) =>
              idx === i ? { ...r, status: "done", message: "Importado com sucesso." } : r,
            ),
          );
          markCompanyStale(selectedCompanyId);
          const detectedMonth = batchFileResults[i]?.detectedMonth;
          if (detectedMonth) setActionHint(selectedCompanyId, { action: "import", referenceMonth: detectedMonth });
        }
      } catch {
        setBatchFileResults((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: "error", message: "Falha de conexão." } : r,
          ),
        );
      }
    }

    setIsBatchRunning(false);
    await loadBatches(selectedCompanyId);
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
      <div className="mt-6 rounded-xl border border-[--border] bg-[--surface] shadow-sm">
        {/* Mode toggle */}
        <div className="flex border-b border-[--border]">
          <button
            type="button"
            onClick={() => { setBatchMode(false); }}
            className={`flex-1 rounded-tl-xl px-4 py-3 text-sm font-medium transition-colors ${
              !batchMode
                ? "bg-brand/10 text-brand"
                : "text-[--text-muted] hover:bg-[--surface-2]"
            }`}
          >
            Importação simples
          </button>
          <button
            type="button"
            onClick={() => { setBatchMode(true); setBatchFileResults([]); setBatchInputKey((k) => k + 1); }}
            className={`flex-1 rounded-tr-xl px-4 py-3 text-sm font-medium transition-colors ${
              batchMode
                ? "bg-brand/10 text-brand"
                : "text-[--text-muted] hover:bg-[--surface-2]"
            }`}
          >
            Importar em lote (até 12 meses)
          </button>
        </div>

        <div className="p-5">
          {/* ── SINGLE MODE ── */}
          {!batchMode && (
            <form onSubmit={(event) => void handleUpload(event)}>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="text-sm font-medium text-foreground">
                  Empresa
                  <select
                    value={selectedCompanyId}
                    onChange={(event) => void handleCompanyChange(event.target.value)}
                    disabled={me?.role !== "ADMIN"}
                    className="mt-1 w-full rounded-xl border border-[--border] bg-[--surface-2] px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-60 dark:scheme-dark dark:bg-[#1a2540] dark:text-zinc-100 [&_option]:dark:bg-[#1a2540] [&_option]:dark:text-zinc-100"
                  >
                    <option value="" disabled>Selecione</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>{company.name}</option>
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
                    key={fileInputKey}
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

          {/* ── BATCH MODE ── */}
          {batchMode && (
            <div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-foreground">
                  Empresa
                  <select
                    value={selectedCompanyId}
                    onChange={(event) => void handleCompanyChange(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-[--border] bg-[--surface-2] px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-60 dark:scheme-dark dark:bg-[#1a2540] dark:text-zinc-100 [&_option]:dark:bg-[#1a2540] [&_option]:dark:text-zinc-100"
                  >
                    <option value="" disabled>Selecione</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-medium text-foreground">
                  Arquivos (máx. {MAX_BATCH_FILES} — o mês é detectado automaticamente)
                  <input
                    key={batchInputKey}
                    type="file"
                    multiple
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []).slice(0, MAX_BATCH_FILES);
                      setBatchFileResults(
                        files.map((f) => ({ file: f, status: "pending", message: "Aguardando", detectedMonth: null })),
                      );
                    }}
                    className="mt-1 w-full rounded-xl border border-[--border] bg-[--surface-2] px-3 py-2.5 text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-1 file:text-sm file:font-medium file:text-brand"
                  />
                </label>
              </div>

              {batchFileResults.length > 0 && (
                <div className="mt-4">
                  <div className="overflow-hidden rounded-xl border border-[--border]">
                    <table className="w-full text-sm">
                      <thead className="bg-[--surface-2] text-xs font-semibold uppercase tracking-wide text-[--text-muted]">
                        <tr>
                          <th className="px-4 py-2.5 text-left">Arquivo</th>
                          <th className="px-4 py-2.5 text-left">Status</th>
                          <th className="px-4 py-2.5 text-left">Mensagem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[--border]">
                        {batchFileResults.map((r, idx) => (
                          <tr key={idx} className="bg-[--surface]">
                            <td className="max-w-50 truncate px-4 py-2.5 font-medium text-foreground" title={r.file.name}>
                              {r.file.name}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                r.status === "done"      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" :
                                r.status === "error"     ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" :
                                r.status === "warning"   ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" :
                                r.status === "uploading" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" :
                                                           "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                              }`}>
                                {r.status === "pending"   && "Aguardando"}
                                {r.status === "uploading" && "Processando…"}
                                {r.status === "done"      && "Concluído"}
                                {r.status === "warning"   && "Já importado"}
                                {r.status === "error"     && "Erro"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-[--text-muted]">{r.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      disabled={isBatchRunning || !selectedCompanyId || batchFileResults.every((r) => r.status === "done")}
                      onClick={() => void handleBatchUpload()}
                      className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
                    >
                      {isBatchRunning ? "Importando..." : "Importar lote"}
                    </button>
                    <button
                      type="button"
                      disabled={isBatchRunning}
                      onClick={() => { setBatchFileResults([]); setBatchInputKey((k) => k + 1); }}
                      className="rounded-xl border border-[--border] px-4 py-2 text-sm font-medium text-[--text-muted] hover:bg-[--surface-2] disabled:opacity-40"
                    >
                      Limpar
                    </button>
                    <p className="text-xs text-[--text-muted]">Limite: 10 MB por arquivo</p>
                  </div>
                </div>
              )}

              {batchFileResults.length === 0 && (
                <p className="mt-3 text-xs text-[--text-muted]">
                  Selecione até {MAX_BATCH_FILES} arquivos. O mês de referência será detectado automaticamente a partir do cabeçalho de cada balancete.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {isLoading ? <p className="mt-6 text-sm text-[--text-muted]">Carregando...</p> : null}

      {!isLoading ? (
        <section className="mt-6 space-y-3">
          {/* ── Filters ── */}
          {batches.length > 0 && (
            <div className="flex flex-wrap gap-2 rounded-xl border border-[--border] bg-[--surface] p-3">
              <input
                type="month"
                value={filterMonth}
                onChange={(e) => { setFilterMonth(e.target.value); setCurrentPage(1); }}
                className="rounded-lg border border-[--border] bg-[--surface-2] px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40 dark:scheme-dark dark:bg-[#1a2540] dark:text-zinc-100"
                title="Filtrar por mês"
              />
              <select
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value as typeof filterStatus); setCurrentPage(1); }}
                className="rounded-lg border border-[--border] bg-[--surface-2] px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40 dark:scheme-dark dark:bg-[#1a2540] dark:text-zinc-100"
              >
                <option value="">Todos os status</option>
                <option value="DONE">Concluído</option>
                <option value="FAILED">Falha</option>
                <option value="PROCESSING">Processando</option>
                <option value="PENDING">Pendente</option>
              </select>
              <input
                type="text"
                placeholder="Buscar por nome do arquivo..."
                value={filterName}
                onChange={(e) => { setFilterName(e.target.value); setCurrentPage(1); }}
                className="min-w-48 flex-1 rounded-lg border border-[--border] bg-[--surface-2] px-3 py-1.5 text-sm text-foreground placeholder-[--text-muted] focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
              {(filterMonth || filterStatus || filterName) && (
                <button
                  type="button"
                  onClick={() => { setFilterMonth(""); setFilterStatus(""); setFilterName(""); setCurrentPage(1); }}
                  className="rounded-lg border border-[--border] px-3 py-1.5 text-xs text-[--text-muted] hover:bg-[--surface-2]"
                >
                  Limpar filtros
                </button>
              )}
              <span className="ml-auto self-center text-xs text-[--text-muted]">
                {filteredBatches.length} de {batches.length} registros
              </span>
            </div>
          )}

          {filteredBatches.length === 0 ? (
            <p className="text-sm text-[--text-muted]">
              {batches.length === 0 ? "Nenhum batch importado para a empresa selecionada." : "Nenhum resultado para os filtros aplicados."}
            </p>
          ) : null}

          {pagedBatches.map((batch) => (
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

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="rounded-lg border border-[--border] px-3 py-1.5 text-xs font-medium text-[--text-muted] hover:bg-[--surface-2] disabled:opacity-40"
              >
                ← Anterior
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCurrentPage(p)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    p === currentPage
                      ? "border-brand bg-brand text-white"
                      : "border-[--border] text-[--text-muted] hover:bg-[--surface-2]"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="rounded-lg border border-[--border] px-3 py-1.5 text-xs font-medium text-[--text-muted] hover:bg-[--surface-2] disabled:opacity-40"
              >
                Próxima →
              </button>
            </div>
          )}
        </section>
      ) : null}
    </AppShell>
  );
}
