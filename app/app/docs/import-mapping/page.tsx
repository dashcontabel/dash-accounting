"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import AppShell from "@/app/components/app-shell";

type MeResponse = {
  user?: { id: string; email: string; role: "ADMIN" | "CLIENT" };
};

type Section = "negocio" | "funcional" | "operacoes" | "formato" | "tecnico";

const SECTIONS: { id: Section; label: string; shortLabel: string; icon: React.ReactNode }[] = [
  {
    id: "negocio",
    label: "Visão de Negócio",
    shortLabel: "Negócio",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: "funcional",
    label: "Visão Funcional",
    shortLabel: "Funcional",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
  },
  {
    id: "operacoes",
    label: "Operações",
    shortLabel: "Operações",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    id: "formato",
    label: "Formato do Arquivo",
    shortLabel: "Formato",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: "tecnico",
    label: "Visão Técnica",
    shortLabel: "Técnica",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
];

function Badge({ color, children }: { color: "blue" | "emerald" | "amber" | "purple" | "red" | "zinc"; children: React.ReactNode }) {
  const cls: Record<string, string> = {
    blue:    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    amber:   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    purple:  "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    red:     "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    zinc:    "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls[color]}`}>
      {children}
    </span>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
          {number}
        </div>
        <div className="mt-1 w-px flex-1 bg-[--border]" />
      </div>
      <div className="min-w-0 flex-1 pb-6">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <div className="mt-1 text-sm text-[--text-muted]">{children}</div>
      </div>
    </div>
  );
}

function InfoBox({ title, children, color = "blue" }: { title: string; children: React.ReactNode; color?: "blue" | "amber" | "emerald" }) {
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

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[--border] bg-zinc-900 dark:bg-zinc-950">
      <pre className="p-4 text-xs leading-relaxed text-zinc-100 whitespace-pre min-w-max">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-foreground">{children}</h2>;
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-[--text-muted]">{children}</h3>;
}

export default function ImportMappingDocsPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse["user"]>();
  const [active, setActive] = useState<Section>("negocio");

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: MeResponse) => {
        if (!data.user) { router.push("/login"); return; }
        if (data.user.role !== "ADMIN") { router.replace("/"); return; }
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
                <Badge color="zinc">Fluxo</Badge>
              </div>
              <h1 className="mt-2 text-xl font-bold text-foreground">Importação & Mapeamento de Contas</h1>
              <p className="mt-1 text-sm text-[--text-muted]">
                Como o balancete XLSX vira os indicadores do dashboard — visão de negócio, funcional e técnica.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {me?.role === "ADMIN" && (
                <>
                  <Link
                    href="/app/imports"
                    className="rounded-xl border border-[--border] bg-[--surface] px-3 py-2 text-xs font-medium text-foreground hover:bg-[--border] transition-colors"
                  >
                    → Importações
                  </Link>
                  <Link
                    href="/app/admin/mappings"
                    className="rounded-xl border border-[--border] bg-[--surface] px-3 py-2 text-xs font-medium text-foreground hover:bg-[--border] transition-colors"
                  >
                    → Mapeamentos
                  </Link>
                </>
              )}
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

        {/* ── Visão de Negócio ── */}
        {active === "negocio" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-[--border] bg-[--surface] p-6">
              <SectionTitle>Para que serve este fluxo?</SectionTitle>
              <p className="mt-3 text-sm text-[--text-muted] leading-relaxed">
                Escritórios contábeis produzem mensalmente um <strong className="text-foreground">Balancete de Verificação</strong> — uma
                planilha XLSX com todas as contas da empresa e seus saldos. Esse arquivo segue a estrutura do Plano de Contas (ex: <code className="rounded bg-[--surface-2] px-1 py-0.5 text-xs">4.1.1 Faturamento de Serviços</code>).
              </p>
              <p className="mt-3 text-sm text-[--text-muted] leading-relaxed">
                O problema: cada empresa usa um plano de contas diferente, com códigos próprios.
                O <strong className="text-foreground">fluxo de importação com mapeamento</strong> resolve isso — o admin configura uma vez
                como os códigos se traduzem nos indicadores do dashboard (Faturamento, Despesas, etc.)
                e, a partir daí, qualquer importação gera automaticamente os KPIs corretos.
              </p>
            </div>

            <div>
              <SubTitle>O que o negócio ganha</SubTitle>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { title: "Visibilidade mensal", desc: "Indicadores financeiros atualizados a cada upload, sem digitação manual.", color: "emerald" as const },
                  { title: "Padronização", desc: "Mesmo dashboard para todas as empresas, independente do plano de contas usado.", color: "blue" as const },
                  { title: "Idempotência", desc: "Reimportar o mesmo arquivo não duplica dados — o sistema detecta e reprocessa com os mapeamentos mais atuais.", color: "purple" as const },
                  { title: "Rastreabilidade", desc: "Cada import fica registrado com data, arquivo, status e linhas processadas.", color: "amber" as const },
                  { title: "Autonomia do admin", desc: "Mapeamentos podem ser ajustados sem código, diretamente na interface.", color: "blue" as const },
                  { title: "Segurança", desc: "Apenas admins importam. Clientes só visualizam. CNPJ do arquivo é validado contra a empresa.", color: "red" as const },
                ].map((item) => (
                  <div key={item.title} className="rounded-xl border border-[--border] bg-[--surface-2] p-4">
                    <Badge color={item.color}>{item.title}</Badge>
                    <p className="mt-2 text-sm text-[--text-muted]">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <InfoBox title="Impacto de uma alteração de mapeamento" color="amber">
              Alterar um mapeamento <strong>não recalcula</strong> dados já importados automaticamente.
              Para refletir a mudança em períodos anteriores, basta <strong>reimportar o arquivo</strong> daquele mês —
              o sistema detecta o arquivo já existente e reaplica os mapeamentos atuais.
            </InfoBox>

            <div>
              <SubTitle>Fluxo resumido</SubTitle>
              <div className="mt-3 rounded-xl border border-[--border] bg-[--surface] p-5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {[
                    "Balancete XLSX",
                    "→",
                    "Upload pelo Admin",
                    "→",
                    "Validação (CNPJ, formato)",
                    "→",
                    "Aplicação dos Mapeamentos",
                    "→",
                    "Resumo no Dashboard",
                  ].map((item, i) => (
                    item === "→"
                      ? <span key={i} className="text-[--text-muted]">→</span>
                      : <Badge key={i} color={i === 0 ? "zinc" : i === 8 ? "emerald" : "blue"}>{item}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Visão Funcional ── */}
        {active === "funcional" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-[--border] bg-[--surface] p-6">
              <SectionTitle>Passo a passo para o administrador</SectionTitle>
              <p className="mt-2 text-sm text-[--text-muted]">O que fazer na prática para que o dashboard exiba os dados de uma empresa.</p>
            </div>

            <div className="rounded-xl border border-[--border] bg-[--surface] p-6">
              <Step number={1} title="Cadastrar a empresa">
                Acesse <strong>Empresas</strong> e crie a empresa com CNPJ e grupo. O sistema usará o CNPJ para validar
                se o arquivo enviado pertence à empresa correta.
              </Step>
              <Step number={2} title="Vincular um usuário à empresa">
                Em <strong>Usuários</strong>, edite ou crie um usuário do tipo <Badge color="blue">CLIENT</Badge> e
                selecione a empresa. Usuários CLIENT veem apenas os dados das empresas vinculadas.
              </Step>
              <Step number={3} title="Configurar os mapeamentos (uma vez)">
                Acesse <strong>Mapeamentos</strong> e clique em <em>Inicializar Padrão</em> para carregar as regras
                de referência. Ajuste os <strong>códigos de conta</strong> conforme o plano de contas da empresa.
                <div className="mt-3 rounded-lg border border-[--border] bg-[--surface-2] p-3 text-xs text-[--text-muted]">
                  <p><strong className="text-foreground">Exemplo:</strong> para mapear Faturamento, configure o campo <code>FATURAMENTO</code> com tipo <Badge color="zinc">PREFIX</Badge> e código <code>4.1.1</code>.
                  Isso captura todas as contas cujo código começa com <code>4.1.1</code> (ex: 4.1.1.01, 4.1.1.02...).</p>
                </div>
              </Step>
              <Step number={4} title="Importar o balancete XLSX">
                Acesse <strong>Importações</strong>, selecione a empresa, o mês de referência e o arquivo.
                Clique em <em>Importar XLSX</em>. O sistema processa e grava o resumo.
              </Step>
              <Step number={5} title="Verificar o dashboard">
                Acesse o <strong>Dashboard</strong>, selecione a empresa e o mês. Os KPIs calculados estarão disponíveis.
                Contas que não foram mapeadas ficam visíveis na seção <em>Contas não mapeadas</em> dos detalhes do import.
              </Step>
            </div>

            <div>
              <SubTitle>Tipos de mapeamento disponíveis</SubTitle>

              {/* Mobile: cards */}
              <div className="mt-3 sm:hidden space-y-2">
                {[
                  { color: "blue"    as const, label: "PREFIX",    desc: "Captura todas as contas cujo código começa com o prefixo",     ex: "4.1 → captura 4.1.1, 4.1.2.01…" },
                  { color: "purple"  as const, label: "EXACT",     desc: "Captura apenas a conta com o código exato",                     ex: "4.1.1.001 → só essa conta" },
                  { color: "amber"   as const, label: "LIST",      desc: "Captura uma lista específica de códigos exatos",               ex: "4.1.1, 4.2.3 → só essas duas" },
                  { color: "emerald" as const, label: "Calculado", desc: "Valor derivado de outros campos via fórmula aritmética",       ex: "{FATURAMENTO} - {DEDUCOES}" },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl border border-[--border] bg-[--surface-2] p-4 space-y-2">
                    <Badge color={m.color}>{m.label}</Badge>
                    <p className="text-sm text-[--text-muted]">{m.desc}</p>
                    <code className="block rounded-lg bg-[--surface] px-3 py-1.5 font-mono text-xs text-[--text-muted]">{m.ex}</code>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="mt-3 hidden sm:block overflow-x-auto rounded-xl border border-[--border]">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-[--border] bg-[--surface-2] text-xs font-medium uppercase tracking-wide text-[--text-muted]">
                      <tr>
                        <th className="px-4 py-3 text-left">Tipo</th>
                        <th className="px-4 py-3 text-left">Comportamento</th>
                        <th className="px-4 py-3 text-left">Exemplo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[--border]">
                      <tr className="bg-[--surface]">
                        <td className="px-4 py-3"><Badge color="blue">PREFIX</Badge></td>
                        <td className="px-4 py-3 text-[--text-muted]">Captura todas as contas cujo código começa com o prefixo</td>
                        <td className="px-4 py-3 font-mono text-xs text-[--text-muted]"><code>4.1</code> → captura 4.1.1, 4.1.2.01…</td>
                      </tr>
                      <tr className="bg-[--surface-2]">
                        <td className="px-4 py-3"><Badge color="purple">EXACT</Badge></td>
                        <td className="px-4 py-3 text-[--text-muted]">Captura apenas a conta com o código exato</td>
                        <td className="px-4 py-3 font-mono text-xs text-[--text-muted]"><code>4.1.1.001</code> → só essa conta</td>
                      </tr>
                      <tr className="bg-[--surface]">
                        <td className="px-4 py-3"><Badge color="amber">LIST</Badge></td>
                        <td className="px-4 py-3 text-[--text-muted]">Captura uma lista específica de códigos exatos</td>
                        <td className="px-4 py-3 font-mono text-xs text-[--text-muted]"><code>4.1.1, 4.2.3</code> → só essas duas</td>
                      </tr>
                      <tr className="bg-[--surface-2]">
                        <td className="px-4 py-3"><Badge color="emerald">Calculado</Badge></td>
                        <td className="px-4 py-3 text-[--text-muted]">Valor derivado de outros campos via fórmula aritmética</td>
                        <td className="px-4 py-3 font-mono text-xs text-[--text-muted]"><code>{"{FATURAMENTO} - {DEDUCOES}"}</code></td>
                      </tr>
                    </tbody>
                  </table>
              </div>
            </div>

            <div>
              <SubTitle>Colunas do balancete reconhecidas</SubTitle>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  { col: "credito", desc: "Total de créditos do período" },
                  { col: "debito", desc: "Total de débitos do período" },
                  { col: "saldo_atual", desc: "Saldo acumulado ao final do mês" },
                  { col: "saldo_anterior", desc: "Saldo acumulado do mês anterior" },
                ].map((item) => (
                  <div key={item.col} className="flex items-center gap-3 rounded-xl border border-[--border] bg-[--surface] px-4 py-3">
                    <code className="rounded bg-[--surface-2] px-2 py-1 text-xs font-mono text-foreground">{item.col}</code>
                    <span className="text-sm text-[--text-muted]">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <InfoBox title="Contas não mapeadas" color="amber">
              Após cada import, o sistema registra todas as contas do balancete que <strong>não foram capturadas</strong> por nenhuma regra.
              Você pode visualizá-las no detalhe de cada import (botão <em>Ver detalhes</em>).
              Use essa lista para identificar contas que precisam ser adicionadas aos mapeamentos.
            </InfoBox>
          </div>
        )}

        {/* ── Operações ── */}
        {active === "operacoes" && (
          <div className="space-y-6">

            <div className="rounded-2xl border border-[--border] bg-[--surface] p-6">
              <SectionTitle>Operações de importação</SectionTitle>
              <p className="mt-2 text-sm text-[--text-muted]">
                O sistema oferece três modos de importação e as operações de exclusão e recálculo.
                Todas as ações são restritas ao role <Badge color="red">ADMIN</Badge>.
              </p>
            </div>

            {/* Import único */}
            <div className="rounded-xl border border-[--border] bg-[--surface] p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Badge color="blue">1</Badge>
                <h3 className="text-sm font-semibold text-foreground">Import único</h3>
              </div>
              <p className="text-sm text-[--text-muted]">
                Upload de um único arquivo XLSX para uma empresa e mês específicos.
                Você escolhe a empresa, o mês de referência e o arquivo.
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[--border] bg-[--surface-2] p-4">
                  <p className="text-xs font-semibold text-foreground">Mês de referência</p>
                  <p className="mt-1 text-sm text-[--text-muted]">
                    Pode ser informado manualmente ou detectado automaticamente do cabeçalho do arquivo.
                    O campo do formulário tem prioridade sobre o valor do arquivo.
                  </p>
                </div>
                <div className="rounded-xl border border-[--border] bg-[--surface-2] p-4">
                  <p className="text-xs font-semibold text-foreground">Resultado inline</p>
                  <p className="mt-1 text-sm text-[--text-muted]">
                    Após a importação, o resumo calculado (KPIs) é exibido diretamente no card do import.
                    Clique em <em>Ver detalhes</em> para ver contas não mapeadas.
                  </p>
                </div>
              </div>
            </div>

            {/* Import em lote */}
            <div className="rounded-xl border border-[--border] bg-[--surface] p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Badge color="purple">2</Badge>
                <h3 className="text-sm font-semibold text-foreground">Import em lote</h3>
              </div>
              <p className="text-sm text-[--text-muted]">
                Permite enviar até <strong className="text-foreground">12 arquivos de uma vez</strong> para a mesma empresa.
                Ideal para preencher vários meses do histórico de uma só vez.
                O mês de referência é detectado automaticamente do cabeçalho de cada arquivo — não é possível informar manualmente no modo lote.
              </p>
              <InfoBox title="Como usar o import em lote" color="blue">
                <ol className="ml-4 mt-1 list-decimal space-y-1">
                  <li>Ative a opção <strong>Importar em lote</strong> na tela de Importações.</li>
                  <li>Selecione até 12 arquivos XLSX de uma vez.</li>
                  <li>Clique em <strong>Importar todos</strong>. Cada arquivo é processado sequencialmente.</li>
                  <li>O resultado de cada arquivo é exibido individualmente (sucesso, aviso ou erro).</li>
                </ol>
              </InfoBox>
              <div className="grid gap-3 sm:grid-cols-2 mt-2">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Arquivo processado com sucesso</p>
                  <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">Exibido com ✓ e "Importado com sucesso."</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/40 dark:bg-amber-950/20">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Arquivo já importado (mesmo conteúdo)</p>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">Exibido com aviso — o sistema reaplica os mapeamentos sem criar duplicata.</p>
                </div>
              </div>
            </div>

            {/* Excluir import */}
            <div className="rounded-xl border border-[--border] bg-[--surface] p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Badge color="red">3</Badge>
                <h3 className="text-sm font-semibold text-foreground">Excluir um import</h3>
              </div>
              <p className="text-sm text-[--text-muted]">
                A exclusão de um import remove permanentemente o batch, todas as suas{" "}
                <strong className="text-foreground">entradas contábeis</strong> (LedgerEntry) e as{" "}
                <strong className="text-foreground">contas não mapeadas</strong> (UnmappedAccount).
                Se for o último import do mês para aquela empresa, o{" "}
                <strong className="text-foreground">resumo do dashboard</strong> (DashboardMonthlySummary) também é removido.
              </p>
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800/40 dark:bg-red-950/20">
                <p className="text-xs font-semibold text-red-700 dark:text-red-300">Ação irreversível</p>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  A exclusão não pode ser desfeita. Após excluir, o mês ficará sem dados no dashboard.
                  Para restaurar, reimporte o arquivo.
                </p>
              </div>
              <InfoBox title="Quando excluir?" color="amber">
                Use a exclusão quando precisar <strong>corrigir dados de um mês já importado</strong> com um arquivo diferente.
                O sistema bloqueia a reimportação de um arquivo diferente para o mesmo mês enquanto o import original existir —
                exclua o import existente primeiro, depois reimporte o arquivo correto.
              </InfoBox>
            </div>

            {/* Recalcular */}
            <div className="rounded-xl border border-[--border] bg-[--surface] p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Badge color="amber">4</Badge>
                <h3 className="text-sm font-semibold text-foreground">Recalcular resumo</h3>
              </div>
              <p className="text-sm text-[--text-muted]">
                O botão <strong className="text-foreground">Recalcular</strong> no dashboard reaplica os mapeamentos atuais
                sobre os dados já importados de um mês específico, atualizando o{" "}
                <strong className="text-foreground">DashboardMonthlySummary</strong> sem precisar reimportar o arquivo.
              </p>
              <InfoBox title="Quando usar?" color="blue">
                Use o recálculo após <strong>alterar mapeamentos de conta</strong>. O recálculo
                reflete imediatamente as novas regras nos KPIs do dashboard sem a necessidade de
                excluir e reimportar o arquivo.
              </InfoBox>
            </div>

            {/* Notificações em tempo real */}
            <div className="rounded-xl border border-[--border] bg-[--surface] p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Badge color="indigo">5</Badge>
                <h3 className="text-sm font-semibold text-foreground">Notificações em tempo real</h3>
              </div>
              <p className="text-sm text-[--text-muted]">
                Após qualquer operação (import, exclusão ou recálculo), o dashboard detecta automaticamente a mudança
                e notifica todos os usuários que têm acesso à empresa afetada — incluindo usuários CLIENT que estão
                visualizando o dashboard em tempo real.
              </p>
              <div className="grid gap-3 sm:grid-cols-3 mt-2">
                {[
                  { badge: "blue" as const, label: "Import", desc: "Novo balancete importado · <Mês/Ano> — exibido no sino de notificações." },
                  { badge: "red" as const, label: "Exclusão", desc: "Balancete de <Mês/Ano> excluído — notificação e badge de desatualizado ativados." },
                  { badge: "amber" as const, label: "Recálculo", desc: "Dados recalculados · <Mês/Ano> — dashboard atualiza no próximo ciclo de polling (30 s)." },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-[--border] bg-[--surface-2] p-4">
                    <Badge color={item.badge}>{item.label}</Badge>
                    <p className="mt-2 text-sm text-[--text-muted]">{item.desc}</p>
                  </div>
                ))}
              </div>
              <InfoBox title="Mecanismo de detecção" color="blue">
                O dashboard faz polling a cada <strong>30 segundos</strong> no endpoint{" "}
                <code className="rounded bg-[--surface] px-1 text-xs">/api/dashboard/freshness</code>.
                Quando detecta que os dados mudaram, exibe o badge <strong>Desatualizado · Sincronizar</strong>
                e adiciona uma notificação no sino. O usuário pode clicar em <strong>Sincronizar</strong> para
                recarregar os dados imediatamente.
              </InfoBox>
            </div>

          </div>
        )}

        {/* ── Formato do Arquivo ── */}
        {active === "formato" && (
          <div className="space-y-6">

            {/* Requisitos gerais */}
            <div className="rounded-2xl border border-[--border] bg-[--surface] p-6">
              <SectionTitle>Requisitos do arquivo</SectionTitle>
              <p className="mt-2 text-sm text-[--text-muted]">
                O sistema aceita arquivos nos formatos <strong className="text-foreground">.xlsx</strong>, <strong className="text-foreground">.xls</strong> e <strong className="text-foreground">.csv</strong>.
                Outros formatos (ex: <code className="rounded bg-[--surface-2] px-1 py-0.5 text-xs">.ods</code>, <code className="rounded bg-[--surface-2] px-1 py-0.5 text-xs">.numbers</code>) <strong>não são aceitos</strong>.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="flex items-center gap-3 rounded-xl border border-[--border] bg-[--surface-2] px-4 py-3">
                  <span className="text-lg">📄</span>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Formatos aceitos</p>
                    <p className="text-xs text-[--text-muted]"><code>.xlsx</code> · <code>.xls</code> · <code>.csv</code></p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-[--border] bg-[--surface-2] px-4 py-3">
                  <span className="text-lg">⚖️</span>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Tamanho máximo</p>
                    <p className="text-xs text-[--text-muted]">10 MB por arquivo</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-[--border] bg-[--surface-2] px-4 py-3">
                  <span className="text-lg">📑</span>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Abas</p>
                    <p className="text-xs text-[--text-muted]">1 ou mais — CSV não tem abas</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Seleção de aba */}
            <div className="rounded-xl border border-[--border] bg-[--surface] p-6">
              <h3 className="text-sm font-semibold text-foreground">Qual aba é lida?</h3>
              <p className="mt-2 text-sm text-[--text-muted]">
                O sistema escolhe automaticamente qual aba processar seguindo esta ordem de prioridade:
              </p>
              <ol className="mt-4 space-y-2 text-sm">
                {[
                  { badge: "1º", color: "emerald" as const, text: <>Aba chamada exatamente <code className="rounded bg-[--surface-2] px-1 text-xs">Balancete</code></> },
                  { badge: "2º", color: "blue" as const,    text: <>Aba chamada <code className="rounded bg-[--surface-2] px-1 text-xs">Balancete de Verificacao</code> (com ou sem acentuação)</> },
                  { badge: "3º", color: "blue" as const,    text: <>Aba chamada <code className="rounded bg-[--surface-2] px-1 text-xs">Trial Balance</code> (exportações em inglês)</> },
                  { badge: "4º", color: "amber" as const,   text: "Primeira aba do arquivo (fallback se nenhum dos nomes acima for encontrado)" },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Badge color={item.badge === "4º" ? item.color : item.color}>{item.badge}</Badge>
                    <span className="text-[--text-muted]">{item.text}</span>
                  </li>
                ))}
              </ol>
              <InfoBox title="Dica" color="blue">
                Se o seu balancete tem múltiplas abas (ex: resumo + detalhe), renomeie a aba do balancete analítico para <strong>Balancete</strong> e o sistema a encontrará automaticamente.
                Arquivos <code className="rounded bg-[--surface] px-1 text-xs">.csv</code> não possuem abas — o único conteúdo do arquivo é processado diretamente.
              </InfoBox>
            </div>

            {/* Estrutura da planilha */}
            <div className="rounded-xl border border-[--border] bg-[--surface] p-3 sm:p-6 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Estrutura esperada da planilha</h3>
              <p className="text-sm text-[--text-muted]">
                O sistema <strong className="text-foreground">detecta automaticamente</strong> o cabeçalho — ele pode estar em qualquer linha dentro das primeiras <strong className="text-foreground">40 linhas</strong>. As linhas antes do cabeçalho são interpretadas como metadados (onde CNPJ e período são extraídos).
              </p>

              {/* Exemplo visual de layout */}
              <div className="overflow-x-auto rounded-xl border border-[--border]">
                <table className="min-w-160 text-xs">
                  <thead>
                    <tr className="border-b border-[--border] bg-zinc-800 text-zinc-300">
                      <th className="px-3 py-2 text-left font-mono whitespace-nowrap">A</th>
                      <th className="px-3 py-2 text-left font-mono whitespace-nowrap">B</th>
                      <th className="px-3 py-2 text-left font-mono whitespace-nowrap">C</th>
                      <th className="px-3 py-2 text-left font-mono whitespace-nowrap">D</th>
                      <th className="px-3 py-2 text-left font-mono whitespace-nowrap">E</th>
                      <th className="px-3 py-2 text-left font-mono whitespace-nowrap">F</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[--border] text-xs">
                    <tr className="bg-amber-50 dark:bg-amber-950/20">
                      <td className="px-3 py-2 text-amber-700 dark:text-amber-300 whitespace-nowrap" colSpan={6}>Empresa XYZ Ltda — CNPJ: 12.345.678/0001-99 — Período: 01/01/2026 - 31/01/2026</td>
                    </tr>
                    <tr className="bg-[--surface-2]">
                      <td className="px-3 py-2 text-[--text-muted]" colSpan={6}><em>(linhas de metadados adicionais, se houver)</em></td>
                    </tr>
                    <tr className="bg-blue-50 dark:bg-blue-950/20 font-semibold text-blue-700 dark:text-blue-300">
                      <td className="px-3 py-2 whitespace-nowrap">Classificação</td>
                      <td className="px-3 py-2 whitespace-nowrap">Descrição</td>
                      <td className="px-3 py-2 whitespace-nowrap">Saldo Anterior</td>
                      <td className="px-3 py-2 whitespace-nowrap">Débito</td>
                      <td className="px-3 py-2 whitespace-nowrap">Crédito</td>
                      <td className="px-3 py-2 whitespace-nowrap">Saldo Atual</td>
                    </tr>
                    <tr className="bg-[--surface]">
                      <td className="px-3 py-2 font-mono whitespace-nowrap">4.1.1</td>
                      <td className="px-3 py-2">Receita de Serviços</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">0,00</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">0,00</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">150.000,00</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">150.000,00</td>
                    </tr>
                    <tr className="bg-[--surface-2]">
                      <td className="px-3 py-2 font-mono whitespace-nowrap">4.1.1.01</td>
                      <td className="px-3 py-2">Serviços de Consultoria</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">0,00</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">0,00</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">80.000,00</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">80.000,00</td>
                    </tr>
                    <tr className="bg-[--surface]">
                      <td className="px-3 py-2 font-mono whitespace-nowrap">5.1.1</td>
                      <td className="px-3 py-2">Despesas com Pessoal</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">0,00</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">45.000,00</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">0,00</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">(45.000,00)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1 dark:bg-amber-950/20"><span className="h-2 w-2 rounded-full bg-amber-400"></span> Metadados (CNPJ, período)</span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2 py-1 dark:bg-blue-950/20"><span className="h-2 w-2 rounded-full bg-blue-400"></span> Linha de cabeçalho (detectada automaticamente)</span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[--surface-2] px-2 py-1"><span className="h-2 w-2 rounded-full bg-zinc-400"></span> Linhas de dados</span>
              </div>
            </div>

            {/* Colunas obrigatórias e opcionais */}
            <div className="rounded-xl border border-[--border] bg-[--surface] p-6">
              <h3 className="text-sm font-semibold text-foreground">Colunas reconhecidas</h3>
              <p className="mt-2 text-sm text-[--text-muted]">O sistema identifica colunas pelos nomes — não pela posição. Os nomes aceitos (case/acento insensitive):</p>

              {/* Mobile: cards */}
              <div className="mt-3 sm:hidden space-y-2">
                {[
                  { col: "Código da conta", req: true,  names: "Classificação, Classificacao, Código Conta, Codigo Conta, Código, Codigo" },
                  { col: "Descrição",        req: false, names: "Descrição, Descricao, Conta, Nome, Descricao Conta" },
                  { col: "Saldo Anterior",   req: false, names: "Saldo Anterior, Saldo Original, Saldo Inicial" },
                  { col: "Débito",           req: false, names: "Débito, Debito, Débitos, Debitos" },
                  { col: "Crédito",          req: false, names: "Crédito, Credito, Créditos, Creditos" },
                  { col: "Saldo Atual",      req: false, names: "Saldo Atual, Saldo Final" },
                ].map((r) => (
                  <div key={r.col} className="rounded-xl border border-[--border] bg-[--surface-2] p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{r.col}</span>
                      {r.req ? <Badge color="red">Obrigatória</Badge> : <Badge color="zinc">Opcional</Badge>}
                    </div>
                    <p className="font-mono text-xs text-[--text-muted] wrap-break-word">{r.names}</p>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="mt-4 hidden sm:block overflow-x-auto rounded-xl border border-[--border]">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-[--border] bg-[--surface-2] text-xs font-medium uppercase tracking-wide text-[--text-muted]">
                    <tr>
                      <th className="px-4 py-3 text-left whitespace-nowrap">Coluna</th>
                      <th className="px-4 py-3 text-left whitespace-nowrap">Obrigatória?</th>
                      <th className="px-4 py-3 text-left">Nomes aceitos no cabeçalho</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[--border] text-sm">
                    {[
                      { col: "Código da conta", req: true,  names: "Classificação, Classificacao, Código Conta, Codigo Conta, Código, Codigo" },
                      { col: "Descrição",        req: false, names: "Descrição, Descricao, Conta, Nome, Descricao Conta" },
                      { col: "Saldo Anterior",   req: false, names: "Saldo Anterior, Saldo Original, Saldo Inicial" },
                      { col: "Débito",           req: false, names: "Débito, Debito, Débitos, Debitos" },
                      { col: "Crédito",          req: false, names: "Crédito, Credito, Créditos, Creditos" },
                      { col: "Saldo Atual",      req: false, names: "Saldo Atual, Saldo Final" },
                    ].map((r) => (
                      <tr key={r.col} className="bg-[--surface] hover:bg-[--surface-2] transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{r.col}</td>
                        <td className="px-4 py-3">
                          {r.req
                            ? <Badge color="red">Obrigatória</Badge>
                            : <Badge color="zinc">Opcional</Badge>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[--text-muted]">{r.names}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <InfoBox title="Atenção" color="amber">
                É obrigatória a coluna de código <strong>e ao menos uma coluna de valor</strong> (saldo anterior, débito, crédito ou saldo atual). Sem elas, o arquivo é rejeitado.
                Quanto mais colunas presentes, mais flexibilidade nos mapeamentos.
              </InfoBox>
            </div>

            {/* Código de conta */}
            <div className="rounded-xl border border-[--border] bg-[--surface] p-6">
              <h3 className="text-sm font-semibold text-foreground">Formato do código de conta</h3>
              <p className="mt-2 text-sm text-[--text-muted]">
                Os códigos devem seguir o padrão de <strong className="text-foreground">números separados por pontos</strong> — o mesmo padrão do Plano de Contas.
                Linhas com código em formato diferente são ignoradas.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">✓ Aceitos</p>
                  <ul className="mt-2 space-y-1 font-mono text-xs text-emerald-700 dark:text-emerald-300">
                    {["4", "4.1", "4.1.1", "4.1.1.001"].map((c) => <li key={c}>{c}</li>)}
                  </ul>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800/40 dark:bg-red-950/20">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-300">✗ Ignorados</p>
                  <ul className="mt-2 space-y-1 font-mono text-xs text-red-700 dark:text-red-300">
                    {["TOTAL GERAL", "4-1-1", "Grupo 4", "(em branco)"].map((c) => <li key={c}>{c}</li>)}
                  </ul>
                </div>
              </div>
              <p className="mt-3 text-xs text-[--text-muted]">
                <strong>Contas analíticas vs. sintéticas:</strong> O sistema <strong>mantém apenas as contas folha</strong> (contas
                que não possuem filhos), evitando dupla contagem. Ex: se existir <code className="rounded bg-[--surface-2] px-1">4.1</code> e <code className="rounded bg-[--surface-2] px-1">4.1.1</code>, apenas <code className="rounded bg-[--surface-2] px-1">4.1.1</code> é contabilizado.
              </p>
            </div>

            {/* Valores monetários */}
            <div className="rounded-xl border border-[--border] bg-[--surface] p-6">
              <h3 className="text-sm font-semibold text-foreground">Formato dos valores monetários</h3>
              <p className="mt-2 text-sm text-[--text-muted]">
                O sistema aceita o padrão <strong className="text-foreground">brasileiro (pt-BR)</strong> — ponto como separador de milhar e vírgula como decimal.
                Também aceita valores importados direto do Excel (números puros sem formatação).
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">✓ Formatos aceitos</p>
                  <ul className="mt-2 space-y-1 font-mono text-xs text-emerald-700 dark:text-emerald-300">
                    {["150.000,00", "R$ 150.000,00", "(45.000,00)  → negativo", "-45000.00  → número puro", "-  → interpretado como zero"].map((c) => <li key={c}>{c}</li>)}
                  </ul>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800/40 dark:bg-blue-950/20">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">ℹ Observações</p>
                  <ul className="mt-2 space-y-1 text-xs text-blue-700 dark:text-blue-300">
                    <li>Parênteses <code>(valor)</code> = número negativo</li>
                    <li>Prefixo <code>R$</code> é removido automaticamente</li>
                    <li>Células vazias = zero</li>
                    <li>Células com traço <code>-</code> = zero</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Metadados */}
            <div className="rounded-xl border border-[--border] bg-[--surface] p-6">
              <h3 className="text-sm font-semibold text-foreground">Metadados extraídos automaticamente</h3>
              <p className="mt-2 text-sm text-[--text-muted]">
                O sistema busca nas <strong className="text-foreground">primeiras 10 linhas</strong> do arquivo por CNPJ e período de referência:
              </p>
              <div className="mt-4 space-y-3">
                <div className="flex items-start gap-3 rounded-xl border border-[--border] bg-[--surface-2] p-4">
                  <Badge color="blue">CNPJ</Badge>
                  <p className="text-sm text-[--text-muted]">
                    Detectado pelo padrão <code className="rounded bg-[--surface] px-1 text-xs">XX.XXX.XXX/XXXX-XX</code>.
                    É validado contra o CNPJ da empresa cadastrada no sistema — se divergir, a importação é rejeitada.
                  </p>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-[--border] bg-[--surface-2] p-4">
                  <Badge color="purple">Período</Badge>
                  <p className="text-sm text-[--text-muted]">
                    Detectado pelo padrão <code className="rounded bg-[--surface] px-1 text-xs">DD/MM/AAAA</code> (ex: <code className="text-xs">01/01/2026 - 31/01/2026</code>).
                    Usado como fallback se o mês de referência não for informado no formulário de upload.
                  </p>
                </div>
              </div>
              <InfoBox title="Prioridade do mês de referência" color="emerald">
                O campo <strong>mês de referência</strong> do formulário de upload tem prioridade sobre o período extraído do arquivo.
                Se você preencher o formulário com <code className="rounded bg-[--surface] px-1 text-xs">2026-01</code>, esse valor é usado — mesmo que o arquivo indique data diferente.
              </InfoBox>
            </div>

            {/* O que gera erro */}
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800/40 dark:bg-red-950/20">
              <h3 className="text-sm font-semibold text-red-700 dark:text-red-300">O que causa rejeição do arquivo?</h3>
              <ul className="mt-3 space-y-2 text-sm text-red-700 dark:text-red-300">
                {[
                  "Formato diferente de .xlsx, .xls ou .csv",
                  "Tamanho maior que 10 MB",
                  "Nenhuma linha de cabeçalho encontrada nas primeiras 40 linhas",
                  "Cabeçalho sem coluna de código de conta identificável",
                  "Cabeçalho com coluna de código mas sem nenhuma coluna de valor",
                  "CNPJ extraído do arquivo diverge do CNPJ cadastrado na empresa",
                  "Nenhuma linha com código de conta válido após o cabeçalho",
                  "Mês de referência já possui uma importação concluída (status DONE) para a empresa",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-0.5 text-red-400">✗</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Regra de unicidade por mês */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800/40 dark:bg-amber-950/20">
              <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300">Regra de unicidade por mês</h3>
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                Cada empresa pode ter <strong>no máximo um import concluído por mês</strong>. Tentar importar um arquivo diferente para o mesmo
                mês retorna erro <code className="rounded bg-amber-100 dark:bg-amber-900/40 px-1 text-xs">409 Conflict</code>.
              </p>
              <div className="mt-4 space-y-2 text-sm text-amber-700 dark:text-amber-300">
                <p><strong>Para corrigir dados de um mês já importado:</strong></p>
                <ol className="ml-4 space-y-1 list-decimal">
                  <li>Acesse <strong>Importações</strong> e exclua o import existente do mês.</li>
                  <li>Importe o arquivo correto normalmente.</li>
                </ol>
                <p className="mt-2 text-xs">Reimportar o <strong>mesmo arquivo</strong> (mesmo conteúdo) não é bloqueado — o sistema detecta pelo checksum e reaplica os mapeamentos atuais sem criar um novo registro.</p>
              </div>
            </div>

          </div>
        )}

        {/* ── Visão Técnica ── */}
        {active === "tecnico" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-[--border] bg-[--surface] p-6">
              <SectionTitle>Arquitetura do fluxo</SectionTitle>
              <p className="mt-2 text-sm text-[--text-muted]">
                Stack: <Badge color="blue">Next.js 15 App Router</Badge> <Badge color="zinc">Prisma ORM</Badge> <Badge color="purple">PostgreSQL</Badge> <Badge color="emerald">TypeScript</Badge>
              </p>
            </div>

            <div>
              <SubTitle>Rotas da API envolvidas</SubTitle>

              {/* Mobile: cards */}
              <div className="mt-3 sm:hidden space-y-2">
                {[
                  { method: "POST",   route: "/api/imports/xlsx",         desc: "Recebe o arquivo, valida, persiste e aplica mapeamentos",              auth: "ADMIN" },
                  { method: "GET",    route: "/api/imports",               desc: "Lista os ImportBatch de uma empresa (paginado por companyId)",       auth: "ALL"   },
                  { method: "GET",    route: "/api/imports/[id]",          desc: "Detalhe de um batch: contas não mapeadas + resumo calculado",         auth: "ALL"   },
                  { method: "DELETE", route: "/api/imports/[id]",          desc: "Exclui batch em cascata (LedgerEntry, UnmappedAccount, Summary se único); bump Company.updatedAt", auth: "ADMIN" },
                  { method: "GET",    route: "/api/dashboard/freshness",    desc: "Retorna updatedAt e último batch por empresa — polling de notificações do dashboard", auth: "ALL"   },
                  { method: "GET",    route: "/api/admin/mappings",        desc: "Lista todas as regras de mapeamento",                                auth: "ADMIN" },
                  { method: "POST",   route: "/api/admin/mappings",        desc: "Cria nova regra de mapeamento",                                      auth: "ADMIN" },
                  { method: "PATCH",  route: "/api/admin/mappings/[id]",   desc: "Atualiza códigos, tipo ou fórmula de uma regra",                     auth: "ADMIN" },
                  { method: "DELETE", route: "/api/admin/mappings/[id]",   desc: "Remove uma regra (afeta imports futuros)",                          auth: "ADMIN" },
                  { method: "POST",   route: "/api/admin/mappings/seed",   desc: "Popula o banco com as regras padrão do balancete de referência",     auth: "ADMIN" },
                ].map((r) => (
                  <div key={`m-${r.method}-${r.route}`} className="rounded-xl border border-[--border] bg-[--surface] p-3 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`font-mono text-xs font-bold ${r.method === "GET" ? "text-emerald-600 dark:text-emerald-400" : r.method === "POST" ? "text-blue-600 dark:text-blue-400" : r.method === "PATCH" ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>{r.method}</span>
                      <code className="text-xs text-[--text-muted] break-all">{r.route}</code>
                      <Badge color={r.auth === "ADMIN" ? "red" : "emerald"}>{r.auth}</Badge>
                    </div>
                    <p className="text-xs text-[--text-muted]">{r.desc}</p>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="mt-3 hidden sm:block overflow-x-auto rounded-xl border border-[--border]">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-[--border] bg-[--surface-2] text-xs font-medium uppercase tracking-wide text-[--text-muted]">
                    <tr>
                      <th className="px-4 py-3 text-left whitespace-nowrap">Método + Rota</th>
                      <th className="px-4 py-3 text-left">Responsabilidade</th>
                      <th className="px-4 py-3 text-left whitespace-nowrap">Auth</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[--border] text-sm">
                    {[
                      { method: "POST", route: "/api/imports/xlsx", desc: "Recebe o arquivo, valida, persiste e aplica mapeamentos", auth: "ADMIN" },
                      { method: "GET", route: "/api/imports", desc: "Lista os ImportBatch de uma empresa (paginado por companyId)", auth: "ALL" },
                      { method: "GET", route: "/api/imports/[id]", desc: "Detalhe de um batch: contas não mapeadas + resumo calculado", auth: "ALL" },
                      { method: "DELETE", route: "/api/imports/[id]", desc: "Exclui batch em cascata (LedgerEntry, UnmappedAccount, Summary se único); bump Company.updatedAt", auth: "ADMIN" },
                      { method: "GET", route: "/api/dashboard/freshness", desc: "Retorna updatedAt e último batch por empresa — polling de notificações do dashboard", auth: "ALL" },
                      { method: "GET", route: "/api/admin/mappings", desc: "Lista todas as regras de mapeamento", auth: "ADMIN" },
                      { method: "POST", route: "/api/admin/mappings", desc: "Cria nova regra de mapeamento", auth: "ADMIN" },
                      { method: "PATCH", route: "/api/admin/mappings/[id]", desc: "Atualiza códigos, tipo ou fórmula de uma regra", auth: "ADMIN" },
                      { method: "DELETE", route: "/api/admin/mappings/[id]", desc: "Remove uma regra (afeta imports futuros)", auth: "ADMIN" },
                      { method: "POST", route: "/api/admin/mappings/seed", desc: "Popula o banco com as regras padrão do balancete de referência", auth: "ADMIN" },
                    ].map((r) => (
                      <tr key={`${r.method}-${r.route}`} className="bg-[--surface] hover:bg-[--surface-2] transition-colors">
                        <td className="px-4 py-3">
                          <span className={`mr-2 rounded font-mono text-xs font-bold ${r.method === "GET" ? "text-emerald-600 dark:text-emerald-400" : r.method === "POST" ? "text-blue-600 dark:text-blue-400" : r.method === "PATCH" ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                            {r.method}
                          </span>
                          <code className="text-xs text-[--text-muted]">{r.route}</code>
                        </td>
                        <td className="px-4 py-3 text-[--text-muted]">{r.desc}</td>
                        <td className="px-4 py-3"><Badge color={r.auth === "ADMIN" ? "red" : "emerald"}>{r.auth}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <SubTitle>Modelo de dados (Prisma)</SubTitle>
              <div className="mt-3 space-y-3">
                <CodeBlock>{`model AccountMapping {
  id             String              @id @default(cuid())
  dashboardField String              // ex: "FATURAMENTO"
  matchType      MappingMatchType    // EXACT | PREFIX | LIST
  codes          Json                // string[] de códigos
  valueColumn    MappingValueColumn  // saldo_atual | debito | credito | saldo_anterior
  aggregation    MappingAggregation  // SUM | ABS_SUM
  isCalculated   Boolean             @default(false)
  formula        String?             // ex: "{RECEITA} - {DEDUCOES}"
  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt
}`}</CodeBlock>
                <CodeBlock>{`model ImportBatch {
  id               String            @id @default(cuid())
  companyId        String
  referenceMonth   String            // "YYYY-MM"
  sourceType       ImportSourceType  // XLSX
  status           ImportBatchStatus // PENDING | PROCESSING | DONE | FAILED
  checksum         String            // SHA-256 do arquivo (idempotência)
  fileName         String?
  totalsJson       Json?             // snapshot do summary no momento do import
  totalRows        Int               @default(0)
  processedRows    Int               @default(0)
  lastError        String?
  ledgerEntries    LedgerEntry[]
  unmappedAccounts UnmappedAccount[]
  @@unique([companyId, referenceMonth, checksum])
}`}</CodeBlock>
                <CodeBlock>{`model DashboardMonthlySummary {
  id             String   @id @default(cuid())
  companyId      String
  referenceMonth String   // "YYYY-MM"
  dataJson       Json     // Record<string, number> — ex: { FATURAMENTO: 150000.00 }
  @@unique([companyId, referenceMonth])
}`}</CodeBlock>
              </div>
            </div>

            <div>
              <SubTitle>Pipeline de processamento (POST /api/imports/xlsx)</SubTitle>
              <div className="mt-3 rounded-xl border border-[--border] bg-[--surface] p-5 space-y-0">
                <Step number={1} title="Autenticação e autorização">
                  JWT validado via cookie <code className="rounded bg-[--surface-2] px-1 text-xs">dash_contabil_session</code>.
                  Apenas role <Badge color="red">ADMIN</Badge> pode importar. Acesso à empresa validado via <code className="text-xs">assertCompanyAccess</code>.
                </Step>
                <Step number={2} title="Validação do arquivo">
                  Extensão <code className="text-xs">.xlsx</code>, tamanho máximo 10 MB, campo companyId não vazio.
                </Step>
                <Step number={3} title="Parsing do XLSX (lib/xlsx/parser.ts)">
                  Lê o buffer com <code className="text-xs">xlsx</code> (SheetJS). Detecta automaticamente as colunas por aliases
                  (<em>Classificação, Código, Débito, Crédito, Saldo Anterior/Atual</em>). Extrai metadados: CNPJ e período do cabeçalho.
                  Retorna um array de <code className="text-xs">ParsedAccountRow</code>.
                </Step>
                <Step number={4} title="Idempotência por checksum">
                  SHA-256 do arquivo é calculado e verificado em <code className="text-xs">ImportBatch</code> pelo índice único
                  <code className="text-xs"> (companyId, referenceMonth, checksum)</code>. Se já existe, reaplica os mapeamentos atuais
                  sobre as <code className="text-xs">LedgerEntry</code> já salvas e retorna <code className="text-xs">{`{ idempotent: true }`}</code>.
                </Step>
                <Step number={5} title="Persistência das entradas (LedgerEntry)">
                  Cada linha do balancete é salva com <code className="text-xs">accountCode</code>, <code className="text-xs">accountName</code>,
                  <code className="text-xs"> debit</code>, <code className="text-xs">credit</code>, <code className="text-xs">balance</code> e
                  o JSON original em <code className="text-xs">rawJson</code> (para preservar <code className="text-xs">saldo_anterior</code>).
                </Step>
                <Step number={6} title="Aplicação dos mapeamentos (lib/xlsx/mapping-engine.ts)">
                  Regras <em>estáticas</em> (PREFIX/EXACT/LIST) são processadas primeiro, somando os valores das linhas correspondentes.
                  Depois, regras <em>calculadas</em> são avaliadas via parser de fórmulas (<code className="text-xs">lib/xlsx/formula.ts</code>)
                  usando os valores já calculados — suporta <code className="text-xs">+ - * / ()</code> e referências <code className="text-xs">{"{CAMPO}"}</code>.
                </Step>
                <Step number={7} title="Persistência do resumo e contas não mapeadas">
                  O <code className="text-xs">summary</code> resultante vai para <code className="text-xs">DashboardMonthlySummary</code> (upsert).
                  Contas não capturadas por nenhuma regra são salvas em <code className="text-xs">UnmappedAccount</code>
                  (limitado a 300 por import).
                </Step>
                <Step number={8} title="Resposta">
                  Retorna <code className="text-xs">{`{ batchId, summary, idempotent }`}</code>.
                  O front-end exibe o resumo inline no card do import.
                </Step>
              </div>
            </div>

            <div>
              <SubTitle>Motor de mapeamento — como os valores são extraídos</SubTitle>
              <p className="mt-2 text-sm text-[--text-muted]">
                Após buscar todas as regras do banco, o engine percorre as linhas do balancete em duas passagens: primeiro as regras <strong className="text-foreground">estáticas</strong> (que leem colunas), depois as <strong className="text-foreground">calculadas</strong> (que derivam de outras).
              </p>

              {/* Passagem 1 — regras estáticas */}
              <div className="mt-4 rounded-xl border border-[--border] bg-[--surface] p-5 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[--text-muted]">Passagem 1 — Regras estáticas (PREFIX / EXACT / LIST)</p>
                <p className="text-sm text-[--text-muted]">Para cada regra o engine:</p>
                <ol className="mt-2 space-y-3 text-sm">
                  {[
                    {
                      n: "1",
                      title: "Filtra as linhas que correspondem à regra",
                      body: (
                        <div className="mt-2 space-y-2 text-xs text-[--text-muted]">
                          {/* Mobile: cards */}
                          <div className="sm:hidden space-y-2">
                            <div className="rounded-lg border border-[--border] bg-[--surface] p-2.5 space-y-1">
                              <Badge color="blue">PREFIX</Badge>
                              <code className="block break-all text-xs">row.accountCode.startsWith(code)</code>
                              <p className="text-emerald-600 dark:text-emerald-400">✓ 4.1.1 · 4.1.2.03 · 4.10</p>
                            </div>
                            <div className="rounded-lg border border-[--border] bg-[--surface-2] p-2.5 space-y-1">
                              <Badge color="purple">EXACT</Badge>
                              <code className="block break-all text-xs">row.accountCode === code</code>
                              <p className="text-red-600 dark:text-red-400">✗ 4.1.1 — só &quot;4.1&quot; exato</p>
                            </div>
                            <div className="rounded-lg border border-[--border] bg-[--surface] p-2.5 space-y-1">
                              <Badge color="amber">LIST</Badge>
                              <code className="block break-all text-xs">codes.includes(row.accountCode)</code>
                              <p>Itera todos os códigos da lista; a conta precisa ser igual a algum deles</p>
                            </div>
                          </div>
                          {/* Desktop: table */}
                          <div className="hidden sm:block overflow-x-auto rounded-lg border border-[--border]">
                            <table className="min-w-full">
                              <thead className="border-b border-[--border] bg-[--surface-2] text-xs font-medium uppercase tracking-wide">
                                <tr>
                                  <th className="px-3 py-2">Tipo</th>
                                  <th className="px-3 py-2">Condição por linha</th>
                                  <th className="px-3 py-2">Exemplo &mdash; codes: [&quot;4.1&quot;]</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[--border]">
                                <tr className="bg-[--surface]">
                                  <td className="px-3 py-2"><Badge color="blue">PREFIX</Badge></td>
                                  <td className="px-3 py-2"><code className="text-xs">row.accountCode.startsWith(code)</code></td>
                                  <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400">✓ 4.1.1 · 4.1.2.03 · 4.10</td>
                                </tr>
                                <tr className="bg-[--surface-2]">
                                  <td className="px-3 py-2"><Badge color="purple">EXACT</Badge></td>
                                  <td className="px-3 py-2"><code className="text-xs">row.accountCode === code</code></td>
                                  <td className="px-3 py-2 text-red-600 dark:text-red-400">✗ 4.1.1 — só &quot;4.1&quot; exato</td>
                                </tr>
                                <tr className="bg-[--surface]">
                                  <td className="px-3 py-2"><Badge color="amber">LIST</Badge></td>
                                  <td className="px-3 py-2"><code className="text-xs">codes.includes(row.accountCode)</code></td>
                                  <td className="px-3 py-2 text-[--text-muted]">Itera todos os códigos da lista; a conta precisa ser igual a algum deles</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          <p>Para <Badge color="amber">LIST</Badge> com vários códigos, ex: <code className="rounded bg-[--surface-2] px-1">[&quot;4.1.1&quot;, &quot;5.2.3&quot;, &quot;6.1&quot;]</code>, o engine verifica cada linha do balancete contra <strong>todos</strong> os códigos da lista de uma vez — todas as linhas que baterem com qualquer um dos códigos são capturadas.</p>
                        </div>
                      ),
                    },
                    {
                      n: "2",
                      title: "Lê a coluna de valor configurada (valueColumn)",
                      body: (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs text-[--text-muted]">
                          {[
                            { col: "saldo_atual",    label: "Saldo Atual",    desc: "Saldo acumulado ao final do mês" },
                            { col: "debito",         label: "Débito",         desc: "Total de débitos do período" },
                            { col: "credito",        label: "Crédito",        desc: "Total de créditos do período" },
                            { col: "saldo_anterior", label: "Saldo Anterior", desc: "Saldo acumulado do mês anterior" },
                          ].map((v) => (
                            <div key={v.col} className="rounded-lg border border-[--border] bg-[--surface-2] px-3 py-2">
                              <code className="font-mono text-foreground">{v.col}</code>
                              <p className="text-[--text-muted]">{v.desc}</p>
                            </div>
                          ))}
                        </div>
                      ),
                    },
                    {
                      n: "3",
                      title: "Agrega os valores das linhas capturadas",
                      body: (
                        <div className="mt-2 space-y-2 text-xs text-[--text-muted]">
                          <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1 rounded-lg border border-[--border] bg-[--surface-2] p-3">
                              <p><Badge color="blue">SUM</Badge></p>
                              <p className="mt-1">Soma aritmética preservando sinal. Créditos podem ser negativos e isso é mantido.</p>
                              <code className="mt-1 block">total = Σ row.value</code>
                            </div>
                            <div className="flex-1 rounded-lg border border-[--border] bg-[--surface-2] p-3">
                              <p><Badge color="purple">ABS_SUM</Badge></p>
                              <p className="mt-1">Soma dos valores absolutos — ignora sinal. Útil para despesas que ficam negativas no balancete.</p>
                              <code className="mt-1 block">total = Σ |row.value|</code>
                            </div>
                          </div>
                          <p>O resultado é arredondado a 2 casas decimais e <strong>acumulado</strong> em <code className="rounded bg-[--surface] px-1">summary[dashboardField]</code>. Se duas regras estáticas apontarem para o mesmo campo, os valores são somados.</p>
                        </div>
                      ),
                    },
                    {
                      n: "4",
                      title: "Registra os códigos mapeados",
                      body: <p className="mt-1 text-xs text-[--text-muted]">Cada <code className="rounded bg-[--surface-2] px-1">accountCode</code> capturado é adicionado a um <code className="rounded bg-[--surface-2] px-1">Set</code>. Ao final, qualquer linha cujo código <em>não</em> esteja nesse Set vira um registro de <code className="rounded bg-[--surface-2] px-1">UnmappedAccount</code>.</p>,
                    },
                  ].map((item) => (
                    <li key={item.n} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{item.n}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        {item.body}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Passagem 2 — regras calculadas */}
              <div className="mt-3 rounded-xl border border-[--border] bg-[--surface] p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[--text-muted]">Passagem 2 — Regras calculadas (fórmulas)</p>
                <p className="mt-2 text-sm text-[--text-muted]">
                  Executada <strong className="text-foreground">após</strong> todas as estáticas. Cada regra calculada avalia uma fórmula tendo acesso ao <code className="rounded bg-[--surface-2] px-1 text-xs">summary</code> já preenchido pela passagem 1.
                </p>
                <CodeBlock>{`// Exemplo de regra calculada:
// dashboardField = "LUCRO_BRUTO"
// formula        = "{FATURAMENTO} - {CMV}"

summary["LUCRO_BRUTO"] = evaluateFormula("{FATURAMENTO} - {CMV}", summary);
// → summary["FATURAMENTO"] - summary["CMV"]
// → 150000.00 - 80000.00 = 70000.00`}</CodeBlock>
                <p className="mt-3 text-xs text-[--text-muted]">
                  A ordem em que regras calculadas são cadastradas importa quando uma calculada referencia outra calculada — a que é referenciada deve ser processada primeiro. Referências a campos ainda não calculados retornam <code className="rounded bg-[--surface-2] px-1">0</code>.
                </p>
              </div>

              {/* Exemplo completo */}
              <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-800/40 dark:bg-blue-950/20">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Exemplo end-to-end com LIST</p>
                <CodeBlock>{`// Regra:  DEDUCOES · LIST · codes: ["4.2.1","4.2.3","4.9.9"] · saldo_atual · ABS_SUM

// Balancete (linhas folha):
// 4.2.1  PIS/COFINS          saldo_atual: -3.500,00
// 4.2.2  ICMS                saldo_atual: -1.200,00  ← não está na lista, ignorada
// 4.2.3  ISS                 saldo_atual: -800,00
// 4.9.9  Outras deduções     saldo_atual: -200,00

// Linhas capturadas: [4.2.1, 4.2.3, 4.9.9]
// ABS_SUM → |−3500| + |−800| + |−200| = 4.500,00
// summary["DEDUCOES"] = 4500.00`}</CodeBlock>
              </div>
            </div>

            <div>
              <SubTitle>Segurança aplicada</SubTitle>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[
                  { label: "JWT HttpOnly cookie", desc: "Token de sessão nunca exposto ao JavaScript do cliente." },
                  { label: "Rate limit no login", desc: "Proteção contra brute-force na rota /api/auth/login." },
                  { label: "Validação de CNPJ", desc: "CNPJ extraído do XLSX é comparado ao CNPJ cadastrado na empresa — impede importar arquivo errado." },
                  { label: "assertCompanyAccess", desc: "Verifica se o usuário tem acesso à empresa antes de qualquer operação de leitura ou escrita." },
                  { label: "Zod em todos os inputs", desc: "Todos os payloads de API são validados com Zod antes de chegar ao ORM." },
                  { label: "Role guard", desc: "Apenas ADMIN importa e gerencia mapeamentos. CLIENT é bloqueado no backend (403)." },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-[--border] bg-[--surface-2] p-4">
                    <p className="text-xs font-semibold text-foreground">{item.label}</p>
                    <p className="mt-1 text-xs text-[--text-muted]">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <InfoBox title="Lib de fórmulas (lib/xlsx/formula.ts)" color="blue">
              Parser próprio que tokeniza expressões como <code className="rounded bg-[--surface-2] px-1 text-xs">{"{RECEITA_BRUTA} - {DEDUCOES} * 0.15"}</code>.
              Usa o algoritmo <strong>Shunting Yard</strong> para converter para notação pós-fixada (RPN) e avalia com uma pilha.
              Suporte a operadores <code className="text-xs">+ - * /</code>, parênteses e identificadores  <code className="text-xs">{"{CAMPO}"}</code>
              que são substituídos pelos valores do <code className="text-xs">summary</code> parcial.
            </InfoBox>
          </div>
        )}
      </div>
    </AppShell>
  );
}
