"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import AppShell from "@/app/components/app-shell";

type MeResponse = {
  user?: { id: string; email: string; role: "ADMIN" | "CLIENT" };
};

type Section = "visao-geral" | "filtros" | "graficos" | "heatmap" | "sincronizacao";

const SECTIONS: { id: Section; label: string; shortLabel: string; icon: React.ReactNode }[] = [
  {
    id: "visao-geral",
    label: "Visão Geral",
    shortLabel: "Geral",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: "filtros",
    label: "Filtros",
    shortLabel: "Filtros",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
      </svg>
    ),
  },
  {
    id: "graficos",
    label: "Gráficos",
    shortLabel: "Gráficos",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: "heatmap",
    label: "Heatmap",
    shortLabel: "Heatmap",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
    ),
  },
  {
    id: "sincronizacao",
    label: "Sincronização",
    shortLabel: "Sincronização",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
];

// ─── Shared UI helpers ───────────────────────────────────────────────────────

function Badge({
  color,
  children,
}: {
  color: "blue" | "emerald" | "amber" | "purple" | "red" | "zinc" | "indigo";
  children: React.ReactNode;
}) {
  const cls: Record<string, string> = {
    blue:    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    amber:   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    purple:  "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    red:     "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    zinc:    "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300",
    indigo:  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls[color]}`}>
      {children}
    </span>
  );
}

function InfoBox({
  title,
  children,
  color = "blue",
}: {
  title: string;
  children: React.ReactNode;
  color?: "blue" | "amber" | "emerald";
}) {
  const cls: Record<string, string> = {
    blue:    "border-blue-200 bg-blue-50 dark:border-blue-800/40 dark:bg-blue-950/20",
    amber:   "border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/20",
    emerald: "border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-950/20",
  };
  const titleCls: Record<string, string> = {
    blue:    "text-blue-700 dark:text-blue-300",
    amber:   "text-amber-700 dark:text-amber-300",
    emerald: "text-emerald-700 dark:text-emerald-300",
  };
  return (
    <div className={`rounded-xl border p-4 ${cls[color]}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${titleCls[color]}`}>{title}</p>
      <div className="mt-2 text-sm text-foreground">{children}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-foreground">{children}</h2>;
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-[--text-muted]">
      {children}
    </h3>
  );
}

function KpiCard({
  label,
  color,
  formula,
  description,
}: {
  label: string;
  color: "blue" | "emerald" | "amber" | "purple" | "red" | "zinc" | "indigo";
  formula?: string;
  description: string;
}) {
  const borderCls: Record<string, string> = {
    blue:    "border-blue-100 dark:border-blue-900/50",
    emerald: "border-emerald-100 dark:border-emerald-900/50",
    amber:   "border-amber-100 dark:border-amber-900/50",
    purple:  "border-purple-100 dark:border-purple-900/50",
    red:     "border-red-100 dark:border-red-900/50",
    zinc:    "border-zinc-200 dark:border-zinc-700/50",
    indigo:  "border-indigo-100 dark:border-indigo-900/50",
  };
  return (
    <div className={`rounded-xl border ${borderCls[color]} bg-[--surface-2] p-4`}>
      <div className="flex items-start justify-between gap-2">
        <Badge color={color}>{label}</Badge>
      </div>
      {formula && (
        <p className="mt-2 rounded-lg bg-[--surface] px-3 py-1.5 font-mono text-xs text-[--text-muted]">
          {formula}
        </p>
      )}
      <p className="mt-2 text-sm text-[--text-muted]">{description}</p>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardDocsPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse["user"]>();
  const [active, setActive] = useState<Section>("visao-geral");

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: MeResponse) => {
        if (!data.user) {
          router.push("/login");
          return;
        }
        setMe(data.user);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <AppShell role={me?.role ?? null} email={me?.email ?? null} onLogout={handleLogout}>
      <div className="space-y-6">

        {/* Header */}
        <div className="rounded-2xl border border-[--border] bg-[--surface-2] p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge color="blue">Documentação</Badge>
                <Badge color="indigo">Dashboard</Badge>
              </div>
              <h1 className="mt-2 text-xl font-bold text-foreground">Guia do Dashboard</h1>
              <p className="mt-1 text-sm text-[--text-muted]">
                Como interpretar os KPIs, usar os filtros de período e empresa, e ler os gráficos e o heatmap.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/"
                className="rounded-xl border border-[--border] bg-[--surface] px-3 py-2 text-xs font-medium text-foreground hover:bg-[--border] transition-colors"
              >
                → Dashboard
              </Link>
              <Link
                href="/app/docs/import-mapping"
                className="rounded-xl border border-[--border] bg-[--surface] px-3 py-2 text-xs font-medium text-foreground hover:bg-[--border] transition-colors"
              >
                → Importação & Mapeamento
              </Link>
            </div>
          </div>
        </div>

        {/* Tab nav — sticky */}
        <div className="sticky top-0 z-20 -mx-3 px-3 py-2 sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6 bg-[--background]">
          <div className="flex gap-1 rounded-xl border border-[--border] bg-[--surface-2] p-1 shadow-sm">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(s.id)}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors ${
                  active === s.id
                    ? "bg-brand text-white shadow-sm"
                    : "text-[--text-muted] hover:text-foreground"
                }`}
              >
                {s.icon}
                <span className="text-[10px] leading-none">{s.shortLabel}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Visão Geral ── */}
        {active === "visao-geral" && (
          <div className="space-y-6">

            <div className="rounded-2xl border border-[--border] bg-[--surface] p-6">
              <SectionTitle>O que é o Dashboard?</SectionTitle>
              <p className="mt-3 text-sm text-[--text-muted] leading-relaxed">
                O Dashboard é a tela principal do sistema. Ele consolida os dados financeiros importados dos
                balancetes e os exibe como <strong className="text-foreground">indicadores (KPIs)</strong>,{" "}
                <strong className="text-foreground">gráficos de evolução</strong> e um{" "}
                <strong className="text-foreground">heatmap comparativo</strong> entre empresas e meses.
              </p>
              <p className="mt-3 text-sm text-[--text-muted] leading-relaxed">
                Todos os valores exibidos derivam diretamente dos balancetes importados aplicados aos{" "}
                mapeamentos de contas configurados pelo administrador. Não há dados inseridos manualmente.
              </p>
            </div>

            {/* KPI Cards */}
            <div>
              <SubTitle>Cartões de indicadores (KPIs)</SubTitle>
              <p className="mt-2 text-sm text-[--text-muted]">
                A primeira linha do dashboard exibe oito cartões, cada um representando um indicador
                financeiro do período selecionado.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
                <KpiCard
                  label="Faturamento Bruto"
                  color="blue"
                  formula="∑ contas mapeadas como FATURAMENTO"
                  description="Receita total antes de qualquer dedução. Representa o valor total faturado pela empresa no período."
                />
                <KpiCard
                  label="Deduções"
                  color="red"
                  formula="∑ contas mapeadas como DEDUCOES"
                  description="Impostos sobre faturamento, devoluções e abatimentos. Subtrai do faturamento bruto para chegar à receita líquida."
                />
                <KpiCard
                  label="Receita Líquida"
                  color="emerald"
                  formula="FATURAMENTO − DEDUCOES"
                  description="Faturamento bruto menos as deduções. É a receita efetiva da empresa após impostos sobre vendas."
                />
                <KpiCard
                  label="CMV / CPV"
                  color="amber"
                  formula="∑ contas mapeadas como CMV"
                  description="Custo das Mercadorias Vendidas ou Custo dos Produtos/Serviços Vendidos. Custo direto associado à entrega do produto ou serviço."
                />
                <KpiCard
                  label="Lucro Bruto"
                  color="emerald"
                  formula="RECEITA_LIQUIDA − CMV"
                  description="Receita líquida menos o CMV. Indica a margem antes das despesas operacionais e administrativas."
                />
                <KpiCard
                  label="Despesas Operacionais"
                  color="red"
                  formula="∑ contas mapeadas como DESPESAS_OPERACIONAIS"
                  description="Despesas com pessoal, aluguel, marketing, administrativas e similares. Não inclui o CMV."
                />
                <KpiCard
                  label="EBITDA"
                  color="purple"
                  formula="LUCRO_BRUTO − DESPESAS_OPERACIONAIS"
                  description="Resultado antes de juros, impostos, depreciação e amortização. Indica a geração de caixa operacional da empresa."
                />
                <KpiCard
                  label="Resultado Líquido"
                  color="indigo"
                  formula="EBITDA + RECEITAS_FINANCEIRAS − DESPESAS_FINANCEIRAS"
                  description="Resultado final do período, incorporando receitas e despesas financeiras. É o lucro (ou prejuízo) efetivo do período."
                />
              </div>
            </div>

            {/* Indicador de período */}
            <div>
              <SubTitle>Indicador de período de referência</SubTitle>
              <div className="mt-3 rounded-xl border border-[--border] bg-[--surface] p-5 space-y-3">
                <p className="text-sm text-[--text-muted]">
                  Logo acima dos cartões há uma barra azul que indica <strong className="text-foreground">qual período</strong> os KPIs e gráficos estão refletindo.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-[--border] bg-[--surface-2] p-3">
                    <p className="text-xs font-semibold text-foreground">Modo mensal</p>
                    <p className="mt-1 text-xs text-[--text-muted]">
                      Exibe o mês selecionado. Exemplo: <span className="font-mono text-foreground">Janeiro/2026</span>.
                    </p>
                  </div>
                  <div className="rounded-xl border border-[--border] bg-[--surface-2] p-3">
                    <p className="text-xs font-semibold text-foreground">Granularidade &gt; mensal</p>
                    <p className="mt-1 text-xs text-[--text-muted]">
                      Exibe o intervalo do período ativo. Exemplo: <span className="font-mono text-foreground">Jan–Jun/2026</span> para semestral.
                    </p>
                  </div>
                  <div className="rounded-xl border border-[--border] bg-[--surface-2] p-3">
                    <p className="text-xs font-semibold text-foreground">Multi-empresa</p>
                    <p className="mt-1 text-xs text-[--text-muted]">
                      Mostra a quantidade de empresas + &ldquo;consolidado&rdquo;. Exemplo: <span className="font-mono text-foreground">3 empresas · consolidado · Jan–Jun/2026</span>.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <InfoBox title="Dados ausentes" color="amber">
              Se nenhum dado estiver disponível para o período selecionado, os KPIs exibem <strong>—</strong> (traço) em vez de zero.
              Isso indica que ainda não há balancete importado para aquela empresa naquele mês —
              garanta que o arquivo correspondente foi importado em <strong>Importações</strong>.
            </InfoBox>
          </div>
        )}

        {/* ── Filtros ── */}
        {active === "filtros" && (
          <div className="space-y-6">

            <div className="rounded-2xl border border-[--border] bg-[--surface] p-6">
              <SectionTitle>Filtros disponíveis</SectionTitle>
              <p className="mt-2 text-sm text-[--text-muted]">
                O dashboard possui dois grupos de filtros, localizados no topo da página: o seletor de empresa(s)
                e o filtro de período. Qualquer alteração atualiza instantaneamente todos os KPIs, gráficos e o heatmap.
              </p>
            </div>

            {/* Seletor de empresa */}
            <div className="rounded-xl border border-[--border] bg-[--surface] p-6 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Badge color="blue">Seletor de empresa</Badge>
              </h3>
              <p className="text-sm text-[--text-muted]">
                Clique no botão com o nome da empresa para abrir o modal de seleção. Você pode escolher
                <strong className="text-foreground"> uma ou mais empresas</strong> ao mesmo tempo.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[--border] bg-[--surface-2] p-4">
                  <p className="text-xs font-semibold text-foreground">Empresa única selecionada</p>
                  <ul className="mt-2 space-y-1 text-sm text-[--text-muted] list-disc list-inside">
                    <li>KPIs mostram os dados daquela empresa no período</li>
                    <li>Gráfico de barras exibe a evolução mensal da empresa</li>
                    <li>Gráficos de pizza mostram a composição de receitas e despesas</li>
                    <li>O gráfico comparativo por empresa <strong className="text-foreground">não aparece</strong></li>
                    <li>Heatmap exibe uma linha para a empresa</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-[--border] bg-[--surface-2] p-4">
                  <p className="text-xs font-semibold text-foreground">Múltiplas empresas selecionadas</p>
                  <ul className="mt-2 space-y-1 text-sm text-[--text-muted] list-disc list-inside">
                    <li>KPIs mostram o <strong className="text-foreground">consolidado</strong> (soma de todas as empresas selecionadas)</li>
                    <li>Gráfico de barras exibe a evolução consolidada</li>
                    <li>Gráfico comparativo por empresa <strong className="text-foreground">aparece</strong>, mostrando o resultado de cada empresa lado a lado</li>
                    <li>Heatmap exibe uma linha por empresa</li>
                    <li>Gráficos de pizza refletem o consolidado</li>
                  </ul>
                </div>
              </div>

              <InfoBox title="Como usar o modal de seleção" color="blue">
                <ol className="ml-4 mt-1 list-decimal space-y-1">
                  <li>Clique no botão com o nome da empresa (ou &ldquo;N empresas&rdquo; se já houver múltiplas selecionadas)</li>
                  <li>No modal, marque ou desmarque as empresas desejadas usando os checkboxes</li>
                  <li>Clique em <strong>Confirmar</strong> para aplicar a seleção ao dashboard</li>
                  <li>Para voltar a uma empresa só, desmarque as demais e confirme</li>
                </ol>
              </InfoBox>
            </div>

            {/* Filtro de período */}
            <div className="rounded-xl border border-[--border] bg-[--surface] p-6 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Badge color="purple">Filtro de período</Badge>
              </h3>
              <p className="text-sm text-[--text-muted]">
                O filtro de período tem dois controles: o <strong className="text-foreground">seletor de ano</strong> e
                o <strong className="text-foreground">seletor de granularidade</strong>. Em modo mensal, um terceiro
                seletor de mês aparece.
              </p>

              <SubTitle>Granularidades disponíveis</SubTitle>

              {/* Mobile: cards */}
              <div className="mt-3 sm:hidden space-y-3">
                {[
                  { badge: "blue" as const,    label: "Mensal",     janela: "1 mês",   kpi: "Dados do mês exato selecionado. Um seletor extra de mês aparece.",                   bar: "Uma barra por mês do ano — todos os meses com dados." },
                  { badge: "purple" as const,  label: "Bimestral",  janela: "2 meses", kpi: "Soma dos 2 meses mais recentes disponíveis no ano selecionado.",                     bar: "Uma barra por mês dos 2 meses do período ativo." },
                  { badge: "amber" as const,   label: "Trimestral", janela: "3 meses", kpi: "Soma dos 3 meses mais recentes com dados no ano selecionado.",                       bar: "Uma barra por mês dos 3 meses do período ativo." },
                  { badge: "emerald" as const, label: "Semestral",  janela: "6 meses", kpi: "Soma dos 6 meses mais recentes com dados no ano selecionado.",                       bar: "Uma barra por mês dos 6 meses do período ativo." },
                  { badge: "indigo" as const,  label: "Anual",      janela: "12 meses",kpi: "Soma de todos os meses disponíveis no ano selecionado.",                              bar: "Uma barra por mês — todos os meses com dados no ano." },
                ].map((g) => (
                  <div key={g.label} className="rounded-xl border border-[--border] bg-[--surface-2] p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge color={g.badge}>{g.label}</Badge>
                      <span className="text-xs font-mono text-[--text-muted]">{g.janela}</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-[--text-muted] uppercase tracking-wide">KPIs</p>
                      <p className="text-sm text-[--text-muted]">{g.kpi}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-[--text-muted] uppercase tracking-wide">Gráfico de barras</p>
                      <p className="text-sm text-[--text-muted]">{g.bar}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="mt-3 hidden sm:block overflow-hidden rounded-xl border border-[--border]">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-[--border] bg-[--surface-2] text-xs font-medium uppercase tracking-wide text-[--text-muted]">
                      <tr>
                        <th className="px-4 py-3 text-left">Granularidade</th>
                        <th className="px-4 py-3 text-left">Janela</th>
                        <th className="px-4 py-3 text-left">Como os KPIs são calculados</th>
                        <th className="px-4 py-3 text-left">Como o gráfico de barras aparece</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[--border]">
                      <tr className="bg-[--surface]">
                        <td className="px-4 py-3"><Badge color="blue">Mensal</Badge></td>
                        <td className="px-4 py-3 text-[--text-muted] whitespace-nowrap">1 mês</td>
                        <td className="px-4 py-3 text-[--text-muted]">Dados do mês exato selecionado. Um seletor extra de mês aparece.</td>
                        <td className="px-4 py-3 text-[--text-muted]">Uma barra por mês do ano — todos os meses com dados</td>
                      </tr>
                      <tr className="bg-[--surface-2]">
                        <td className="px-4 py-3"><Badge color="purple">Bimestral</Badge></td>
                        <td className="px-4 py-3 text-[--text-muted] whitespace-nowrap">2 meses</td>
                        <td className="px-4 py-3 text-[--text-muted]">Soma dos 2 meses mais recentes disponíveis no ano selecionado.</td>
                        <td className="px-4 py-3 text-[--text-muted]">Uma barra por mês dos 2 meses do período ativo</td>
                      </tr>
                      <tr className="bg-[--surface]">
                        <td className="px-4 py-3"><Badge color="amber">Trimestral</Badge></td>
                        <td className="px-4 py-3 text-[--text-muted] whitespace-nowrap">3 meses</td>
                        <td className="px-4 py-3 text-[--text-muted]">Soma dos 3 meses mais recentes com dados no ano selecionado.</td>
                        <td className="px-4 py-3 text-[--text-muted]">Uma barra por mês dos 3 meses do período ativo</td>
                      </tr>
                      <tr className="bg-[--surface-2]">
                        <td className="px-4 py-3"><Badge color="emerald">Semestral</Badge></td>
                        <td className="px-4 py-3 text-[--text-muted] whitespace-nowrap">6 meses</td>
                        <td className="px-4 py-3 text-[--text-muted]">Soma dos 6 meses mais recentes com dados no ano selecionado.</td>
                        <td className="px-4 py-3 text-[--text-muted]">Uma barra por mês dos 6 meses do período ativo</td>
                      </tr>
                      <tr className="bg-[--surface]">
                        <td className="px-4 py-3"><Badge color="indigo">Anual</Badge></td>
                        <td className="px-4 py-3 text-[--text-muted] whitespace-nowrap">12 meses</td>
                        <td className="px-4 py-3 text-[--text-muted]">Soma de todos os meses disponíveis no ano selecionado.</td>
                        <td className="px-4 py-3 text-[--text-muted]">Uma barra por mês, todos os meses com dados no ano</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <SubTitle>O conceito de &ldquo;período ativo&rdquo;</SubTitle>
              <div className="mt-3 space-y-3">
                <p className="text-sm text-[--text-muted] leading-relaxed">
                  Para granularidades maiores que mensal, os dados disponíveis no ano são agrupados
                  sequencialmente em blocos do tamanho escolhido. O dashboard sempre exibe
                  o <strong className="text-foreground">bloco mais recente</strong> (período ativo).
                </p>
                <div className="rounded-xl border border-[--border] bg-[--surface-2] p-4">
                  <p className="text-xs font-semibold text-foreground mb-3">Exemplo — ano 2026 com dados de Jan a Jun, granularidade Trimestral</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {[
                      { label: "Período 1",  months: "Jan · Fev · Mar", active: false },
                      { label: "Período 2 ✓", months: "Abr · Mai · Jun", active: true  },
                    ].map((p) => (
                      <div
                        key={p.label}
                        className={`rounded-lg border px-4 py-2 ${
                          p.active
                            ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                            : "border-[--border] bg-[--surface] text-[--text-muted]"
                        }`}
                      >
                        <p className="font-semibold">{p.label}</p>
                        <p className="mt-0.5 font-mono">{p.months}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-[--text-muted]">
                    Os KPIs mostrarão a <strong className="text-foreground">soma de Abr + Mai + Jun/2026</strong>. O
                    indicador de período exibirá{" "}
                    <span className="font-mono text-foreground">Abr–Jun/2026</span>.
                  </p>
                </div>

                <InfoBox title="Por que o último bloco?" color="blue">
                  O bloco mais recente sempre contém os dados mais atuais disponíveis. Isso garante que,
                  ao abrir o dashboard, você veja automaticamente os indicadores do período mais recente
                  sem precisar navegar manualmente até ele.
                </InfoBox>
              </div>

              <SubTitle>Seletor de ano</SubTitle>
              <p className="mt-3 text-sm text-[--text-muted]">
                Lista apenas os anos para os quais há dados importados para a(s) empresa(s) selecionada(s).
                Trocar o ano recalcula todos os KPIs, gráficos e o heatmap para esse novo exercício.
              </p>

              <SubTitle>Seletor de mês (apenas no modo mensal)</SubTitle>
              <p className="mt-3 text-sm text-[--text-muted]">
                Visível somente quando a granularidade está em <Badge color="blue">Mensal</Badge>.
                Lista apenas os meses que possuem dados importados no ano selecionado.
                Ao trocar para uma granularidade maior (bimestral, trimestral…), este seletor desaparece automaticamente.
              </p>
            </div>

            <InfoBox title="Regra importante sobre blocos incompletos" color="amber">
              O agrupamento é <strong>sequencial</strong> — os meses disponíveis são divididos em blocos na
              ordem que aparecem. Se o ano tem apenas 5 meses importados e a granularidade é Trimestral,
              os blocos serão <strong>[Jan, Fev, Mar]</strong> e <strong>[Abr, Mai]</strong> (bloco final com 2 meses).
              Os KPIs do período ativo refletirão a soma dos meses presentes naquele bloco, mesmo que esteja incompleto.
            </InfoBox>
          </div>
        )}

        {/* ── Gráficos ── */}
        {active === "graficos" && (
          <div className="space-y-6">

            <div className="rounded-2xl border border-[--border] bg-[--surface] p-6">
              <SectionTitle>Gráficos do dashboard</SectionTitle>
              <p className="mt-2 text-sm text-[--text-muted]">
                Abaixo dos KPIs há quatro seções de gráficos. Cada uma responde aos filtros de empresa e período
                selecionados e atualiza automaticamente.
              </p>
            </div>

            {/* Receitas vs Despesas */}
            <div className="rounded-xl border border-[--border] bg-[--surface] p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Badge color="blue">1</Badge>
                <h3 className="text-sm font-semibold text-foreground">Receitas vs Despesas — gráfico de barras</h3>
              </div>
              <p className="text-sm text-[--text-muted]">
                Exibe lado a lado, para cada ponto de período, as colunas de{" "}
                <strong className="text-foreground">Receitas</strong> (azul),{" "}
                <strong className="text-foreground">Despesas</strong> (vermelho) e{" "}
                <strong className="text-foreground">Resultado</strong> (verde ou cinza, dependendo do sinal).
              </p>
              {/* Mobile: cards */}
              <div className="mt-2 sm:hidden space-y-2">
                {[
                  { name: "Receitas", desc: "Receita Líquida do período (após deduções)",               dot: "bg-blue-500"    },
                  { name: "Despesas", desc: "CMV + Despesas Operacionais (total de saídas)",              dot: "bg-red-500"     },
                  { name: "Resultado", desc: "Resultado Líquido — diferença entre receitas e despesas",   dot: "bg-emerald-500" },
                ].map((s) => (
                  <div key={s.name} className="flex items-start gap-3 rounded-xl border border-[--border] bg-[--surface-2] px-4 py-3">
                    <span className={`mt-1 inline-block h-3 w-3 shrink-0 rounded-full ${s.dot}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.name}</p>
                      <p className="text-xs text-[--text-muted]">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop: table */}
              <div className="mt-2 hidden sm:block overflow-hidden rounded-xl border border-[--border]">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-[--border] bg-[--surface-2] text-xs font-medium uppercase tracking-wide text-[--text-muted]">
                      <tr>
                        <th className="px-4 py-3 text-left">Série</th>
                        <th className="px-4 py-3 text-left">O que representa</th>
                        <th className="px-4 py-3 text-left">Cor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[--border]">
                      <tr className="bg-[--surface]">
                        <td className="px-4 py-3 font-medium text-foreground">Receitas</td>
                        <td className="px-4 py-3 text-[--text-muted]">Receita Líquida do período (após deduções)</td>
                        <td className="px-4 py-3"><span className="inline-block h-3 w-3 rounded-full bg-blue-500" /></td>
                      </tr>
                      <tr className="bg-[--surface-2]">
                        <td className="px-4 py-3 font-medium text-foreground">Despesas</td>
                        <td className="px-4 py-3 text-[--text-muted]">CMV + Despesas Operacionais (total de saídas)</td>
                        <td className="px-4 py-3"><span className="inline-block h-3 w-3 rounded-full bg-red-500" /></td>
                      </tr>
                      <tr className="bg-[--surface]">
                        <td className="px-4 py-3 font-medium text-foreground">Resultado</td>
                        <td className="px-4 py-3 text-[--text-muted]">Resultado Líquido — diferença entre receitas e despesas</td>
                        <td className="px-4 py-3"><span className="inline-block h-3 w-3 rounded-full bg-emerald-500" /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 mt-2">
                <div className="rounded-xl border border-[--border] bg-[--surface-2] p-3">
                  <p className="text-xs font-semibold text-foreground">Modo mensal</p>
                  <p className="mt-1 text-xs text-[--text-muted]">Cada grupo de barras = 1 mês do ano. Visão de todos os meses com dados disponíveis no exercício.</p>
                </div>
                <div className="rounded-xl border border-[--border] bg-[--surface-2] p-3">
                  <p className="text-xs font-semibold text-foreground">Modo bimestral / trimestral / semestral / anual</p>
                  <p className="mt-1 text-xs text-[--text-muted]">Cada grupo de barras = 1 mês <em>dentro do período ativo</em>. Só os meses do bloco atual são exibidos.</p>
                </div>
              </div>
            </div>

            {/* Pizza */}
            <div className="rounded-xl border border-[--border] bg-[--surface] p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Badge color="purple">2</Badge>
                <h3 className="text-sm font-semibold text-foreground">Distribuição de Receita e Despesa — gráficos de pizza</h3>
              </div>
              <p className="text-sm text-[--text-muted]">
                Dois gráficos de rosca exibem a proporção de cada componente sobre o total do período ativo.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[--border] bg-[--surface-2] p-4">
                  <p className="text-xs font-semibold text-foreground">Pizza de Receita</p>
                  <ul className="mt-2 space-y-1 text-xs text-[--text-muted] list-disc list-inside">
                    <li>Faturamento Bruto</li>
                    <li>Deduções</li>
                    <li>Receita Líquida</li>
                  </ul>
                  <p className="mt-2 text-xs text-[--text-muted]">Mostra como o faturamento se decompõe após descontar impostos e abatimentos.</p>
                </div>
                <div className="rounded-xl border border-[--border] bg-[--surface-2] p-4">
                  <p className="text-xs font-semibold text-foreground">Pizza de Despesa</p>
                  <ul className="mt-2 space-y-1 text-xs text-[--text-muted] list-disc list-inside">
                    <li>CMV / CPV</li>
                    <li>Despesas Operacionais</li>
                    <li>Resultado (residual)</li>
                  </ul>
                  <p className="mt-2 text-xs text-[--text-muted]">Mostra como a receita líquida é consumida entre custo direto, despesas e o resultado final.</p>
                </div>
              </div>
            </div>

            {/* Evolução do Resultado */}
            <div className="rounded-xl border border-[--border] bg-[--surface] p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Badge color="emerald">3</Badge>
                <h3 className="text-sm font-semibold text-foreground">Evolução do Resultado — gráfico de linha</h3>
              </div>
              <p className="text-sm text-[--text-muted]">
                Linha conectando o <strong className="text-foreground">Resultado Líquido</strong> de cada período.
                Uma linha de referência em zero facilita identificar meses/períodos lucrativos (acima de zero) e
                deficitários (abaixo de zero).
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[--border] bg-[--surface-2] p-3">
                  <p className="text-xs font-semibold text-foreground">Modo mensal</p>
                  <p className="mt-1 text-xs text-[--text-muted]">Um ponto por mês do ano — evolução completa do exercício.</p>
                </div>
                <div className="rounded-xl border border-[--border] bg-[--surface-2] p-3">
                  <p className="text-xs font-semibold text-foreground">Modo granular</p>
                  <p className="mt-1 text-xs text-[--text-muted]">Um ponto por mês do período ativo — foco no intervalo escolhido.</p>
                </div>
              </div>
            </div>

            {/* Comparativo */}
            <div className="rounded-xl border border-[--border] bg-[--surface] p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Badge color="amber">4</Badge>
                <h3 className="text-sm font-semibold text-foreground">Comparativo por empresa — visível apenas com múltiplas empresas</h3>
              </div>
              <p className="text-sm text-[--text-muted]">
                Quando duas ou mais empresas estão selecionadas, este gráfico aparece abaixo das pizzas.
                Exibe barras agrupadas: para cada ponto de período, há uma barra por empresa, permitindo
                comparar o <strong className="text-foreground">Resultado Líquido</strong> individualmente.
              </p>
              <InfoBox title="Quando aparece?" color="blue">
                O gráfico comparativo só é exibido com <strong>2 ou mais empresas</strong> selecionadas no seletor.
                Com uma única empresa, ele é ocultado automaticamente para não poluir a tela.
              </InfoBox>
            </div>
          </div>
        )}

        {/* ── Heatmap ── */}
        {active === "heatmap" && (
          <div className="space-y-6">

            <div className="rounded-2xl border border-[--border] bg-[--surface] p-6">
              <SectionTitle>Heatmap de Resultado por Empresa</SectionTitle>
              <p className="mt-3 text-sm text-[--text-muted] leading-relaxed">
                O heatmap é a última seção do dashboard. Ele apresenta o{" "}
                <strong className="text-foreground">Resultado Líquido</strong> de cada empresa em cada período por meio
                de cores — facilitando a identificação visual de tendências, sazonalidade e empresas que precisam de
                atenção.
              </p>
            </div>

            {/* Como ler */}
            <div className="rounded-xl border border-[--border] bg-[--surface] p-6 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Como ler o heatmap</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[--border] bg-[--surface-2] p-4">
                  <p className="text-xs font-semibold text-foreground">Linhas</p>
                  <p className="mt-1 text-sm text-[--text-muted]">Cada linha representa uma <strong className="text-foreground">empresa</strong> selecionada no filtro.</p>
                </div>
                <div className="rounded-xl border border-[--border] bg-[--surface-2] p-4">
                  <p className="text-xs font-semibold text-foreground">Colunas</p>
                  <p className="mt-1 text-sm text-[--text-muted]">Cada coluna representa um <strong className="text-foreground">período</strong> (mês ou intervalo) dentro do período ativo.</p>
                </div>
                <div className="rounded-xl border border-[--border] bg-[--surface-2] p-4">
                  <p className="text-xs font-semibold text-foreground">Células</p>
                  <p className="mt-1 text-sm text-[--text-muted]">Cor + valor do <strong className="text-foreground">Resultado Líquido</strong> naquele cruzamento empresa × período.</p>
                </div>
              </div>

              <SubTitle>Escala de cores</SubTitle>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    label: "Verde",
                    cls: "bg-emerald-100 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-300",
                    desc: "Resultado Líquido positivo — a empresa teve lucro naquele período.",
                  },
                  {
                    label: "Vermelho",
                    cls: "bg-red-100 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-700 dark:text-red-300",
                    desc: "Resultado Líquido negativo — a empresa teve prejuízo naquele período.",
                  },
                  {
                    label: "Cinza",
                    cls: "bg-zinc-100 border-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-400",
                    desc: "Sem dados — não há balancete importado para aquela empresa naquele mês.",
                  },
                  {
                    label: "Intensidade da cor",
                    cls: "bg-[--surface-2] border-[--border] text-foreground",
                    desc: "Quanto mais intenso o verde ou vermelho, maior a magnitude do resultado em relação às outras células.",
                  },
                ].map((item) => (
                  <div key={item.label} className={`rounded-xl border p-4 ${item.cls}`}>
                    <p className="text-xs font-semibold">{item.label}</p>
                    <p className="mt-1 text-sm opacity-90">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Colunas por filtro */}
            <div className="rounded-xl border border-[--border] bg-[--surface] p-6 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Quais colunas aparecem?</h3>
              <p className="text-sm text-[--text-muted]">
                As colunas do heatmap são definidas pela granularidade selecionada no filtro de período.
              </p>
              <div className="mt-2 space-y-2 sm:hidden">
                {[
                  { badge: "blue" as const,    label: "Mensal",     cols: "Todos os meses do ano selecionado que possuem dados (até 12 colunas)" },
                  { badge: "purple" as const,  label: "Bimestral",  cols: "Os 2 meses do período ativo (ex: Nov e Dez)" },
                  { badge: "amber" as const,   label: "Trimestral", cols: "Os 3 meses do período ativo (ex: Out, Nov e Dez)" },
                  { badge: "emerald" as const, label: "Semestral",  cols: "Os 6 meses do período ativo (ex: Jul a Dez)" },
                  { badge: "indigo" as const,  label: "Anual",      cols: "Os 12 meses do período ativo (todos os meses do ano)" },
                ].map((g) => (
                  <div key={g.label} className="flex items-start gap-3 rounded-xl border border-[--border] bg-[--surface-2] px-4 py-3">
                    <Badge color={g.badge}>{g.label}</Badge>
                    <p className="text-sm text-[--text-muted]">{g.cols}</p>
                  </div>
                ))}
              </div>
              <div className="mt-2 hidden sm:block overflow-hidden rounded-xl border border-[--border]">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-[--border] bg-[--surface-2] text-xs font-medium uppercase tracking-wide text-[--text-muted]">
                      <tr>
                        <th className="px-4 py-3 text-left">Granularidade</th>
                        <th className="px-4 py-3 text-left">Colunas do heatmap</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[--border]">
                      <tr className="bg-[--surface]">
                        <td className="px-4 py-3"><Badge color="blue">Mensal</Badge></td>
                        <td className="px-4 py-3 text-[--text-muted]">Todos os meses do ano selecionado que possuem dados em pelo menos uma empresa (até 12 colunas)</td>
                      </tr>
                      <tr className="bg-[--surface-2]">
                        <td className="px-4 py-3"><Badge color="purple">Bimestral</Badge></td>
                        <td className="px-4 py-3 text-[--text-muted]">Os 2 meses do período ativo (ex: Nov e Dez)</td>
                      </tr>
                      <tr className="bg-[--surface]">
                        <td className="px-4 py-3"><Badge color="amber">Trimestral</Badge></td>
                        <td className="px-4 py-3 text-[--text-muted]">Os 3 meses do período ativo (ex: Out, Nov e Dez)</td>
                      </tr>
                      <tr className="bg-[--surface-2]">
                        <td className="px-4 py-3"><Badge color="emerald">Semestral</Badge></td>
                        <td className="px-4 py-3 text-[--text-muted]">Os 6 meses do período ativo (ex: Jul a Dez)</td>
                      </tr>
                      <tr className="bg-[--surface]">
                        <td className="px-4 py-3"><Badge color="indigo">Anual</Badge></td>
                        <td className="px-4 py-3 text-[--text-muted]">Os 12 meses do período ativo (todos os meses do ano)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Layout responsivo */}
            <div className="rounded-xl border border-[--border] bg-[--surface] p-6 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Layout responsivo</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[--border] bg-[--surface-2] p-4">
                  <p className="text-xs font-semibold text-foreground">Telas menores (celular / tablet)</p>
                  <p className="mt-1 text-sm text-[--text-muted]">
                    O heatmap é exibido como <strong className="text-foreground">cartões empilhados</strong> — um cartão
                    por empresa, com cada mês disponível listado em linha com sua cor e valor.
                    Ideal para leitura vertical em dispositivos menores.
                  </p>
                </div>
                <div className="rounded-xl border border-[--border] bg-[--surface-2] p-4">
                  <p className="text-xs font-semibold text-foreground">Telas maiores (notebook / desktop)</p>
                  <p className="mt-1 text-sm text-[--text-muted]">
                    Tabela com scroll horizontal. A coluna de nome da empresa fica{" "}
                    <strong className="text-foreground">fixa (sticky)</strong> à esquerda ao rolar, facilitando a
                    leitura em tabelas com muitas colunas (semestral ou anual).
                  </p>
                </div>
              </div>
            </div>

            <InfoBox title="Dica de uso" color="emerald">
              Use o heatmap com granularidade <strong>Mensal</strong> para identificar meses com queda de resultado
              em determinadas empresas. Depois, use o filtro para focar naquela empresa e naquele mês específico
              para aprofundar a análise nos demais gráficos.
            </InfoBox>
          </div>
        )}

        {/* ── Sincronização & Notificações ── */}
        {active === "sincronizacao" && (
          <div className="space-y-6">

            <div className="rounded-2xl border border-[--border] bg-[--surface] p-6">
              <SectionTitle>Sincronização em tempo real</SectionTitle>
              <p className="mt-3 text-sm text-[--text-muted] leading-relaxed">
                O dashboard verifica automaticamente a cada <strong className="text-foreground">30 segundos</strong> se
                os dados de alguma empresa foram atualizados. Quando detecta uma mudança, exibe um{" "}
                <strong className="text-foreground">badge de desatualizado</strong> e registra uma{" "}
                <strong className="text-foreground">notificação</strong> no sino — sem precisar recarregar a página.
              </p>
            </div>

            {/* DataFreshnessBadge */}
            <div className="rounded-xl border border-[--border] bg-[--surface] p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Badge color="emerald">Badge de status</Badge>
                <h3 className="text-sm font-semibold text-foreground">Badge de atualização de dados</h3>
              </div>
              <p className="text-sm text-[--text-muted]">
                Aparece no topo do dashboard quando o sistema detecta que os dados foram modificados após o último carregamento.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">✓ Sincronizado</p>
                  <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                    Badge verde. Os dados exibidos estão atualizados com o servidor.
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/40 dark:bg-amber-950/20">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">⚠ Desatualizado · Sincronizar</p>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                    Badge âmbar clicável. Indica que alguém importou, excluiu ou recalculou dados.
                    Clique para recarregar o dashboard imediatamente.
                  </p>
                </div>
              </div>
              <InfoBox title="Como funciona o Sincronizar?" color="blue">
                Clicar em <strong>Sincronizar</strong> invalida o cache local e busca os dados atualizados do servidor.
                O badge volta para <strong>Sincronizado</strong> após a recarga.
              </InfoBox>
            </div>

            {/* NotificationsBell */}
            <div className="rounded-xl border border-[--border] bg-[--surface] p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Badge color="blue">Notificações</Badge>
                <h3 className="text-sm font-semibold text-foreground">Sino de notificações</h3>
              </div>
              <p className="text-sm text-[--text-muted]">
                O sino de notificações fica no canto superior direito da barra do dashboard.
                Um <strong className="text-foreground">badge vermelho</strong> mostra a quantidade de notificações não lidas.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 mt-2">
                <div className="rounded-xl border border-[--border] bg-[--surface-2] p-4">
                  <p className="text-xs font-semibold text-foreground">Não lidas (padrão)</p>
                  <p className="mt-1 text-sm text-[--text-muted]">
                    Ao abrir o sino, apenas as notificações não lidas são exibidas. Cada item mostra:
                    empresa, descrição da ação e tempo relativo (ex: &ldquo;há 2 min&rdquo;).
                  </p>
                </div>
                <div className="rounded-xl border border-[--border] bg-[--surface-2] p-4">
                  <p className="text-xs font-semibold text-foreground">Histórico</p>
                  <p className="mt-1 text-sm text-[--text-muted]">
                    Clique em <em>Ver histórico</em> para ver também as notificações já lidas.
                    O rodapé indica quantas notificações já foram lidas.
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[--text-muted]">Ações disponíveis</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { label: "✓ Marcar como lida", desc: "Clique no ícone de check em uma notificação para marcá-la como lida individualmente." },
                    { label: "Marcar todas como lidas", desc: "Botão no topo do dropdown para marcar todas as notificações como lidas de uma vez." },
                    { label: "Ver histórico / Ocultar", desc: "Alterna entre exibir apenas não lidas e exibir todo o histórico de notificações." },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-[--border] bg-[--surface-2] p-3">
                      <p className="text-xs font-semibold text-foreground">{item.label}</p>
                      <p className="mt-1 text-xs text-[--text-muted]">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* O que dispara uma notificação */}
            <div className="rounded-xl border border-[--border] bg-[--surface] p-6 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">O que dispara uma notificação?</h3>
              <p className="text-sm text-[--text-muted]">
                Qualquer operação que mude os dados de uma empresa gera uma notificação para <strong className="text-foreground">todos os usuários</strong> com
                acesso àquela empresa — incluindo usuários CLIENT visualizando o dashboard em outro browser.
              </p>
              <div className="mt-2 hidden sm:block overflow-hidden rounded-xl border border-[--border]">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-[--border] bg-[--surface-2] text-xs font-medium uppercase tracking-wide text-[--text-muted]">
                    <tr>
                      <th className="px-4 py-3 text-left">Operação</th>
                      <th className="px-4 py-3 text-left">Mensagem na notificação</th>
                      <th className="px-4 py-3 text-left">Quem realiza</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[--border]">
                    <tr className="bg-[--surface]">
                      <td className="px-4 py-3"><Badge color="blue">Import</Badge></td>
                      <td className="px-4 py-3 text-[--text-muted]">Novo balancete importado · &lt;Mês/Ano&gt;</td>
                      <td className="px-4 py-3"><Badge color="red">ADMIN</Badge></td>
                    </tr>
                    <tr className="bg-[--surface-2]">
                      <td className="px-4 py-3"><Badge color="red">Exclusão</Badge></td>
                      <td className="px-4 py-3 text-[--text-muted]">Balancete de &lt;Mês/Ano&gt; excluído</td>
                      <td className="px-4 py-3"><Badge color="red">ADMIN</Badge></td>
                    </tr>
                    <tr className="bg-[--surface]">
                      <td className="px-4 py-3"><Badge color="amber">Recálculo</Badge></td>
                      <td className="px-4 py-3 text-[--text-muted]">Dados recalculados · &lt;Mês/Ano&gt;</td>
                      <td className="px-4 py-3"><Badge color="red">ADMIN</Badge></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-2 space-y-2 sm:hidden">
                {[
                  { badge: "blue" as const, op: "Import", msg: "Novo balancete importado · <Mês/Ano>" },
                  { badge: "red" as const, op: "Exclusão", msg: "Balancete de <Mês/Ano> excluído" },
                  { badge: "amber" as const, op: "Recálculo", msg: "Dados recalculados · <Mês/Ano>" },
                ].map((item) => (
                  <div key={item.op} className="rounded-xl border border-[--border] bg-[--surface-2] p-3 space-y-1">
                    <Badge color={item.badge}>{item.op}</Badge>
                    <p className="text-xs text-[--text-muted]">{item.msg} — realizado por <Badge color="red">ADMIN</Badge></p>
                  </div>
                ))}
              </div>
            </div>

            {/* Empresas monitoradas */}
            <InfoBox title="Quais empresas são monitoradas?" color="blue">
              O sistema monitora <strong>todas as empresas</strong> que o seu usuário tem acesso —
              não apenas a empresa selecionada no filtro. Se outra empresa for atualizada enquanto
              você está visualizando outra, a notificação ainda será exibida.
            </InfoBox>

          </div>
        )}

      </div>
    </AppShell>
  );
}
