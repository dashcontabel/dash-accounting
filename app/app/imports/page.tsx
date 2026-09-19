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
  sourceType: "XLSX" | "RAZAO" | "XLSX_CONSOLIDATED";
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

const MAX_BATCH_FILES = 24;
const FILE_ACCEPT = ".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv";

type UploadResponse = {
  error?: string;
  idempotent?: boolean;
  batchId?: string;
  summary?: SummaryPayload | null;
  months?: string[];
  results?: Array<{ referenceMonth: string; batchId: string; idempotent: boolean }>;
};

function formatFileSize(size: number) {
  return size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`;
}

function FileDropzone({
  files,
  multiple,
  inputKey,
  onFiles,
  disabled,
}: {
  files: File[];
  multiple: boolean;
  inputKey: number;
  onFiles: (files: File[]) => void;
  disabled: boolean;
}) {
  return (
    <label
      className={`relative flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-6 text-center transition-colors focus-within:ring-2 focus-within:ring-blue-400/40 ${
        files.length > 0
          ? "border-blue-400 bg-blue-50/70 dark:border-blue-700 dark:bg-blue-950/20"
          : "border-[--border] bg-[--surface-2] hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
      } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        if (!disabled) onFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <input
        key={inputKey}
        type="file"
        multiple={multiple}
        accept={FILE_ACCEPT}
        disabled={disabled}
        aria-label={multiple ? "Selecionar arquivos para importação em lote" : "Selecionar arquivo para importação"}
        onChange={(event) => onFiles(Array.from(event.target.files ?? []))}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
      />
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-[#0f4c81] dark:bg-blue-900/40 dark:text-blue-300">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 16.5V19a2 2 0 002 2h12a2 2 0 002-2v-2.5" />
        </svg>
      </span>
      <span className="max-w-full break-words text-sm font-semibold text-foreground">
        {files.length === 0
          ? multiple ? "Arraste os arquivos ou clique para selecionar" : "Arraste o arquivo ou clique para selecionar"
          : multiple ? `${files.length} arquivo${files.length === 1 ? "" : "s"} selecionado${files.length === 1 ? "" : "s"}` : files[0]!.name}
      </span>
      <span className="mt-1 text-xs text-[--text-muted]">
        {files.length === 1 ? formatFileSize(files[0]!.size) : "XLSX, XLS ou CSV · até 10 MB por arquivo"}
      </span>
    </label>
  );
}

function sourceLabel(sourceType: ImportBatch["sourceType"]) {
  return sourceType === "RAZAO" ? "Razão" : sourceType === "XLSX_CONSOLIDATED" ? "Balancete consolidado" : "Balancete";
}

function statusLabel(status: ImportBatch["status"]) {
  return status === "DONE" ? "Concluído" : status === "FAILED" ? "Falhou" : status === "PROCESSING" ? "Processando" : "Pendente";
}

export default function ImportsPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeUser | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [referenceMonth, setReferenceMonth] = useState("");
  const [periodMode, setPeriodMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [batchSummaries, setBatchSummaries] = useState<Record<string, SummaryPayload | null>>({});
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

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
  const completedCount = batches.filter((batch) => batch.status === "DONE").length;

  // All currently-visible (paged) ids selected?
  const allPageSelected = pagedBatches.length > 0 && pagedBatches.every((b) => selectedIds.has(b.id));
  const someSelected = selectedIds.size > 0;

  const canUpload = useMemo(
    () => Boolean(file && selectedCompanyId && (periodMode === "AUTO" || referenceMonth) && me?.role === "ADMIN"),
    [file, selectedCompanyId, periodMode, referenceMonth, me?.role],
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
    return data.batches;
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
    setUploadError(null);
    const uploadToastId = toast.loading("Processando importação...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("companyId", selectedCompanyId);
      if (periodMode === "MANUAL") formData.append("referenceMonth", referenceMonth);

      const response = await fetch("/api/imports/xlsx", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as UploadResponse;

      if (!response.ok) {
        const error = data.error ?? "Falha no upload.";
        setUploadError(error);
        toast.error(error, { id: uploadToastId });
        return;
      }

      const isIdempotent = data.idempotent || (data.results?.length ? data.results.every((result) => result.idempotent) : false);
      const newBatchId = data.batchId ?? data.results?.at(-1)?.batchId ?? null;
      if (isIdempotent) {
        markCompanyStale(selectedCompanyId);
        toast.warning("Arquivo já importado para este período.", { id: uploadToastId });
      } else {
        const count = data.results ? data.results.filter((result) => !result.idempotent).length : data.months?.length ?? 1;
        toast.success(count > 1 ? `${count} competências importadas com sucesso.` : "Importação concluída com sucesso!", { id: uploadToastId });
        markCompanyStale(selectedCompanyId);
      }
      if (newBatchId) {
        setExpandedBatchId(newBatchId);
        if (data.summary !== undefined) {
          setBatchSummaries((prev) => ({ ...prev, [newBatchId]: data.summary ?? null }));
        } else {
          try {
            await loadBatchDetails(newBatchId);
          } catch {
            toast.warning("Importação concluída, mas os detalhes não puderam ser carregados.");
          }
        }
      }
      // Reset file state and input element so the button unlocks for the next import
      setFile(null);
      setFileInputKey((k) => k + 1);
      let refreshed: ImportBatch[] | undefined;
      try {
        refreshed = await loadBatches(selectedCompanyId);
      } catch {
        toast.warning("Importação concluída, mas o histórico não pôde ser atualizado.");
      }
      const importedMonth = data.results?.at(-1)?.referenceMonth
        ?? refreshed?.find((batch) => batch.id === newBatchId)?.referenceMonth
        ?? (periodMode === "MANUAL" ? referenceMonth : undefined);
      if (!isIdempotent && importedMonth) {
        setActionHint(selectedCompanyId, { action: "import", referenceMonth: importedMonth });
      }
    } catch {
      setUploadError("Não foi possível concluir a importação. Verifique a conexão e tente novamente.");
      toast.error("Falha no upload. Verifique sua conexão e tente novamente.", { id: uploadToastId });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleCompanyChange(companyId: string) {
    setSelectedCompanyId(companyId);
    setFile(null);
    setFileInputKey((key) => key + 1);
    setUploadError(null);
    setBatchFileResults([]);
    setBatchInputKey((key) => key + 1);
    setSelectedIds(new Set());
    setExpandedBatchId(null);
    setFilterMonth("");
    setFilterStatus("");
    setFilterName("");
    setIsLoading(true);
    try {
      await loadBatches(companyId);
    } catch {
      setBatches([]);
      toast.error("Não foi possível carregar o histórico desta empresa.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleBatch(batchId: string) {
    if (expandedBatchId === batchId) {
      setExpandedBatchId(null);
      return;
    }
    setExpandedBatchId(batchId);
    if (!(batchId in batchSummaries) || batchSummaries[batchId] === null) {
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
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(batchId); return next; });
      await loadBatches(selectedCompanyId);
    } catch {
      toast.error("Falha ao excluir import.", { id: deleteToastId });
    } finally {
      setDeletingBatchId(null);
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!await confirmToast(`Excluir ${count} import${count > 1 ? "s" : ""} selecionado${count > 1 ? "s" : ""}? Os dados do dashboard dos meses afetados também serão removidos.`)) return;

    setIsBulkDeleting(true);
    const toastId = toast.loading(`Excluindo ${count} import${count > 1 ? "s" : ""}...`);
    try {
      const response = await fetch("/api/imports/bulk-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const data = (await response.json()) as { deleted?: number; failed?: string[]; error?: string };
      if (!response.ok) {
        toast.error(data.error ?? "Falha ao excluir imports.", { id: toastId });
        return;
      }
      const { deleted = 0, failed = [] } = data;
      if (failed.length > 0) {
        toast.warning(`${deleted} excluído${deleted !== 1 ? "s" : ""}, ${failed.length} falharam.`, { id: toastId });
      } else {
        toast.success(`${deleted} import${deleted !== 1 ? "s" : ""} excluído${deleted !== 1 ? "s" : ""} com sucesso.`, { id: toastId });
      }
      markCompanyStale(selectedCompanyId);
      setSelectedIds(new Set(failed)); // keep only the ones that failed
      setBatchSummaries((prev) => {
        const next = { ...prev };
        for (const id of selectedIds) if (!failed.includes(id)) delete next[id];
        return next;
      });
      if (expandedBatchId && !failed.includes(expandedBatchId) && selectedIds.has(expandedBatchId)) {
        setExpandedBatchId(null);
      }
      await loadBatches(selectedCompanyId);
    } catch {
      toast.error("Falha ao excluir imports.", { id: toastId });
    } finally {
      setIsBulkDeleting(false);
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
      if (batchFileResults[i]!.status === "done" || batchFileResults[i]!.status === "warning") continue;
      setBatchFileResults((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "uploading", message: "Processando..." } : r)),
      );

      try {
        const formData = new FormData();
        formData.append("file", batchFileResults[i]!.file);
        formData.append("companyId", selectedCompanyId);
        // No referenceMonth — server auto-detects from file

        const response = await fetch("/api/imports/xlsx", { method: "POST", body: formData });
        const data = (await response.json()) as UploadResponse;
        const isIdempotent = data.idempotent || (data.results?.length ? data.results.every((result) => result.idempotent) : false);
        const detectedMonth = data.results?.at(-1)?.referenceMonth ?? data.months?.at(-1) ?? null;

        if (!response.ok) {
          setBatchFileResults((prev) =>
            prev.map((r, idx) =>
              idx === i ? { ...r, status: "error", message: data.error ?? "Falha no upload." } : r,
            ),
          );
        } else if (isIdempotent) {
          setBatchFileResults((prev) =>
            prev.map((r, idx) =>
              idx === i ? { ...r, status: "warning", message: "Arquivo já importado para este período.", detectedMonth } : r,
            ),
          );
        } else {
          const count = data.results ? data.results.filter((result) => !result.idempotent).length : data.months?.length ?? 1;
          setBatchFileResults((prev) =>
            prev.map((r, idx) =>
              idx === i ? { ...r, status: "done", message: count > 1 ? `${count} competências importadas.` : "Importado com sucesso.", detectedMonth } : r,
            ),
          );
          markCompanyStale(selectedCompanyId);
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
    try {
      await loadBatches(selectedCompanyId);
    } catch {
      toast.warning("Lote processado, mas o histórico não pôde ser atualizado.");
    }
  }

  return (
    <AppShell role={me?.role ?? null} email={me?.email ?? null} onLogout={handleLogout}>
      <div className="relative overflow-hidden rounded-2xl border border-blue-200/70 bg-gradient-to-br from-blue-50 via-white to-sky-50 px-5 py-6 dark:border-blue-900/50 dark:from-[#102540] dark:via-[#111b2b] dark:to-[#112133] sm:px-7">
        <span aria-hidden="true" className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-blue-300/20 blur-3xl dark:bg-blue-500/10" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0f4c81] dark:text-blue-300">Dados contábeis</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Central de importações</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[--text-muted]">
              Envie balancetes e razões, acompanhe cada competência e consulte o histórico da empresa.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full border border-blue-200/80 bg-white/80 px-3 py-1.5 text-[#0f4c81] dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">XLSX · XLS · CSV</span>
            <span className="rounded-full border border-blue-200/80 bg-white/80 px-3 py-1.5 text-[#0f4c81] dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">10 MB por arquivo</span>
          </div>
        </div>
      </div>

      {me?.role !== "ADMIN" && (
        <div className="mt-6 rounded-xl border border-[--border] bg-[--surface] p-5 text-sm text-[--text-muted]">
          Apenas administradores podem realizar importações.
        </div>
      )}

      {me?.role === "ADMIN" && (
      <section className="mt-5 overflow-hidden rounded-2xl border border-[--border] bg-[--surface] shadow-sm">
        <div className="flex flex-col gap-4 border-b border-[--border] px-4 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0f4c81] dark:text-blue-300">Nova importação</p>
            <h2 className="mt-1 text-lg font-bold text-foreground">Prepare os arquivos</h2>
            <p className="mt-0.5 text-xs text-[--text-muted]">Escolha a empresa, confira o período e envie os arquivos.</p>
          </div>
          <div role="tablist" aria-label="Modo de importação" className="grid grid-cols-2 gap-1 rounded-xl bg-[--surface-2] p-1 lg:min-w-80">
          <button
            type="button"
            role="tab"
            aria-selected={!batchMode}
            disabled={isUploading || isBatchRunning}
            onClick={() => setBatchMode(false)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
              !batchMode
                ? "bg-[--surface] text-[#0f4c81] shadow-sm dark:text-blue-300"
                : "text-[--text-muted] hover:text-foreground"
            }`}
          >
            Um arquivo
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={batchMode}
            disabled={isUploading || isBatchRunning}
            onClick={() => setBatchMode(true)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
              batchMode
                ? "bg-[--surface] text-[#0f4c81] shadow-sm dark:text-blue-300"
                : "text-[--text-muted] hover:text-foreground"
            }`}
          >
            Lote · até 24
          </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {/* ── SINGLE MODE ── */}
          {!batchMode && (
            <form onSubmit={(event) => void handleUpload(event)} className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-8">
                <div className="space-y-5">
                  <div>
                    <p className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs text-[#0f4c81] dark:bg-blue-900/40 dark:text-blue-300">1</span> Destino e competência</p>
                    <label className="block text-xs font-semibold text-[--text-muted]">
                      Empresa
                      <select
                        value={selectedCompanyId}
                        disabled={isLoading || isUploading || isBatchRunning}
                        onChange={(event) => void handleCompanyChange(event.target.value)}
                        className="mt-1.5 h-11 w-full rounded-xl border border-[--border] bg-[--surface-2] px-3 text-sm font-medium text-foreground outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:scheme-dark"
                      >
                        <option value="" disabled>Selecione uma empresa</option>
                        {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                      </select>
                    </label>
                  </div>
                  <fieldset>
                    <legend className="text-xs font-semibold text-[--text-muted]">Mês de referência</legend>
                    <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                      <label className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${periodMode === "AUTO" ? "border-blue-400 bg-blue-50 text-[#0f4c81] dark:bg-blue-950/30 dark:text-blue-300" : "border-[--border] text-[--text-muted]"}`}>
                        <input type="radio" name="periodMode" checked={periodMode === "AUTO"} onChange={() => setPeriodMode("AUTO")} className="accent-[#0f4c81]" /> Detectar no arquivo
                      </label>
                      <label className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${periodMode === "MANUAL" ? "border-blue-400 bg-blue-50 text-[#0f4c81] dark:bg-blue-950/30 dark:text-blue-300" : "border-[--border] text-[--text-muted]"}`}>
                        <input type="radio" name="periodMode" checked={periodMode === "MANUAL"} onChange={() => setPeriodMode("MANUAL")} className="accent-[#0f4c81]" /> Informar manualmente
                      </label>
                    </div>
                    {periodMode === "MANUAL" ? (
                      <input
                        type="month"
                        aria-label="Mês de referência manual"
                        value={referenceMonth}
                        onChange={(event) => setReferenceMonth(event.target.value)}
                        required
                        className="mt-3 h-11 w-full rounded-xl border border-[--border] bg-[--surface-2] px-3 text-sm text-foreground outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:scheme-dark"
                      />
                    ) : (
                      <p className="mt-2 text-xs leading-5 text-[--text-muted]">Usaremos o período do cabeçalho. Em balancetes acumulados, vale o último mês informado no arquivo.</p>
                    )}
                  </fieldset>
                </div>
                <div>
                  <p className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs text-[#0f4c81] dark:bg-blue-900/40 dark:text-blue-300">2</span> Selecione o arquivo</p>
                  <FileDropzone files={file ? [file] : []} multiple={false} inputKey={fileInputKey} disabled={isUploading} onFiles={(files) => { setFile(files[0] ?? null); setUploadError(null); }} />
                  {file && <button type="button" onClick={() => { setFile(null); setFileInputKey((key) => key + 1); }} className="mt-2 text-xs font-semibold text-[--text-muted] hover:text-foreground">Remover arquivo</button>}
                </div>
              </div>

              {uploadError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">{uploadError}</p>}
              <div className="flex flex-col gap-3 border-t border-[--border] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[--text-muted]">{file ? `${file.name} · ${formatFileSize(file.size)}` : "Selecione um arquivo para iniciar a importação."}</p>
                <button type="submit" disabled={!canUpload || isUploading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0f4c81] px-6 text-sm font-bold text-white shadow-sm transition hover:bg-[#0c3d68] disabled:cursor-not-allowed disabled:opacity-45">
                  {isUploading ? "Processando importação..." : "Importar arquivo"}
                  {!isUploading && <span aria-hidden="true">→</span>}
                </button>
              </div>
            </form>
          )}

          {/* ── BATCH MODE ── */}
          {batchMode && (
            <div className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-8">
                <div>
                  <p className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs text-[#0f4c81] dark:bg-blue-900/40 dark:text-blue-300">1</span> Escolha a empresa</p>
                  <label className="block text-xs font-semibold text-[--text-muted]">
                    Empresa
                    <select value={selectedCompanyId} disabled={isLoading || isUploading || isBatchRunning} onChange={(event) => void handleCompanyChange(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[--border] bg-[--surface-2] px-3 text-sm font-medium text-foreground outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:scheme-dark">
                      <option value="" disabled>Selecione uma empresa</option>
                      {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                    </select>
                  </label>
                  <p className="mt-3 text-xs leading-5 text-[--text-muted]">Cada arquivo é processado em sequência. O período de cada balancete ou razão é detectado automaticamente.</p>
                </div>
                <div>
                  <p className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs text-[#0f4c81] dark:bg-blue-900/40 dark:text-blue-300">2</span> Selecione até {MAX_BATCH_FILES} arquivos</p>
                  <FileDropzone files={batchFileResults.map((result) => result.file)} multiple inputKey={batchInputKey} disabled={isBatchRunning} onFiles={(files) => {
                    if (files.length > MAX_BATCH_FILES) toast.warning(`Apenas os primeiros ${MAX_BATCH_FILES} arquivos foram selecionados.`);
                    setBatchFileResults(files.slice(0, MAX_BATCH_FILES).map((selectedFile) => ({ file: selectedFile, status: "pending", message: "Aguardando", detectedMonth: null })));
                  }} />
                </div>
              </div>

              {batchFileResults.length > 0 && (
                <div className="border-t border-[--border] pt-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-foreground">Fila de arquivos <span className="ml-1 text-xs font-medium text-[--text-muted]">({batchFileResults.length})</span></p>
                    <button type="button" disabled={isBatchRunning} onClick={() => { setBatchFileResults([]); setBatchInputKey((key) => key + 1); }} className="text-xs font-semibold text-[--text-muted] hover:text-foreground disabled:opacity-40">Limpar fila</button>
                  </div>
                  <div className="max-h-64 divide-y divide-[--border] overflow-y-auto rounded-xl border border-[--border] bg-[--surface-2]">
                    {batchFileResults.map((result, index) => (
                      <div key={`${result.file.name}-${index}`} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground" title={result.file.name}>{result.file.name}</p>
                          <p className="mt-0.5 text-xs text-[--text-muted]">{formatFileSize(result.file.size)} · {result.message}</p>
                        </div>
                        <span className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          result.status === "done" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" :
                          result.status === "error" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" :
                          result.status === "warning" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" :
                          result.status === "uploading" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" :
                          "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                        }`}>
                          {result.status === "pending" ? "Aguardando" : result.status === "uploading" ? "Processando" : result.status === "done" ? "Concluído" : result.status === "warning" ? "Já importado" : "Erro"}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-col gap-3 border-t border-[--border] pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-[--text-muted]">Processamento sequencial · período detectado por arquivo</p>
                    <button
                      type="button"
                      disabled={isBatchRunning || !selectedCompanyId || batchFileResults.every((result) => result.status === "done" || result.status === "warning")}
                      onClick={() => void handleBatchUpload()}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0f4c81] px-6 text-sm font-bold text-white shadow-sm transition hover:bg-[#0c3d68] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {isBatchRunning ? "Processando lote..." : "Importar lote"}
                      {!isBatchRunning && <span aria-hidden="true">→</span>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
      )}

      {isLoading ? <p className="mt-6 rounded-2xl border border-[--border] bg-[--surface] px-5 py-8 text-sm text-[--text-muted]">Carregando histórico...</p> : null}

      {!isLoading ? (
        <section className="mt-5 overflow-hidden rounded-2xl border border-[--border] bg-[--surface] shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[--border] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0f4c81] dark:text-blue-300">Acompanhamento</p>
              <h2 className="mt-1 text-lg font-bold text-foreground">Histórico de importações</h2>
              <p className="mt-0.5 text-xs text-[--text-muted]">Consulte arquivos, competências e resultados da empresa selecionada.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-[--surface-2] px-3 py-1.5 text-[--text-muted]">{batches.length} registro{batches.length === 1 ? "" : "s"}</span>
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">{completedCount} concluído{completedCount === 1 ? "" : "s"}</span>
            </div>
          </div>
          <div className="space-y-4 p-4 sm:p-6">
          {/* ── Filters ── */}
          {batches.length > 0 && (
          <div className="grid gap-3 rounded-xl border border-[--border] bg-[--surface-2] p-3 sm:grid-cols-[minmax(0,1fr)_10rem_11rem] sm:items-end">
            <label className="block text-[11px] font-semibold text-[--text-muted] sm:order-1">
              Buscar arquivo
              <input
                type="search"
                placeholder="Nome do arquivo..."
                value={filterName}
                onChange={(e) => { setFilterName(e.target.value); setCurrentPage(1); }}
                className="mt-1.5 h-10 w-full rounded-lg border border-[--border] bg-[--surface] px-3 text-sm text-foreground outline-none placeholder:text-[--text-muted] focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
              />
            </label>
            <label className="block text-[11px] font-semibold text-[--text-muted] sm:order-2">
              Competência
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => { setFilterMonth(e.target.value); setCurrentPage(1); }}
              className="mt-1.5 h-10 w-full rounded-lg border border-[--border] bg-[--surface] px-3 text-sm text-foreground outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:scheme-dark"
            />
            </label>
            <label className="block text-[11px] font-semibold text-[--text-muted] sm:order-3">
              Status
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value as typeof filterStatus); setCurrentPage(1); }}
              className="mt-1.5 h-10 w-full rounded-lg border border-[--border] bg-[--surface] px-3 text-sm text-foreground outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:scheme-dark"
            >
              <option value="">Todos os status</option>
              <option value="DONE">Concluído</option>
              <option value="FAILED">Falha</option>
              <option value="PROCESSING">Processando</option>
              <option value="PENDING">Pendente</option>
            </select>
            </label>
            {(filterMonth || filterStatus || filterName) && (
              <button
                type="button"
                onClick={() => { setFilterMonth(""); setFilterStatus(""); setFilterName(""); setCurrentPage(1); }}
                className="text-left text-xs font-semibold text-[#0f4c81] hover:underline dark:text-blue-300 sm:col-span-3 sm:order-4"
              >
                Limpar filtros
              </button>
            )}
          </div>
          )}

          {/* ── Bulk action bar ── */}
          {me?.role === "ADMIN" && filteredBatches.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[--border] bg-[--surface-2] px-3 py-2.5">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[--text-muted] select-none">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds((prev) => { const next = new Set(prev); pagedBatches.forEach((b) => next.add(b.id)); return next; });
                    } else {
                      setSelectedIds((prev) => { const next = new Set(prev); pagedBatches.forEach((b) => next.delete(b.id)); return next; });
                    }
                  }}
                  className="h-4 w-4 rounded accent-[#0f4c81]"
                />
                Selecionar página
              </label>
              {someSelected && (
                <>
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-[#0f4c81] dark:bg-blue-900/30 dark:text-blue-300">{selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs text-[--text-muted] underline hover:text-foreground"
                  >
                    Limpar seleção
                  </button>
                  <button
                    type="button"
                    disabled={isBulkDeleting}
                    onClick={() => void handleBulkDelete()}
                    className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-40 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                  >
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {isBulkDeleting ? "Excluindo..." : `Excluir ${selectedIds.size}`}
                  </button>
                </>
              )}
            </div>
          )}

          {filteredBatches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[--border] bg-[--surface-2] px-5 py-10 text-center">
              <p className="text-sm font-semibold text-foreground">{batches.length === 0 ? "Nenhuma importação registrada" : "Nenhum resultado encontrado"}</p>
              <p className="mt-1 text-xs text-[--text-muted]">{batches.length === 0 ? "Os arquivos enviados para esta empresa aparecerão aqui." : "Ajuste os filtros para consultar outros arquivos."}</p>
            </div>
          ) : null}

          {filteredBatches.length > 0 && (
            <div className="divide-y divide-[--border] overflow-hidden rounded-xl border border-[--border]">
              {pagedBatches.map((batch) => (
                <article key={batch.id} className={`px-3 py-3.5 transition-colors sm:px-4 ${selectedIds.has(batch.id) ? "bg-blue-50/70 dark:bg-blue-950/20" : "bg-[--surface] hover:bg-[--surface-2]"}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      {me?.role === "ADMIN" && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(batch.id)}
                          onChange={(event) => setSelectedIds((previous) => {
                            const next = new Set(previous);
                            if (event.target.checked) next.add(batch.id); else next.delete(batch.id);
                            return next;
                          })}
                          className="mt-3 h-4 w-4 shrink-0 rounded accent-[#0f4c81]"
                          aria-label={`Selecionar import ${batch.fileName ?? batch.id}`}
                        />
                      )}
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${batch.sourceType === "RAZAO" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" : "bg-blue-100 text-[#0f4c81] dark:bg-blue-900/30 dark:text-blue-300"}`}>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l4 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zm7 0v5h4M9 12h6M9 16h6" /></svg>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="max-w-full truncate text-sm font-bold text-foreground" title={batch.fileName ?? "Arquivo sem nome"}>{batch.fileName || "Arquivo sem nome"}</p>
                          <span className="rounded-md bg-[--surface-2] px-2 py-0.5 text-[11px] font-bold tabular-nums text-[--text-muted]">{batch.referenceMonth}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${batch.status === "DONE" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : batch.status === "FAILED" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"}`}>{statusLabel(batch.status)}</span>
                        </div>
                        <p className="mt-1 text-xs text-[--text-muted]">{sourceLabel(batch.sourceType)} · {new Date(batch.createdAt).toLocaleString("pt-BR")} · {batch.processedRows} / {batch.totalRows} linhas</p>
                        {batch.lastError && <p className="mt-1.5 text-xs font-medium text-red-700 dark:text-red-300">{batch.lastError}</p>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 pl-7 sm:pl-0">
                      <button type="button" aria-expanded={expandedBatchId === batch.id} onClick={() => void handleToggleBatch(batch.id)} className="rounded-lg border border-[--border] px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-[--surface-2]">
                        {expandedBatchId === batch.id ? "Recolher" : "Ver detalhes"}
                      </button>
                      {me?.role === "ADMIN" && (
                        <button type="button" disabled={deletingBatchId === batch.id} onClick={() => void handleDeleteBatch(batch.id, `${batch.fileName ?? "import"} (${batch.referenceMonth})`)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-40 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30">
                          {deletingBatchId === batch.id ? "Excluindo..." : "Excluir"}
                        </button>
                      )}
                    </div>
                  </div>
                  {expandedBatchId === batch.id && (
                    <div id={`import-details-${batch.id}`} className="mt-4 border-t border-[--border] pt-4">
                      {loadingDetailId === batch.id ? (
                        <p className="text-xs text-[--text-muted]">Carregando detalhes...</p>
                      ) : batchSummaries[batch.id] ? (
                        <>
                          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[--text-muted]">Resumo consolidado</p>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {Object.entries(batchSummaries[batch.id]!).map(([field, value]) => (
                              <div key={field} className="rounded-lg border border-[--border] bg-[--surface-2] px-3 py-2">
                                <p className="text-xs uppercase tracking-wide text-[--text-muted]">{field}</p>
                                <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
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
            </div>
          )}

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-xs text-[--text-muted]">Página {currentPage} de {totalPages}</p>
              <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="rounded-lg border border-[--border] px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-[--surface-2] disabled:opacity-40"
              >
                ← Anterior
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="rounded-lg border border-[--border] px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-[--surface-2] disabled:opacity-40"
              >
                Próxima →
              </button>
              </div>
            </div>
          )}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
