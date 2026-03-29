"use client";

import { useId, useRef, useEffect, useState, useCallback } from "react";

type Company = { id: string; name: string };

// ── Modal ───────────────────────────────────────────────────────────────────

function CompanyModal({
  companies,
  selected,
  onClose,
  onConfirm,
}: {
  companies: Company[];
  selected: string[];
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  const [draft, setDraft] = useState<string[]>(selected);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const modalId = useId();

  const allSelected = draft.length === companies.length && companies.length > 0;
  const someSelected = draft.length > 0 && !allSelected;
  const checkAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkAllRef.current) checkAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  // Focus search on open
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Close on Escape
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );
  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  function toggleAll() {
    setDraft(allSelected ? [] : companies.map((c) => c.id));
  }

  function toggle(id: string) {
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      aria-modal="true"
      role="dialog"
      aria-labelledby={`${modalId}-title`}
    >
      <div className="flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900" style={{ maxWidth: "min(24rem, calc(100vw - 2rem))" }}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <h2 id={`${modalId}-title`} className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
            Selecionar empresas
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        {companies.length > 6 && (
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
              <svg className="h-3.5 w-3.5 shrink-0 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar empresa..."
                className="w-full bg-transparent text-xs text-zinc-700 placeholder-zinc-400 outline-none dark:text-zinc-200"
              />
            </div>
          </div>
        )}

        {/* Select all + list */}
        <div className="flex flex-col gap-0.5 overflow-y-auto px-3 py-2" style={{ maxHeight: "18rem" }}>
          {search === "" && (
            <>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                <input
                  ref={checkAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded accent-[#0f4c81]"
                />
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Todas as empresas</span>
              </label>
              <div className="mx-2 h-px bg-zinc-100 dark:bg-zinc-800" />
            </>
          )}
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-xs text-zinc-400 dark:text-zinc-500">Nenhuma empresa encontrada.</p>
          ) : (
            filtered.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              >
                <input
                  type="checkbox"
                  checked={draft.includes(c.id)}
                  onChange={() => toggle(c.id)}
                  className="h-4 w-4 shrink-0 rounded accent-[#0f4c81]"
                />
                <span className="min-w-0 wrap-break-word text-xs text-zinc-700 dark:text-zinc-300">{c.name}</span>
              </label>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
            {draft.length === 0
              ? "Nenhuma selecionada"
              : draft.length === companies.length
              ? "Todas selecionadas"
              : `${draft.length} de ${companies.length}`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => { onConfirm(draft); onClose(); }}
              disabled={draft.length === 0}
              className="rounded-lg bg-[#0f4c81] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0d3d68] disabled:opacity-40 dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Trigger summary text ─────────────────────────────────────────────────────

function triggerLabel(companies: Company[], selected: string[]): string {
  if (selected.length === 0) return "Nenhuma empresa selecionada";
  if (selected.length === companies.length) return "Todas as empresas";
  if (selected.length === 1) {
    return companies.find((c) => c.id === selected[0])?.name ?? "1 empresa";
  }
  return `${selected.length} empresas selecionadas`;
}

// ── Main component ───────────────────────────────────────────────────────────

export default function MultiCompanySelect({
  companies,
  selected,
  onChange,
  disabled,
}: {
  companies: Company[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (companies.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
        Nenhuma empresa disponível
      </div>
    );
  }

  if (companies.length === 1) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
        {companies[0]!.name}
      </div>
    );
  }

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-[#0f4c81]/40 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:border-blue-500/40 dark:hover:bg-zinc-700/50"
      >
        <span className="flex min-w-0 items-center gap-2">
          {/* Colored dot indicator */}
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              selected.length === 0
                ? "bg-zinc-300 dark:bg-zinc-600"
                : selected.length === companies.length
                ? "bg-emerald-500"
                : "bg-[#0f4c81] dark:bg-blue-500"
            }`}
          />
          <span className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-200">
            {triggerLabel(companies, selected)}
          </span>
        </span>
        <svg
          className="h-4 w-4 shrink-0 text-zinc-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Modal */}
      {open && (
        <CompanyModal
          companies={companies}
          selected={selected}
          onClose={() => setOpen(false)}
          onConfirm={(ids) => onChange(ids)}
        />
      )}
    </>
  );
}
