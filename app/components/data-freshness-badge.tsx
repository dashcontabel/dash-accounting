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
      <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        Sincronizado
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSync}
      disabled={isSyncing}
      title="Dados desatualizados. Clique para sincronizar."
      className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-950/60"
    >
      <svg
        className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`}
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
      {isSyncing ? "Sincronizando..." : "Desatualizado · Sincronizar"}
    </button>
  );
}
