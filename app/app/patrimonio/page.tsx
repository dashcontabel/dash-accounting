"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/app/components/app-shell";

// ── Types ─────────────────────────────────────────────────────────────────────

type AssetRow = {
  label: string;
  sublabel?: string;
  economico: number | null;
  financeiro: number | null;
  /** true = subtotal/total row */
  isTotal?: boolean;
  /** true = section header row (no values, just a group label) */
  isSection?: boolean;
};

// ── Hardcoded data (31/12/2025) ───────────────────────────────────────────────

const REFERENCE_DATE = "31/12/2025";

const ASSET_ROWS: AssetRow[] = [
  // ── Seção: Ativos Financeiros ─────────────────────────────────────────────
  { label: "Ativos Financeiros", economico: null, financeiro: null, isSection: true },
  { label: "APLICAÇÕES BANCO DO BRASIL", economico: null, financeiro: null },
  { label: "APLICAÇÕES BANCO ITAÚ",      economico: null, financeiro: 0 },
  { label: "APLICAÇÕES - XP",            economico: null, financeiro: null },

  { label: "MÓVEIS E EQUIPAMENTOS",      economico: 0,          financeiro: null },
  {
    label: "COTAS PATRIM. - PETRA × LRA2",
    sublabel: "Cotas patrimoniais",
    economico: 286_325.40, financeiro: null,
  },
  {
    label: "COTAS PATRIM. - PETRA × LRA3",
    sublabel: "Cotas patrimoniais",
    economico: 140_787.50, financeiro: null,
  },
  {
    label: "COTAS PATRIM. - PETRA × B.VISTA",
    sublabel: "Cotas patrimoniais",
    economico: 609_600.00, financeiro: null,
  },
  {
    label: "COTAS PATRIM. - AMPM × TRAPICHE",
    sublabel: "Cotas patrimoniais",
    economico: 14_100.00, financeiro: null,
  },
  {
    label: "PATRIMÔNIO PRODUZIDO",
    economico: 1_157_338.75,
    financeiro: null,
    isTotal: true,
  },

  // ── Imóveis + A Receber ───────────────────────────────────────────────────────
  { label: "A RECEBER - PLACA",          economico: 120_625.85, financeiro: null },
  { label: "IMÓVEIS", sublabel: "GALEIRA 586", economico: 505_000.00, financeiro: null },
  {
    label: "TOTAL DO PATRIMÔNIO",
    economico: 1_662_338.75,
    financeiro: null,
    isTotal: true,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number | null): string {
  if (v === null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtShort(v: number): string {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(1)}k`;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: number | null;
  sub: string;
  color: "blue" | "emerald" | "amber";
  icon: React.ReactNode;
}) {
  const colors = {
    blue:    "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800/50 dark:text-blue-300",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800/50 dark:text-emerald-300",
    amber:   "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800/50 dark:text-amber-300",
  };
  const iconBg = {
    blue:    "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400",
    amber:   "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400",
  };
  return (
    <div className={`flex flex-col rounded-2xl border-2 p-5 ${colors[color]}`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${iconBg[color]}`}>{icon}</span>
      </div>
      <p className={`text-2xl font-extrabold tabular-nums sm:text-3xl ${colors[color]}`}>
        {value !== null ? fmtShort(value) : <span className="text-zinc-400 text-lg">—</span>}
      </p>
      <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">{sub}</p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PatrimonioPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<"ADMIN" | "CLIENT" | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data: { user?: { role: "ADMIN" | "CLIENT"; email: string } }) => {
        if (!data.user) { router.push("/login"); return; }
        setUserRole(data.user.role);
        setUserEmail(data.user.email);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const economicoTotal = ASSET_ROWS.find((r) => r.label === "TOTAL DO PATRIMÔNIO")?.economico ?? null;
  const patrimonioProduced = ASSET_ROWS.find((r) => r.label === "PATRIMÔNIO PRODUZIDO")?.economico ?? null;
  const imovelValue = ASSET_ROWS.find((r) => r.sublabel === "GALEIRA 586")?.economico ?? null;

  return (
    <AppShell role={userRole} email={userEmail} onLogout={handleLogout}>
      {/* ── Header ── */}
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-zinc-800 dark:text-zinc-100">
            Demonstrativo de Ativos Patrimoniais
          </h1>
          <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
            Posição em{" "}
            <span className="font-semibold text-zinc-600 dark:text-zinc-300">{REFERENCE_DATE}</span>
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
              Dados fixos — integração em breve
            </span>
          </p>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Total do Patrimônio"
          value={economicoTotal}
          sub="Econômico + Financeiro"
          color="blue"
          icon={
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 6h18M3 14h10m-7 4h4" />
            </svg>
          }
        />
        <KpiCard
          label="Patrimônio Produzido"
          value={patrimonioProduced}
          sub="Cotas, A Receber, Móveis"
          color="emerald"
          icon={
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <KpiCard
          label="Imóveis"
          value={imovelValue}
          sub="Galeira 586"
          color="amber"
          icon={
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════
           MOBILE — lista de cards (oculto em sm+)
      ══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-3 sm:hidden">
        {ASSET_ROWS.map((row, idx) => {
          const total    = (row.economico ?? 0) + (row.financeiro ?? 0);
          const hasTotal = row.economico !== null || row.financeiro !== null;

          /* Cabeçalho de seção */
          if (row.isSection) {
            return (
              <p key={idx} className="mt-2 px-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                {row.label}
              </p>
            );
          }

          /* Linha de total/subtotal */
          if (row.isTotal) {
            return (
              <div key={idx} className="flex items-center justify-between rounded-2xl bg-blue-600 px-4 py-4 shadow-sm dark:bg-blue-700">
                <p className="text-sm font-extrabold uppercase tracking-wide text-white">
                  {row.label}
                </p>
                <p className="text-base font-extrabold tabular-nums text-white">
                  {hasTotal ? fmt(total) : "—"}
                </p>
              </div>
            );
          }

          /* Card de ativo */
          return (
            <div key={idx} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700/50 dark:bg-zinc-900/50">
              {/* Nome */}
              <p className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                {row.label}
                {row.sublabel && (
                  <span className="ml-1.5 text-[10px] font-normal text-zinc-400 dark:text-zinc-500">
                    — {row.sublabel}
                  </span>
                )}
              </p>
              {/* Valores */}
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-zinc-800">
                  <span className="mb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Econômico</span>
                  <span className="text-xs font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
                    {row.economico !== null ? fmt(row.economico) : "—"}
                  </span>
                </div>
                <div className="flex flex-col rounded-xl bg-amber-50 px-3 py-2.5 dark:bg-amber-900/20">
                  <span className="mb-1 text-[9px] font-bold uppercase tracking-widest text-amber-500 dark:text-amber-400">Financeiro</span>
                  <span className="text-xs font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
                    {row.financeiro !== null ? fmt(row.financeiro) : "—"}
                  </span>
                </div>
                <div className="flex flex-col rounded-xl bg-blue-50 px-3 py-2.5 dark:bg-blue-900/20">
                  <span className="mb-1 text-[9px] font-bold uppercase tracking-widest text-blue-500 dark:text-blue-400">Total</span>
                  <span className="text-xs font-bold tabular-nums text-zinc-800 dark:text-zinc-100">
                    {hasTotal ? fmt(total) : "—"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Footer note */}
        <p className="px-1 pb-2 text-[11px] text-zinc-400 dark:text-zinc-500">
          ⓘ Valores econômicos referem-se à soma dos exercícios 2024 + 2025.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════
           DESKTOP — tabela profissional (oculto em mobile)
      ══════════════════════════════════════════════════════════════ */}
      <div className="hidden sm:block overflow-hidden rounded-2xl shadow-lg border border-[#0c3460]/20 dark:border-[#0f4c81]/20">

        {/* ── Título do painel — gradiente do menu ── */}
        <div className="flex items-center justify-between bg-linear-to-r from-[#0c3460] to-[#0f4c81] px-6 py-4 dark:from-[#090f1a] dark:to-[#0d1f38]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300/70">Demonstrativo Patrimonial</p>
            <p className="mt-0.5 text-sm font-bold text-white">Ativos em {REFERENCE_DATE}</p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/15">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />
            <span className="text-[10px] font-semibold text-blue-200">Econômico 2024 + 2025</span>
          </div>
        </div>

        {/* ── Cabeçalho de colunas ── */}
        <div className="grid grid-cols-[1fr_200px_200px_200px] border-b border-[#0c3460]/10 dark:border-[#0f4c81]/15">
          <div className="bg-[#0f4c81]/5 px-6 py-3 dark:bg-[#0f4c81]/10">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#0c3460] dark:text-blue-300">Ativo</p>
          </div>
          <div className="border-l border-[#0c3460]/10 bg-[#0f4c81]/8 px-4 py-3 text-center dark:border-[#0f4c81]/15 dark:bg-[#0f4c81]/15">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#0f4c81] dark:text-blue-300">Econômico</p>
            <p className="text-[9px] text-[#0f4c81]/50 dark:text-blue-400/50">2024 + 2025</p>
          </div>
          <div className="border-l border-[#0c3460]/10 bg-amber-50 px-4 py-3 text-center dark:border-[#0f4c81]/15 dark:bg-amber-950/30">
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">Financeiro</p>
            <p className="text-[9px] text-amber-600/50 dark:text-amber-500/50">Posição atual</p>
          </div>
          <div className="border-l border-[#0c3460]/10 bg-[#0c3460]/5 px-4 py-3 text-center dark:border-[#0f4c81]/15 dark:bg-[#0c3460]/30">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#0c3460] dark:text-blue-200">Total</p>
            <p className="text-[9px] text-[#0c3460]/40 dark:text-blue-300/40">Consolidado</p>
          </div>
        </div>

        {/* ── Linhas ── */}
        <div className="divide-y divide-[#0c3460]/6 dark:divide-[#0f4c81]/10 bg-white dark:bg-zinc-900/70">
          {ASSET_ROWS.map((row, idx) => {
            const total    = (row.economico ?? 0) + (row.financeiro ?? 0);
            const hasTotal = row.economico !== null || row.financeiro !== null;
            const pct      = row.economico !== null && !row.isTotal
              ? Math.round((row.economico / 1_662_338.75) * 100)
              : 0;

            /* Cabeçalho de seção */
            if (row.isSection) {
              return (
                <div key={idx} className="grid grid-cols-[1fr_200px_200px_200px]">
                  <div className="flex items-center gap-3 border-l-4 border-[#0f4c81] bg-[#0f4c81]/5 px-5 py-2.5 dark:border-[#0f4c81]/70 dark:bg-[#0f4c81]/10">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#0f4c81] dark:text-blue-300">
                      {row.label}
                    </p>
                  </div>
                  <div className="border-l border-[#0c3460]/8 bg-[#0f4c81]/3 dark:border-[#0f4c81]/10 dark:bg-[#0f4c81]/5" />
                  <div className="border-l border-[#0c3460]/8 bg-amber-50/40 dark:border-[#0f4c81]/10 dark:bg-amber-950/10" />
                  <div className="border-l border-[#0c3460]/8 bg-[#0c3460]/3 dark:border-[#0f4c81]/10 dark:bg-[#0c3460]/15" />
                </div>
              );
            }

            /* Linha de total/subtotal */
            if (row.isTotal) {
              return (
                <div key={idx} className="grid grid-cols-[1fr_200px_200px_200px] bg-linear-to-r from-[#0c3460] via-[#0f4c81] to-[#0c3460] dark:from-[#090f1a] dark:via-[#0d1f38] dark:to-[#090f1a]">
                  <div className="flex items-center gap-3 px-6 py-4">
                    <span className="h-px w-5 bg-white/30" />
                    <p className="text-sm font-extrabold uppercase tracking-wide text-white">{row.label}</p>
                  </div>
                  <p className="border-l border-white/15 py-4 text-center text-sm font-semibold tabular-nums text-blue-200">
                    {fmt(row.economico)}
                  </p>
                  <p className="border-l border-white/15 py-4 text-center text-sm font-semibold tabular-nums text-blue-200">
                    {fmt(row.financeiro)}
                  </p>
                  <p className="border-l border-white/15 py-4 text-center text-sm font-extrabold tabular-nums text-white">
                    {hasTotal ? fmt(total) : "—"}
                  </p>
                </div>
              );
            }

            /* Linha de detalhe */
            return (
              <div key={idx} className="group grid grid-cols-[1fr_200px_200px_200px] transition-colors hover:bg-[#0f4c81]/5 dark:hover:bg-[#0f4c81]/8">
                {/* Nome + barra proporcional */}
                <div className="flex flex-col justify-center px-6 py-4">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{row.label}</p>
                  {row.sublabel && (
                    <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">{row.sublabel}</p>
                  )}
                  {pct > 0 && (
                    <div className="mt-2 h-1 w-full max-w-xs overflow-hidden rounded-full bg-[#0c3460]/8 dark:bg-[#0f4c81]/20">
                      <div
                        className="h-1 rounded-full bg-[#0f4c81]/50 transition-all dark:bg-[#0f4c81]/70"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
                {/* Econômico */}
                <div className="flex flex-col items-end justify-center border-l border-[#0c3460]/8 bg-[#0f4c81]/3 px-5 py-4 dark:border-[#0f4c81]/10 dark:bg-[#0f4c81]/5">
                  <p className="text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    {row.economico !== null ? fmt(row.economico) : (
                      <span className="text-zinc-300 dark:text-zinc-600">—</span>
                    )}
                  </p>
                  {pct > 0 && (
                    <p className="mt-0.5 text-[10px] font-semibold text-[#0f4c81] dark:text-blue-400">
                      {pct}% do total
                    </p>
                  )}
                </div>
                {/* Financeiro */}
                <div className="flex items-center justify-end border-l border-[#0c3460]/8 bg-amber-50/20 px-5 py-4 dark:border-[#0f4c81]/10 dark:bg-amber-950/5">
                  <p className="text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    {row.financeiro !== null ? fmt(row.financeiro) : (
                      <span className="text-zinc-300 dark:text-zinc-600">—</span>
                    )}
                  </p>
                </div>
                {/* Total */}
                <div className="flex items-center justify-end border-l border-[#0c3460]/8 bg-[#0c3460]/3 px-5 py-4 dark:border-[#0f4c81]/10 dark:bg-[#0c3460]/8">
                  <p className="text-sm font-semibold tabular-nums text-[#0c3460] dark:text-blue-200">
                    {hasTotal ? fmt(total) : (
                      <span className="text-zinc-300 dark:text-zinc-600">—</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Rodapé ── */}
        <div className="flex items-center justify-between border-t border-[#0c3460]/10 bg-[#0c3460]/3 px-6 py-3 dark:border-[#0f4c81]/15 dark:bg-[#090f1a]/60">
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            ⓘ Econômico = soma dos exercícios 2024 + 2025 · Financeiro será integrado ao sistema em breve
          </p>
          <p className="text-[11px] font-semibold text-[#0f4c81] dark:text-blue-400">
            Base: {REFERENCE_DATE}
          </p>
        </div>
      </div>
    </AppShell>
  );
}
