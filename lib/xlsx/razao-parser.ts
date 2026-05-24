import { read, utils } from "xlsx";

import type { NormalizedValueColumn, ParsedAccountRow } from "./parser";

// ─── Fixed column indices (always the same regardless of format) ─────────────
const COL_DATE = 0;               // Excel serial date
const COL_LOT = 1;                // Número (lote)
const COL_DESCRIPTION = 2;        // Histórico (description text / also "SALDO ANTERIOR" marker)

// ─── Variable column layout ───────────────────────────────────────────────────
// Each column is located by its header label, not by a fixed index.
// Fallbacks are derived positionally only when the label is not found.
//
// Known layouts (for reference):
//   "SEM CC" (14 cols): Cta.C.Part.=6, Débito=7, Crédito=8, Saldo-Exercício=12
//   "COM CC" (11 cols): Cta.C.Part.=5, Débito=6, Crédito=7, Saldo-Exercício=9

type ColumnLayout = {
  counterpartCode: number;
  debit: number;
  credit: number;
  yearBalance: number;
};

/**
 * Detect column positions by scanning the header row that contains "Débito".
 * Every column is resolved by its own label — no positional assumptions are
 * made about the total number of columns. Falls back gracefully when a label
 * is not found (using the most common known position as default).
 */
function detectColumnLayout(rows: string[][]): ColumnLayout {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i]!;
    const debitIdx = row.findIndex((c) => normalizeText(c) === "debito");
    if (debitIdx < 0) continue;

    // Resolve each column independently by label
    const creditIdx    = row.findIndex((c) => normalizeText(c) === "credito");
    const yearBalIdx   = row.findIndex((c) => normalizeText(c) === "saldo-exercicio");
    const counterpart  = row.findIndex((c) => normalizeText(c).startsWith("cta.c.part"));

    return {
      // Fallbacks: credit = one after debit; counterpart = one before debit; yearBalance = 12
      debit:           debitIdx,
      credit:          creditIdx >= 0     ? creditIdx    : debitIdx + 1,
      counterpartCode: counterpart >= 0   ? counterpart  : debitIdx - 1,
      yearBalance:     yearBalIdx >= 0    ? yearBalIdx   : 12,
    };
  }

  // Header row not found — use the most common 14-column layout as last resort
  return { counterpartCode: 6, debit: 7, credit: 8, yearBalance: 12 };
}

// ─── Public types ────────────────────────────────────────────────────────────

export type RazaoEntryData = {
  entryDate: Date;
  referenceMonth: string; // "YYYY-MM"
  accountCode: string;
  accountName: string;
  costCenter: string | null;     // Centro de Custo — null when file has no CC column
  lot: string | null;
  counterpartCode: string | null;
  counterpartName: string | null;
  description: string | null;
  debit: number;
  credit: number;
  balance: number;
};

export type ParsedRazaoMonth = {
  referenceMonth: string;
  /** Aggregated rows suitable for the existing mapping engine */
  accountRows: ParsedAccountRow[];
  /** Individual transaction rows for drill-down storage */
  entries: RazaoEntryData[];
};

export type ParsedRazaoResult = {
  metadata: {
    cnpj: string | null;
    referenceMonth: string | null;   // first month
    periodEndMonth: string | null;   // last month (null when single-month)
    /** True when the file contains explicit "Centro de Custos:" sections */
    hasCostCenters: boolean;
    /** Unique, sorted list of cost center names found in the file */
    costCenters: string[];
  };
  months: string[];
  byMonth: Record<string, ParsedRazaoMonth>;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeText(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

function excelSerialToDate(serial: number): Date {
  // Excel epoch: Dec 30 1899 (accounts for the 1900 leap-year bug)
  return new Date(new Date(1899, 11, 30).getTime() + serial * 86_400_000);
}

/**
 * Parse a cell value as a currency amount.
 * Accepts:
 *  - JS number (from xlsx numeric cell) → returned directly
 *  - Brazilian-format string "1.234,56" → dots stripped, comma→dot
 *  - English-format string "1234.56" (no comma) → dot kept as decimal
 *  - Parenthesised negative "(123,45)" → negated
 */
function parseAmount(raw: unknown): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  if (raw === null || raw === undefined) return 0;
  const s = String(raw).trim();
  if (s === "" || s === "-") return 0;
  const hasComma = s.includes(",");
  const clean = s
    .replace(/[R$\s]/g, "")
    // Only strip dots when they are Brazilian thousands separators
    // (i.e. when there is also a comma present as the decimal separator)
    .replace(hasComma ? /\./g : /(?!\d)\.(?!\d)/g, "")
    .replace(",", ".")
    .replace(/[()]/g, "");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : s.includes("(") ? -Math.abs(n) : n;
}

function extractMetadata(rows: string[][]): { cnpj: string | null; periodo: string | null } {
  let cnpj: string | null = null;
  let periodo: string | null = null;

  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const r = rows[i] ?? [];
    const key = normalizeText((r[0] ?? "") + (r[1] ?? ""));
    if (key.includes("c.n.p.j") || key.includes("cnpj")) {
      const raw = r.slice(2).filter(Boolean).join(" ").replace(/\D/g, "");
      if (raw.length >= 14) cnpj = raw.slice(0, 14);
    }
    if (key.includes("period")) {
      periodo = r.slice(2).filter(Boolean).join(" ").trim();
    }
  }

  return { cnpj, periodo };
}

function monthFromDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Detect whether a buffer contains a Razão Contábil file.
 * Looks for the "Conta:" block marker within the first 300 rows.
 */
export function isRazaoFormat(buffer: Buffer): boolean {
  try {
    const wb = read(buffer, { type: "buffer", cellDates: false, sheetRows: 300 });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return false;
    const rows = utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName]!, {
      header: 1,
      defval: "",
    }) as unknown[][];

    return rows.some((r) => formatCell(r[0]).trim().toLowerCase() === "conta:");
  } catch {
    return false;
  }
}

/**
 * Parse a Razão Contábil XLSX buffer.
 * Returns aggregated rows per month (for the mapping engine) and individual
 * transaction entries (for drill-down storage).
 */
export function parseRazaoBuffer(buffer: Buffer): ParsedRazaoResult {
  const wb = read(buffer, { type: "buffer", cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Arquivo Razão sem abas.");

  const rawRows = utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName]!, {
    header: 1,
    defval: "",
  }) as unknown[][];

  // rows: every cell as string — used for text pattern matching and metadata
  // rawRows: original values — used for numeric extraction to preserve decimal precision
  const rows = rawRows.map((r) => r.map(formatCell));
  const { cnpj, periodo } = extractMetadata(rows);

  // Detect column layout (adapts to 11-col CC format vs 14-col SEM CC format)
  const layout = detectColumnLayout(rows);

  // ── Parse account blocks ────────────────────────────────────────────────

  interface AccountBlock {
    code: string;
    name: string;
    costCenter: string | null;      // cost center this account belongs to
    saldoAnterior: number;          // from the explicit SALDO ANTERIOR line
    entries: RazaoEntryData[];
    /** running Saldo-Exercício tracked per month — last value = closing balance */
    closingByMonth: Record<string, number>;
  }

  const blocks: AccountBlock[] = [];
  let current: AccountBlock | null = null;
  let currentCostCenter: string | null = null;
  const costCenterSet = new Set<string>();

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const r = rows[rowIdx]!;
    const rawR = rawRows[rowIdx]!;

    // Cost center header row: col 0 = "Centro de Custos:"
    if (r[COL_DATE]!.trim().toLowerCase() === "centro de custos:") {
      const ccName = r[2]!.trim();
      currentCostCenter = ccName || null;
      if (ccName) costCenterSet.add(ccName);
      continue;
    }

    // Account header row: col 0 = "Conta:"
    if (r[COL_DATE]!.trim().toLowerCase() === "conta:") {
      if (current) blocks.push(current);
      current = {
        code: r[2]!.trim(),
        name: r[4]!.trim(),
        costCenter: currentCostCenter,
        saldoAnterior: 0,
        entries: [],
        closingByMonth: {},
      };
      continue;
    }

    if (!current) continue;

    // Saldo Anterior line: col 2 (Histórico) = "SALDO ANTERIOR"
    if (r[COL_DESCRIPTION]!.trim().toLowerCase() === "saldo anterior") {
      current.saldoAnterior = parseAmount(rawR[layout.yearBalance]);
      continue;
    }

    // Transaction row: col 0 is a numeric Excel serial date
    const serial = parseFloat(r[COL_DATE]!);
    if (!isNaN(serial) && serial > 40_000 && serial < 60_000) {
      const entryDate = excelSerialToDate(serial);
      const refMonth = monthFromDate(entryDate);

      const raw = rawRows[rowIdx]!;
      const debit = parseAmount(raw[layout.debit]);
      const credit = parseAmount(raw[layout.credit]);
      const balance = parseAmount(raw[layout.yearBalance]);

      // Histórico (col 2) = description text; Cta.C.Part. = counterpart code
      const description = r[COL_DESCRIPTION]!.trim() || null;
      const counterpartCodeRaw = r[layout.counterpartCode]!.trim();
      const counterpartCode = counterpartCodeRaw || null;

      current.entries.push({
        entryDate,
        referenceMonth: refMonth,
        accountCode: current.code,
        accountName: current.name,
        costCenter: current.costCenter,
        lot: r[COL_LOT]!.trim() || null,
        counterpartCode: counterpartCode || null,
        counterpartName: null,
        description,
        debit,
        credit,
        balance,
      });

      // Track last balance per month for saldo_atual calculation
      current.closingByMonth[refMonth] = balance;
    }
  }
  if (current) blocks.push(current);

  // ── Group by month ────────────────────────────────────────────────────────

  const allMonths = [
    ...new Set(blocks.flatMap((b) => b.entries.map((e) => e.referenceMonth))),
  ].sort();

  const byMonth: Record<string, ParsedRazaoMonth> = {};

  for (const month of allMonths) {
    const accountRows: ParsedAccountRow[] = [];
    const entries: RazaoEntryData[] = [];
    const sortedMonths = allMonths.slice(0, allMonths.indexOf(month) + 1);

    for (const block of blocks) {
      const monthEntries = block.entries.filter((e) => e.referenceMonth === month);
      entries.push(...monthEntries);

      // Determine opening balance for this month:
      // - If it's the earliest month in the file → use SALDO ANTERIOR from the file
      // - Otherwise → use the closing balance of the previous month
      const prevMonth = sortedMonths[sortedMonths.length - 2] ?? null;
      const saldoAnterior =
        prevMonth !== null
          ? (block.closingByMonth[prevMonth] ?? block.saldoAnterior)
          : block.saldoAnterior;

      const totalDebit = monthEntries.reduce((s, e) => s + e.debit, 0);
      const totalCredit = monthEntries.reduce((s, e) => s + e.credit, 0);
      const saldoAtual = block.closingByMonth[month] ?? saldoAnterior;

      // Only include accounts that either have movement or a non-zero opening balance
      if (totalDebit !== 0 || totalCredit !== 0 || saldoAnterior !== 0 || saldoAtual !== 0) {
        accountRows.push({
          accountCode: block.code,
          description: block.name,
          values: {
            saldo_anterior: Number(saldoAnterior.toFixed(2)),
            debito: Number(totalDebit.toFixed(2)),
            credito: Number(totalCredit.toFixed(2)),
            saldo_atual: Number(saldoAtual.toFixed(2)),
          } satisfies Record<NormalizedValueColumn, number>,
        });
      }
    }

    byMonth[month] = { referenceMonth: month, accountRows, entries };
  }

  // ── Build metadata ────────────────────────────────────────────────────────

  const firstMonth = allMonths[0] ?? null;
  const lastMonth = allMonths[allMonths.length - 1] ?? null;

  // Parse periodo string ("DD/MM/YYYY - DD/MM/YYYY") into YYYY-MM if not already extracted
  let metaFirstMonth = firstMonth;
  let metaLastMonth = lastMonth !== firstMonth ? lastMonth : null;

  if (periodo) {
    const parts = periodo.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g) ?? [];
    if (parts[0]) {
      const [, dm, mm, ym] = parts[0].match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)!;
      metaFirstMonth = `${ym}-${mm!.padStart(2, "0")}`;
    }
    if (parts[1]) {
      const [, , me, ye] = parts[1].match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)!;
      metaLastMonth = `${ye}-${me!.padStart(2, "0")}`;
      if (metaLastMonth === metaFirstMonth) metaLastMonth = null;
    }
  }

  return {
    metadata: {
      cnpj,
      referenceMonth: metaFirstMonth,
      periodEndMonth: metaLastMonth,
      hasCostCenters: costCenterSet.size > 0,
      costCenters: [...costCenterSet].sort(),
    },
    months: allMonths,
    byMonth,
  };
}
