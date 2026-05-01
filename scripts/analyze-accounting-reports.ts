import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";

// ─── helpers ────────────────────────────────────────────────────────────────

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function excelSerialToDate(serial: number): string {
  const epoch = new Date(1899, 11, 30);
  return new Date(epoch.getTime() + serial * 86400000).toISOString().slice(0, 10);
}

function parseNum(s: string): number {
  if (!s || s.trim() === "" || s.trim() === "-") return 0;
  const clean = s.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(clean.replace(/[()]/g, ""));
  return s.includes("(") ? -Math.abs(n) : (isNaN(n) ? 0 : n);
}

/** Returns all rows as string[][] */
function allRows(sheet: XLSX.WorkSheet): string[][] {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  return raw.map((r) => (r as unknown[]).map(formatCell));
}

// ─── balancete analysis ──────────────────────────────────────────────────────

// Structure verified against BALANCETE JAN 2026.xlsx:
//   Col 0: Código (seq, ignore)  Col 1: Classificação (account code)
//   Col 3: Descrição             Col 7: Saldo Anterior
//   Col 9: Débito                Col 11: Crédito   Col 13: Saldo Atual
//   Header at row 7, data from row 8. Stop at "RESUMO DO BALANCETE".

export function analyzeBalancete(filePath: string) {
  if (!fs.existsSync(filePath)) return { exists: false as const };

  const wb = XLSX.readFile(filePath, { cellDates: false, sheetRows: 0 });
  const sheetName = wb.SheetNames[0]!;
  const rows = allRows(wb.Sheets[sheetName]!);

  // Metadata
  const metadata: Record<string, string> = {};
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const r = rows[i] ?? [];
    const k = normalizeText(r[0]);
    if (k.includes("empresa")) metadata["empresa"] = r.slice(1).filter(Boolean).join(" ").trim();
    if (k.includes("c.n.p.j") || k.includes("cnpj")) metadata["cnpj"] = r.slice(1).filter(Boolean).join(" ").trim();
    if (k.includes("period")) metadata["periodo"] = r.slice(1).filter(Boolean).join(" ").trim();
  }

  // Find header row (contains "Classificação" and "Saldo")
  const ACCOUNT_RE = /^\d+(\.\d+)*$/;
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const norm = (rows[i] ?? []).map(normalizeText);
    if (norm.some((c) => c.includes("classificac")) && norm.some((c) => c.includes("saldo"))) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx < 0) return { exists: true as const, error: "Cabeçalho não encontrado" };

  const headers = rows[headerRowIdx] ?? [];

  // Fixed columns for this file format
  const COL_CODE = 1;        // Classificação
  const COL_DESC = 3;        // Descrição da conta
  const COL_SALDO_ANT = 7;   // Saldo Anterior
  const COL_DEBITO = 9;      // Débito
  const COL_CREDITO = 11;    // Crédito
  const COL_SALDO_ATUAL = 13; // Saldo Atual

  const dataRows = rows.slice(headerRowIdx + 1).filter((r) => {
    const code = (r[COL_CODE] ?? "").trim();
    const raw = normalizeText(r.join(" "));
    return ACCOUNT_RE.test(code) && !raw.includes("resumo do balancete");
  });

  const allCodes = new Set(dataRows.map((r) => r[COL_CODE]!.trim()));
  const leafAccounts = dataRows.filter((r) => {
    const code = r[COL_CODE]!.trim();
    return ![...allCodes].some((c) => c !== code && c.startsWith(code + "."));
  });

  return {
    exists: true as const,
    sheetName,
    metadata,
    headerRowIdx,
    headers,
    totalDataRows: dataRows.length,
    totalLeafAccounts: leafAccounts.length,
    sampleRows: rows.slice(headerRowIdx, headerRowIdx + 8),
    columns: { code: COL_CODE, desc: COL_DESC, saldoAnt: COL_SALDO_ANT, debito: COL_DEBITO, credito: COL_CREDITO, saldoAtual: COL_SALDO_ATUAL },
    sampleLeafAccounts: leafAccounts.slice(0, 20).map((r) => ({
      code: r[COL_CODE]!.trim(),
      name: (r[COL_DESC] ?? "").trim(),
      saldoAnt: parseNum(r[COL_SALDO_ANT] ?? ""),
      debito: parseNum(r[COL_DEBITO] ?? ""),
      credito: parseNum(r[COL_CREDITO] ?? ""),
      saldoAtual: parseNum(r[COL_SALDO_ATUAL] ?? ""),
    })),
  };
}

// ─── razão analysis ──────────────────────────────────────────────────────────

// Structure verified against Razão jan a mar2026 AMPM.xlsx:
//   Row 6: global header   Col 0: Data (serial)  Col 1: Lote
//          Col 2: Contrapartida/Histórico ("code - name\ndescription")
//          Col 6: Débito   Col 7: Crédito   Col 8: Saldo   Col 11: Saldo-Exercício
//   Account blocks: Row N = ["Conta:", seq, code, "", name, ...]
//                   Row N+1 = ["", "", "SALDO ANTERIOR", ..., "", value, ""] (col 11)
//                   Row N+2+ = transaction rows (col 0 = Excel serial date)

export function analyzeRazao(filePath: string) {
  if (!fs.existsSync(filePath)) return { exists: false as const };

  const wb = XLSX.readFile(filePath, { cellDates: false, sheetRows: 0 });
  const sheetName = wb.SheetNames[0]!;
  const rows = allRows(wb.Sheets[sheetName]!);

  // Metadata
  const metadata: Record<string, string> = {};
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const r = rows[i] ?? [];
    const k = normalizeText((r[0] ?? "") + (r[1] ?? ""));
    if (k.includes("empresa")) metadata["empresa"] = r.slice(2).filter(Boolean).join(" ").trim();
    if (k.includes("c.n.p.j") || k.includes("cnpj")) metadata["cnpj"] = r.slice(2).filter(Boolean).join(" ").trim();
    if (k.includes("period")) metadata["periodo"] = r.slice(2).filter(Boolean).join(" ").trim();
  }

  // Column constants (verified)
  const COL_DATE = 0;
  const COL_LOT = 1;
  const COL_COUNTERPART = 2;
  const COL_DEBIT = 6;
  const COL_CREDIT = 7;
  const COL_BALANCE = 8;
  const COL_YEAR_BALANCE = 11;

  interface AccountBlock {
    code: string;
    name: string;
    saldoAnterior: number;
    entries: Array<{
      date: string;
      month: string;
      lot: string;
      counterpartCode: string;
      counterpartName: string;
      description: string;
      debit: number;
      credit: number;
      balance: number;
    }>;
    monthlyTotals: Record<string, { debit: number; credit: number; closingBalance: number }>;
  }

  const blocks: AccountBlock[] = [];
  let current: AccountBlock | null = null;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? [];
    if ((r[COL_DATE] ?? "").trim().toLowerCase() === "conta:") {
      if (current) blocks.push(current);
      current = {
        code: (r[2] ?? "").trim(),
        name: (r[4] ?? "").trim(),
        saldoAnterior: 0,
        entries: [],
        monthlyTotals: {},
      };
      continue;
    }

    if (!current) continue;

    if ((r[COL_COUNTERPART] ?? "").trim().toLowerCase() === "saldo anterior") {
      current.saldoAnterior = parseNum(r[COL_YEAR_BALANCE] ?? "");
      continue;
    }

    // Transaction row: col 0 is a numeric Excel serial
    const rawDate = r[COL_DATE] ?? "";
    const serial = parseFloat(rawDate);
    if (!isNaN(serial) && serial > 40000 && serial < 60000) {
      const date = excelSerialToDate(serial);
      const month = date.slice(0, 7);
      const counterpartRaw = r[COL_COUNTERPART] ?? "";
      const [counterpartPart = "", descPart = ""] = counterpartRaw.split("\n");
      const dashIdx = counterpartPart.indexOf(" - ");
      const counterpartCode = dashIdx >= 0 ? counterpartPart.slice(0, dashIdx).trim() : "";
      const counterpartName = dashIdx >= 0 ? counterpartPart.slice(dashIdx + 3).trim() : counterpartPart.trim();

      const debit = parseNum(r[COL_DEBIT] ?? "");
      const credit = parseNum(r[COL_CREDIT] ?? "");
      const balance = parseNum(r[COL_YEAR_BALANCE] ?? r[COL_BALANCE] ?? "");

      current.entries.push({ date, month, lot: (r[COL_LOT] ?? "").trim(), counterpartCode, counterpartName, description: descPart.trim(), debit, credit, balance });

      if (!current.monthlyTotals[month]) {
        current.monthlyTotals[month] = { debit: 0, credit: 0, closingBalance: 0 };
      }
      current.monthlyTotals[month]!.debit += debit;
      current.monthlyTotals[month]!.credit += credit;
      current.monthlyTotals[month]!.closingBalance = balance; // last entry = closing
    }
  }
  if (current) blocks.push(current);

  const allMonths = [...new Set(blocks.flatMap((b) => Object.keys(b.monthlyTotals)))].sort();
  const totalEntries = blocks.reduce((s, b) => s + b.entries.length, 0);

  return {
    exists: true as const,
    sheetName,
    metadata,
    totalRows: rows.length,
    totalAccounts: blocks.length,
    totalEntries,
    months: allMonths,
    monthlyEntryCounts: allMonths.reduce((acc, m) => {
      acc[m] = blocks.reduce((s, b) => s + b.entries.filter((e) => e.month === m).length, 0);
      return acc;
    }, {} as Record<string, number>),
    blocks,
  };
}

// ─── main ────────────────────────────────────────────────────────────────────

function main() {
  const balancetePath = "c:/Users/kleyt/Downloads/ampm/BALANCETE JAN 2026.xlsx";
  const razaoPath = "c:/Users/kleyt/Downloads/ampm/Razão jan a mar2026 AMPM.xlsx";

  console.log("Analisando Balancete...");
  const b = analyzeBalancete(balancetePath);
  if (!b.exists) {
    console.log("  → não encontrado");
  } else if ("error" in b) {
    console.log(`  → ERRO: ${b.error}`);
  } else {
    console.log(`  → OK — período: ${b.metadata?.["periodo"]} — ${b.totalLeafAccounts} contas-folha (${b.totalDataRows} total)`);
    console.log("     Colunas:", JSON.stringify(b.columns));
    console.log("     Primeiras contas-folha:");
    b.sampleLeafAccounts?.slice(0, 5).forEach((a) => {
      console.log(`       ${a.code} — ${a.name}: saldoAnt=${a.saldoAnt} deb=${a.debito} cred=${a.credito} saldoAtual=${a.saldoAtual}`);
    });
  }

  console.log("\nAnalisando Razão...");
  const r = analyzeRazao(razaoPath);
  if (!r.exists) {
    console.log("  → não encontrado");
  } else {
    console.log(`  → OK — período: ${r.metadata?.["periodo"]}`);
    console.log(`     ${r.totalAccounts} contas, ${r.totalEntries} lançamentos`);
    console.log(`     Meses: ${r.months?.join(", ")}`);
    console.log(`     Lançamentos por mês: ${JSON.stringify(r.monthlyEntryCounts)}`);
    console.log("     Primeiras contas:");
    r.blocks?.slice(0, 5).forEach((block) => {
      const months = Object.keys(block.monthlyTotals).join(",");
      console.log(`       ${block.code} — ${block.name}: saldoAnt=${block.saldoAnterior} | ${block.entries.length} lanç. (${months || "sem movimento"})`);
    });
  }

  console.log("\nRelatório de viabilidade em: docs/viabilidade-detalhamento-cards.md");
}

main();
