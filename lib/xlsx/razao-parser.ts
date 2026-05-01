import { read, utils } from "xlsx";

import type { NormalizedValueColumn, ParsedAccountRow } from "./parser";

// ─── Column indices (verified against real AMPM Razão files) ────────────────
const COL_DATE = 0;          // Excel serial date
const COL_LOT = 1;           // Lote
const COL_COUNTERPART = 2;   // "code - name\ndescription"
const COL_DEBIT = 6;         // Débito
const COL_CREDIT = 7;        // Crédito
const COL_YEAR_BALANCE = 11; // Saldo-Exercício (cumulative from opening)

// ─── Public types ────────────────────────────────────────────────────────────

export type RazaoEntryData = {
  entryDate: Date;
  referenceMonth: string; // "YYYY-MM"
  accountCode: string;
  accountName: string;
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

function parseAmount(raw: string): number {
  if (!raw || raw.trim() === "" || raw.trim() === "-") return 0;
  const clean = raw
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[()]/g, "");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : raw.includes("(") ? -Math.abs(n) : n;
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

  const rows = rawRows.map((r) => r.map(formatCell));
  const { cnpj, periodo } = extractMetadata(rows);

  // ── Parse account blocks ────────────────────────────────────────────────

  interface AccountBlock {
    code: string;
    name: string;
    saldoAnterior: number;          // from the explicit SALDO ANTERIOR line
    entries: RazaoEntryData[];
    /** running Saldo-Exercício tracked per month — last value = closing balance */
    closingByMonth: Record<string, number>;
  }

  const blocks: AccountBlock[] = [];
  let current: AccountBlock | null = null;

  for (const r of rows) {
    // Account header row: col 0 = "Conta:"
    if (r[COL_DATE]!.trim().toLowerCase() === "conta:") {
      if (current) blocks.push(current);
      current = {
        code: r[2]!.trim(),
        name: r[4]!.trim(),
        saldoAnterior: 0,
        entries: [],
        closingByMonth: {},
      };
      continue;
    }

    if (!current) continue;

    // Saldo Anterior line: col 2 = "SALDO ANTERIOR"
    if (r[COL_COUNTERPART]!.trim().toLowerCase() === "saldo anterior") {
      current.saldoAnterior = parseAmount(r[COL_YEAR_BALANCE]!);
      continue;
    }

    // Transaction row: col 0 is a numeric Excel serial date
    const serial = parseFloat(r[COL_DATE]!);
    if (!isNaN(serial) && serial > 40_000 && serial < 60_000) {
      const entryDate = excelSerialToDate(serial);
      const refMonth = monthFromDate(entryDate);

      // Parse counterpart field: "code - name\ndescription"
      const counterpartRaw = r[COL_COUNTERPART]!;
      const [counterpartLine = "", descLine = ""] = counterpartRaw.split("\n");
      const dashIdx = counterpartLine.indexOf(" - ");
      const counterpartCode = dashIdx >= 0 ? counterpartLine.slice(0, dashIdx).trim() : null;
      const counterpartName = dashIdx >= 0 ? counterpartLine.slice(dashIdx + 3).trim() : counterpartLine.trim() || null;

      const debit = parseAmount(r[COL_DEBIT]!);
      const credit = parseAmount(r[COL_CREDIT]!);
      const balance = parseAmount(r[COL_YEAR_BALANCE]!);

      current.entries.push({
        entryDate,
        referenceMonth: refMonth,
        accountCode: current.code,
        accountName: current.name,
        lot: r[COL_LOT]!.trim() || null,
        counterpartCode: counterpartCode || null,
        counterpartName: counterpartName || null,
        description: descLine.trim() || null,
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
    },
    months: allMonths,
    byMonth,
  };
}
