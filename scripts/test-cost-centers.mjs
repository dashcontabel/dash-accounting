/**
 * POC test: parse the two Razão files and show cost center detection results.
 * Run with: node scripts/test-cost-centers.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

function normalizeText(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function formatCell(v) {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

function excelSerialToDate(serial) {
  return new Date(new Date(1899, 11, 30).getTime() + serial * 86_400_000);
}

function parseAmount(raw) {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  if (raw === null || raw === undefined) return 0;
  const s = String(raw).trim();
  if (s === "" || s === "-") return 0;
  const hasComma = s.includes(",");
  const clean = s
    .replace(/[R$\s]/g, "")
    .replace(hasComma ? /\./g : /(?!\d)\.(?!\d)/g, "")
    .replace(",", ".")
    .replace(/[()]/g, "");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : s.includes("(") ? -Math.abs(n) : n;
}

function detectColumnLayout(rows) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i];
    const debitIdx = row.findIndex((c) => normalizeText(c) === "debito");
    if (debitIdx < 0) continue;
    const yearBalIdx = row.findIndex((c) => normalizeText(c) === "saldo-exercicio");
    return {
      counterpartCode: debitIdx - 1,
      debit: debitIdx,
      credit: debitIdx + 1,
      yearBalance: yearBalIdx >= 0 ? yearBalIdx : 12,
    };
  }
  return { counterpartCode: 6, debit: 7, credit: 8, yearBalance: 12 };
}

function parseFile(filePath) {
  const buffer = readFileSync(filePath);
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = wb.SheetNames[0];
  const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    defval: "",
  });
  const rows = rawRows.map((r) => r.map(formatCell));
  const layout = detectColumnLayout(rows);

  const blocks = [];
  let current = null;
  let currentCC = null;
  const ccSet = new Set();

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const r = rows[rowIdx];
    const rawR = rawRows[rowIdx];

    if (r[0].trim().toLowerCase() === "centro de custos:") {
      currentCC = r[2].trim() || null;
      if (currentCC) ccSet.add(currentCC);
      continue;
    }

    if (r[0].trim().toLowerCase() === "conta:") {
      if (current) blocks.push(current);
      current = { code: r[2].trim(), name: r[4].trim(), costCenter: currentCC, entries: [] };
      continue;
    }

    if (!current) continue;

    if (r[2].trim().toLowerCase() === "saldo anterior") continue;

    const serial = parseFloat(r[0]);
    if (!isNaN(serial) && serial > 40000 && serial < 60000) {
      const debit = parseAmount(rawR[layout.debit]);
      const credit = parseAmount(rawR[layout.credit]);
      current.entries.push({ debit, credit, costCenter: current.costCenter });
    }
  }
  if (current) blocks.push(current);

  return { layout, ccSet, blocks };
}

function summarizeByCc(blocks) {
  const map = {};
  for (const block of blocks) {
    const key = block.costCenter ?? "(Sem CC)";
    if (!map[key]) map[key] = { totalDebit: 0, totalCredit: 0, accounts: new Set() };
    map[key].accounts.add(block.code);
    for (const e of block.entries) {
      map[key].totalDebit += e.debit;
      map[key].totalCredit += e.credit;
    }
  }
  return map;
}

const files = [
  "docs/arquivo/Razão22.05.2026.xlsx",
  "docs/arquivo/Razão sem C.C. EM 22.05.2026.xlsx",
];

for (const f of files) {
  console.log("\n" + "=".repeat(60));
  console.log("Arquivo:", f.split("/").pop());
  const { layout, ccSet, blocks } = parseFile(resolve(f));
  console.log("Layout detectado:", layout);
  console.log("hasCostCenters:", ccSet.size > 0);
  console.log("costCenters:", [...ccSet].sort());
  console.log("Total de contas:", blocks.length);
  console.log("Total de lançamentos:", blocks.reduce((s, b) => s + b.entries.length, 0));

  if (ccSet.size > 0) {
    console.log("\nResumo por Centro de Custo:");
    const summary = summarizeByCc(blocks);
    for (const [cc, data] of Object.entries(summary)) {
      console.log(
        `  ${cc}: ${data.accounts.size} contas | Débitos: R$${data.totalDebit.toFixed(2)} | Créditos: R$${data.totalCredit.toFixed(2)}`
      );
    }
  }
}
