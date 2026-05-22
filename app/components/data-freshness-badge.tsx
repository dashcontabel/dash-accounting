"use client";

export default function DataFreshnessBadge({
  isStale,
  isSyncing,
  onSync,
}: {
  isStale: boolean;
  isSyncing: boolean;
  onSync: () => void;
}) {
  if (!isStale && !isSyncing) {
    return (
      <button
        type="button"
        onClick={onSync}
        title="Dados atualizados"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[--border] text-emerald-500 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5 dark:hover:bg-emerald-900/20"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSync}
      disabled={isSyncing}
      title={isSyncing ? "Sincronizando..." : "Dados desatualizados. Clique para sincronizar."}
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-950/60"
    >
      <svg
        className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
    </button>
  );
}
