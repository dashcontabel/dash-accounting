/**
 * Diagnostic script: analyze Razão files for "placa" company in docs/validação
 *
 * Reports:
 *  1. Accounts / entries that arrive WITHOUT a cost center even though
 *     the file contains "Centro de Custos:" sections (pointing to a parser
 *     gap).
 *  2. Any account whose name contains "adiantamento" related to "lucro" /
 *     "resultado" / "dividendo" that had movement but may not be in the DB.
 *
 * Run with:
 *   node scripts/analyze-placa-validation.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require   = createRequire(import.meta.url);
const XLSX      = require("xlsx");

// ─── helpers ─────────────────────────────────────────────────────────────────

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
  return new Date(new Date(1899, 11, 30).getTime() + serial * 86_400_000)
    .toISOString()
    .slice(0, 10);
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
    const creditIdx   = row.findIndex((c) => normalizeText(c) === "credito");
    const yearBalIdx  = row.findIndex((c) => normalizeText(c) === "saldo-exercicio");
    const counterpart = row.findIndex((c) => normalizeText(c).startsWith("cta.c.part"));
    return {
      debit:           debitIdx,
      credit:          creditIdx >= 0   ? creditIdx   : debitIdx + 1,
      counterpartCode: counterpart >= 0 ? counterpart : debitIdx - 1,
      yearBalance:     yearBalIdx >= 0  ? yearBalIdx  : 12,
    };
  }
  return { counterpartCode: 6, debit: 7, credit: 8, yearBalance: 12 };
}

// ─── parse one file ───────────────────────────────────────────────────────────

function parseFile(filePath) {
  const buffer  = readFileSync(filePath);
  const wb      = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheet   = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const rows    = rawRows.map((r) => r.map(formatCell));
  const layout  = detectColumnLayout(rows);

  const COL_DATE = 0;
  const COL_LOT  = 1;
  const COL_DESC = 2;

  const blocks        = [];
  let current         = null;
  let currentCC       = null;
  let hasCCSection    = false;
  const allCCSeen     = new Set();

  for (let i = 0; i < rows.length; i++) {
    const r    = rows[i];
    const rawR = rawRows[i];

    // Centro de Custos header
    if (r[COL_DATE].trim().toLowerCase() === "centro de custos:") {
      const cc = r[2].trim();
      currentCC    = cc || null;
      hasCCSection = true;
      if (cc) allCCSeen.add(cc);
      continue;
    }

    // Account header
    if (r[COL_DATE].trim().toLowerCase() === "conta:") {
      if (current) blocks.push(current);
      current = {
        code:      r[2].trim(),
        name:      r[4].trim(),
        costCenter: currentCC,
        entries:   [],
      };
      continue;
    }

    if (!current) continue;

    // Skip SALDO ANTERIOR line
    if (r[COL_DESC].trim().toLowerCase() === "saldo anterior") continue;

    // Transaction row (Excel serial date)
    const serial = parseFloat(r[COL_DATE]);
    if (!isNaN(serial) && serial > 40_000 && serial < 60_000) {
      const debit  = parseAmount(rawR[layout.debit]);
      const credit = parseAmount(rawR[layout.credit]);
      current.entries.push({
        date:    excelSerialToDate(serial),
        debit,
        credit,
        desc:    r[COL_DESC].trim(),
        lot:     r[COL_LOT].trim(),
      });
    }
  }
  if (current) blocks.push(current);

  return { blocks, hasCCSection, allCCSeen: [...allCCSeen], layout };
}

// ─── main ─────────────────────────────────────────────────────────────────────

const FILES = [
  "Razão.xlsx JAN 2026.xlsx",
  "Razão.xlsx FEV 2026.xlsx",
  "Razão.xlsx MAR 2026.xlsx",
  "Razão.xlsx ABR 2026.xlsx",
];

const baseDir = resolve(__dirname, "../docs/validação");

console.log("=".repeat(80));
console.log("DIAGNÓSTICO PLACA – docs/validação");
console.log("=".repeat(80));

for (const fileName of FILES) {
  const filePath = resolve(baseDir, fileName);
  console.log(`\n${"─".repeat(80)}`);
  console.log(`ARQUIVO: ${fileName}`);
  console.log("─".repeat(80));

  let parsed;
  try {
    parsed = parseFile(filePath);
  } catch (e) {
    console.log(`  ERRO ao ler arquivo: ${e.message}`);
    continue;
  }

  const { blocks, hasCCSection, allCCSeen, layout } = parsed;
  console.log(`  Tem seções "Centro de Custos:" : ${hasCCSection}`);
  console.log(`  Centros de custo encontrados   : ${allCCSeen.length === 0 ? "(nenhum)" : allCCSeen.join(", ")}`);
  console.log(`  Layout detectado               : debit=${layout.debit} credit=${layout.credit} yearBalance=${layout.yearBalance} counterpart=${layout.counterpartCode}`);
  console.log(`  Total de blocos (contas)        : ${blocks.length}`);

  // ── 1. Contas SEM centro de custo ──────────────────────────────────────
  const semCC = blocks.filter((b) => b.costCenter === null || b.costCenter === "");

  console.log(`\n  [1] CONTAS SEM CENTRO DE CUSTO: ${semCC.length} de ${blocks.length}`);
  if (semCC.length > 0) {
    for (const b of semCC) {
      const totalD = b.entries.reduce((s, e) => s + e.debit,  0);
      const totalC = b.entries.reduce((s, e) => s + e.credit, 0);
      const hasMove = totalD !== 0 || totalC !== 0;
      console.log(
        `    • [${b.code}] ${b.name}` +
        (hasMove ? `  (D=${totalD.toFixed(2)} C=${totalC.toFixed(2)})` : "  (sem movimento)")
      );
    }
  }

  // ── 2. Contas com "adiantamento" / "lucro" / "resultado" / "dividendo" ─
  const KEYWORDS = ["adiantamento", "lucro", "resultado", "dividendo", "distribuicao"];
  const adiantBlocks = blocks.filter((b) => {
    const n = normalizeText(b.name);
    return KEYWORDS.some((k) => n.includes(k));
  });

  console.log(`\n  [2] CONTAS RELACIONADAS A LUCRO/ADIANTAMENTO/RESULTADO: ${adiantBlocks.length}`);
  if (adiantBlocks.length > 0) {
    for (const b of adiantBlocks) {
      const totalD = b.entries.reduce((s, e) => s + e.debit,  0);
      const totalC = b.entries.reduce((s, e) => s + e.credit, 0);
      console.log(
        `    • [${b.code}] "${b.name}"  CC=${b.costCenter ?? "(sem CC)"}  D=${totalD.toFixed(2)} C=${totalC.toFixed(2)}  lançamentos=${b.entries.length}`
      );
      if (b.entries.length > 0 && b.entries.length <= 20) {
        for (const e of b.entries) {
          console.log(`        ${e.date}  D=${e.debit.toFixed(2)}  C=${e.credit.toFixed(2)}  "${e.desc}"  lot=${e.lot}`);
        }
      } else if (b.entries.length > 20) {
        console.log(`        (mostrando 5 primeiros dos ${b.entries.length} lançamentos)`);
        for (const e of b.entries.slice(0, 5)) {
          console.log(`        ${e.date}  D=${e.debit.toFixed(2)}  C=${e.credit.toFixed(2)}  "${e.desc}"  lot=${e.lot}`);
        }
      }
    }
  }

  // ── 3. Resumo de contas que TÊM CC vs SEM CC (quando hasCCSection=true) ─
  if (hasCCSection) {
    const comCC = blocks.filter((b) => b.costCenter !== null && b.costCenter !== "");
    console.log(`\n  [3] RESUMO CC: ${comCC.length} contas COM cc  /  ${semCC.length} contas SEM cc`);

    // Show blocks that appear BEFORE the first CC section (possible parser gap)
    // These are accounts seen before any "Centro de Custos:" row was encountered
    // A heuristic: find the block index of the first account that HAS a CC
    const firstCCBlockIdx = blocks.findIndex((b) => b.costCenter !== null && b.costCenter !== "");
    const beforeFirstCC   = firstCCBlockIdx > 0 ? blocks.slice(0, firstCCBlockIdx) : [];
    if (beforeFirstCC.length > 0) {
      console.log(`    Contas que aparecem ANTES da primeira seção CC no arquivo (${beforeFirstCC.length}):`);
      for (const b of beforeFirstCC) {
        const totalD = b.entries.reduce((s, e) => s + e.debit, 0);
        const totalC = b.entries.reduce((s, e) => s + e.credit, 0);
        console.log(`      • [${b.code}] ${b.name}  D=${totalD.toFixed(2)} C=${totalC.toFixed(2)}`);
      }
    }
  }
}

console.log(`\n${"=".repeat(80)}\nFim do diagnóstico.\n`);
