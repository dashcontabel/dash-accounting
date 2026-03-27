import XLSX from "xlsx";
import fs from "fs";

const buffer = fs.readFileSync(
  "C:/Users/kleyt/OneDrive/Documentos/projetos/web/next/dash-contabil/BASE PARA POWER BI.xlsx",
);
const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
const norm = (v) =>
  String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const sheet = wb.SheetNames.find((n) => norm(n) === "balancete") ?? wb.SheetNames[0];
console.log("Sheet selecionada:", sheet);

const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, raw: true, blankrows: false, defval: "" });

// Find header row
let hi = -1;
for (let i = 0; i < 40; i++) {
  const c = rows[i].map(norm);
  if (
    c.some((x) => ["classificacao", "codigo"].some((a) => x.includes(a))) &&
    c.some((x) => ["saldo anterior", "saldo atual", "debito", "credito"].some((a) => x.includes(a)))
  ) { hi = i; break; }
}
console.log("Header index:", hi);

const hdr = rows[hi].map(norm);

// Priority alias groups — classificacao wins over generic codigo
let cc = -1;
for (const g of [["classificacao"], ["codigo conta"], ["codigo"]]) {
  const i = hdr.findIndex((h) => g.some((a) => h.includes(a)));
  if (i >= 0) { cc = i; break; }
}
const dc = hdr.findIndex((h) => h.includes("descricao"));
const sa = hdr.findIndex((h) => h.includes("saldo anterior"));
const db = hdr.findIndex((h) => h.includes("debito"));
const cr = hdr.findIndex((h) => h.includes("credito"));
const su = hdr.findIndex((h) => h.includes("saldo atual"));
console.log(`cols — code:${cc} (esperado 3) desc:${dc} saldoAnt(header):${sa} debito:${db} credito:${cr} saldoAtual:${su}`);

// Offset detection for saldo_anterior (merged header: label at col 15, data at col 19)
const dr = rows.slice(hi + 1);
const ACCT_RE = /^\d+(\.\d+)*/;
const SM = "resumo do balancete";
const cnt = new Array(db - sa).fill(0);
let smp = 0;
for (const row of dr) {
  if (row.some((c) => norm(c) === SM)) break;
  const c = String(row[cc] ?? "").trim();
  if (!ACCT_RE.test(c)) continue;
  for (let o = 0; o < cnt.length; o++) {
    const v = row[sa + o];
    if ((typeof v === "number" && v !== 0) || (typeof v === "string" && v.trim() && v !== "-")) cnt[o]++;
  }
  if (++smp >= 20) break;
}
const asc = sa + cnt.indexOf(Math.max(...cnt));
console.log("saldo_anterior offset counts:", cnt);
console.log(`Actual saldo_anterior col: ${asc} (esperado 19)`);

// Extract rows until RESUMO marker
const AR = [];
for (const row of dr) {
  if (row.some((c) => norm(c) === SM)) { console.log("\nMarcador RESUMO encontrado!"); break; }
  const c = String(row[cc] ?? "").replace(/\s+/g, "").trim();
  if (!ACCT_RE.test(c)) continue;
  const d = (() => { for (let i = dc; i < sa; i++) { const v = String(row[i] ?? "").trim(); if (v && v !== "-") return v; } return ""; })();
  AR.push({ code: c, desc: d, saldoAnt: row[asc], debito: row[db], credito: row[cr], saldoAtual: row[su] });
}

// Leaf filter
const LR = AR.filter((r) => {
  const p = r.code + ".";
  for (const o of AR) { if (o.code !== r.code && o.code.startsWith(p)) return false; }
  return true;
});

console.log(`\nTotal rows: ${AR.length} | Leaf rows (sem contas-pai): ${LR.length}`);
console.log("\nPrimeiras 8 leaf rows:");
LR.slice(0, 8).forEach((r) => console.log(" ", r.code, "-", r.desc.padEnd(35), "saldoAnt:", r.saldoAnt, "saldoAtual:", r.saldoAtual));

// Metadata
const CNPJ_RE = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/;
const PERIOD_RE = /(\d{2})\/(\d{2})\/(\d{4})/;
let cnpj = null; let rm = null;
for (const row of rows.slice(0, 10)) {
  for (const cell of row) {
    const s = String(cell ?? "");
    if (!cnpj) { const m = CNPJ_RE.exec(s); if (m) cnpj = m[0].replace(/\D/g, ""); }
    if (!rm) { const m = PERIOD_RE.exec(s); if (m) rm = `${m[3]}-${m[2]}`; }
  }
}
console.log(`\nMetadata: CNPJ=${cnpj} | Mês de referência=${rm}`);
