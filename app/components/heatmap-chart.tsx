"use client";

function heatColor(value: number, maxAbs: number): { bg: string; text: string } {
  if (maxAbs === 0 || value === 0) {
    return { bg: "bg-zinc-100 dark:bg-zinc-700/40", text: "text-zinc-500 dark:text-zinc-400" };
  }
  const ratio = Math.min(Math.abs(value) / maxAbs, 1);
  const bucket = Math.ceil(ratio * 5); // 1–5
  if (value > 0) {
    const classes: Record<number, { bg: string; text: string }> = {
      1: { bg: "bg-emerald-50  dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400" },
      2: { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300" },
      3: { bg: "bg-emerald-200 dark:bg-emerald-800/50", text: "text-emerald-800 dark:text-emerald-200" },
      4: { bg: "bg-emerald-300 dark:bg-emerald-700/60", text: "text-emerald-900 dark:text-emerald-100" },
      5: { bg: "bg-emerald-500 dark:bg-emerald-600",    text: "text-white" },
    };
    return classes[bucket] ?? classes[5]!;
  } else {
    const classes: Record<number, { bg: string; text: string }> = {
      1: { bg: "bg-red-50  dark:bg-red-950/30",  text: "text-red-600 dark:text-red-400" },
      2: { bg: "bg-red-100 dark:bg-red-900/40",  text: "text-red-700 dark:text-red-300" },
      3: { bg: "bg-red-200 dark:bg-red-800/50",  text: "text-red-800 dark:text-red-200" },
      4: { bg: "bg-red-300 dark:bg-red-700/60",  text: "text-red-900 dark:text-red-100" },
      5: { bg: "bg-red-500 dark:bg-red-600",     text: "text-white" },
    };
    return classes[bucket] ?? classes[5]!;
  }
}

function formatShort(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export type HeatmapData = {
  rows: { id: string; label: string }[];
  cols: string[];
  values: number[][]; // values[rowIdx][colIdx]
};

export default function HeatmapChart({
  data,
  title,
  subtitle,
}: {
  data: HeatmapData;
  title?: string;
  subtitle?: string;
}) {
  if (data.rows.length === 0 || data.cols.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
        Sem dados para o heatmap.
      </p>
    );
  }

  const maxAbs = Math.max(
    ...data.values.flatMap((row) => row.map((v) => Math.abs(v))),
    1,
  );

  const colCount = data.cols.length;

  return (
    <div>
      {(title ?? subtitle) && (
        <div className="mb-3">
          {title && <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{title}</p>}
          {subtitle && <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">{subtitle}</p>}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-xs">
          <thead>
            <tr>
              {/* Top-left blank cell */}
              <th className="w-32 border-b border-zinc-200 pb-2 pr-3 text-right text-[10px] font-semibold text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
                Empresa
              </th>
              {data.cols.map((col) => (
                <th
                  key={col}
                  className="border-b border-zinc-200 pb-2 px-1 text-center text-[10px] font-semibold text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
                  style={{ minWidth: `${Math.max(56, Math.floor(320 / colCount))}px` }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, rowIdx) => (
              <tr key={row.id}>
                <td className="py-1 pr-3 text-right text-[11px] font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                  {row.label}
                </td>
                {data.cols.map((col, colIdx) => {
                  const value = data.values[rowIdx]?.[colIdx] ?? 0;
                  const { bg, text } = heatColor(value, maxAbs);
                  return (
                    <td key={col} className="px-0.5 py-0.5">
                      <div
                        className={`flex h-9 items-center justify-center rounded-md text-[11px] font-semibold transition-opacity hover:opacity-80 ${bg} ${text}`}
                        title={`${row.label} · ${col}: R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                      >
                        {value !== 0 ? formatShort(value) : "—"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-end gap-3 text-[10px] text-zinc-400 dark:text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-5 rounded bg-red-400 dark:bg-red-600" />
          Déficit (quanto maior, mais escuro)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-5 rounded bg-emerald-400 dark:bg-emerald-600" />
          Superávit (quanto maior, mais escuro)
        </span>
      </div>
    </div>
  );
}
