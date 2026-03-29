"use client";

import { useId, useRef, useEffect } from "react";

type Company = { id: string; name: string };

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
  const id = useId();
  const allSelected = companies.length > 0 && selected.length === companies.length;
  const someSelected = selected.length > 0 && !allSelected;
  const checkAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkAllRef.current) {
      checkAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  function toggleAll() {
    onChange(allSelected ? [] : companies.map((c) => c.id));
  }

  function toggle(companyId: string) {
    onChange(
      selected.includes(companyId)
        ? selected.filter((cid) => cid !== companyId)
        : [...selected, companyId],
    );
  }

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
    <div>
      <div className="flex max-h-44 flex-col gap-0.5 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-600 dark:bg-zinc-800">
        {/* Select all */}
        <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-700/50">
          <input
            ref={checkAllRef}
            type="checkbox"
            id={`${id}-all`}
            checked={allSelected}
            onChange={toggleAll}
            disabled={disabled}
            className="h-3.5 w-3.5 rounded accent-[#0f4c81]"
          />
          Todas as empresas
        </label>
        <div className="my-0.5 h-px bg-zinc-100 dark:bg-zinc-700" />
        {companies.map((c) => (
          <label
            key={c.id}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700/50"
          >
            <input
              type="checkbox"
              checked={selected.includes(c.id)}
              onChange={() => toggle(c.id)}
              disabled={disabled}
              className="h-3.5 w-3.5 rounded accent-[#0f4c81]"
            />
            {c.name}
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
          {selected.length === 1
            ? "1 empresa selecionada"
            : `${selected.length} empresas selecionadas`}
        </p>
      )}
    </div>
  );
}
