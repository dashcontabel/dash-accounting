# DashContábil — Pitch de Produto

> Visão de produto · Março/2026

---

## 1. O Problema

Escritórios de contabilidade e controladoria de empresas lidam hoje com um ciclo manual e ineficiente:

1. O contador recebe balancetes em **XLSX ou CSV** de cada empresa cliente
2. Abre o arquivo, interpreta os dados manualmente
3. Coloca em uma planilha de Power BI ou Excel própria
4. Manda o PDF por e-mail para o gestor
5. Repete o processo **todo mês para cada empresa**

**Consequências:**
- Horas perdidas em tarefas repetitivas
- Erros humanos na consolidação
- Sem histórico centralizado
- O gestor não tem visão em tempo real
- Impossível comparar empresas lado a lado

---

## 2. A Solução — DashContábil

Uma plataforma web que transforma balancetes contábeis em **inteligência operacional para gestores e contadores**.

```
Balancete XLSX/CSV  →  Upload  →  Mapeamento Inteligente  →  Dashboard em Tempo Real
```

### O que já funciona hoje (v2.0)

| Funcionalidade | Status |
|---|---|
| Upload e parser de XLSX/CSV | ✅ Produção |
| Motor de mapeamento contábil configurável | ✅ Produção |
| Dashboard com KPIs financeiros | ✅ Produção |
| Multi-empresa — visão consolidada | ✅ Produção |
| Filtros de período: mensal, bimestral, trimestral, semestral, anual | ✅ Produção |
| Gráficos de evolução, comparativo, mapa de calor | ✅ Produção |
| Gestão de usuários e empresas (painel Admin) | ✅ Produção |
| Autenticação segura com JWT | ✅ Produção |
| Dark mode | ✅ Produção |

---

## 3. Para Quem

### Persona 1 — O Escritório Contábil

> "Atendo 25 empresas. Todo mês é o mesmo trabalho de baixar balancete, limpar, jogar no Power BI e mandar relatório."

- **Dor principal**: horas perdidas, processos manuais, sem escala
- **Ganho com DashContábil**: upload do balancete → dashboard pronto instantaneamente, para todas as empresas

### Persona 2 — O Gestor / Sócio da Empresa

> "Quero saber o resultado do mês sem precisar ligar pro contador."

- **Dor principal**: depende de relatórios manuais atrasados, sem visibilidade
- **Ganho com DashContábil**: acesso próprio ao dashboard com os dados do seu negócio

### Persona 3 — O Controller / CFO

> "Tenho 3 empresas de grupo e preciso comparar resultados lado a lado."

- **Dor principal**: dados em planilhas separadas, conciliação manual
- **Ganho com DashContábil**: visão consolidada multi-empresa em um único painel

---

## 4. KPIs que o Dashboard já entrega

| KPI | O que representa |
|---|---|
| **Faturamento** | Receita bruta total do período |
| **Impostos sobre Receita** | Carga tributária sobre o faturamento |
| **Resultado Operacional** | Lucro/prejuízo antes do financeiro |
| **Saldo Bancário** | Posição de caixa e bancos |
| **Despesas de Pessoal** | Folha + encargos |
| **Rentabilidade %** | Resultado / Faturamento |
| **Resultado Líquido** | Lucro/prejuízo final do período |

### Visualizações disponíveis
- Evolução mensal (linha e barras)
- Comparativo multi-empresa por período
- Mapa de calor Resultado × Empresa × Mês
- Tabela analítica de contas

---

## 5. Diferencial Técnico — Motor de Mapeamento

O grande problema de parsear balancetes é que **cada sistema contábil gera um layout diferente**. O DashContábil resolve isso com regras de mapeamento configuráveis:

```
Conta contábil "3.1.1.01" → FATURAMENTO
Conta contábil "4.1.*"    → DESPESAS_PESSOAL  (prefixo)
Contas ["2.1", "2.2"]     → SD_BANCARIO        (lista)
```

- Regras por `EXACT`, `PREFIX` ou `LIST`
- Configuráveis pelo admin via painel
- Uma vez configurado para um cliente → todos os uploads futuros são automáticos

---

## 6. Evolução das Fontes de Dados — Da Importação para a Integração

### O problema do modelo atual

O fluxo de hoje é excelente para começar, mas tem um teto:

```
Contador baixa arquivo  →  faz upload manual  →  dados no dashboard
```

É manual, depende de uma ação humana recorrente, e o dado nunca é em tempo real.

### Visão: múltiplas fontes, um único pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                     FONTES DE DADOS                             │
│                                                                 │
│  XLSX/CSV (atual)  │  Banco de Dados  │  API externa  │  Webhook│
└────────────────────┴──────────────────┴───────────────┴─────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Camada de Setup │  ← configurado 1x por fonte
                    │  (Conector)      │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Motor de        │
                    │  Mapeamento      │  ← já existe hoje
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  DashContábil    │
                    │  (KPIs + Gráficos│
                    │   + Histórico)   │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Webhook de Saída│  ← opcional, envia sumários
                    │  (push para ERPs │
                    │   / sistemas)    │
                    └──────────────────┘
```

---

### 6.1 Conector: Banco de Dados (via Introspecção)

Muitos sistemas de gestão têm um banco relacional acessível. Em vez de exportar planilha, o DashContábil conecta diretamente.

**Fluxo de configuração (1x):**
1. Admin informa `host`, `porta`, `usuário`, `senha`, `banco` (ou connection string)
2. DashContábil faz **introspecção**: lista tabelas e colunas disponíveis
3. Admin mapeia: "qual coluna é o valor?", "qual é o código de conta?", "qual é a data de referência?"
4. Salva o conector — a partir daí, sincronização é automática (agendada ou on-demand)

**Alternativa mais simples — via View ou Query:**
- Admin cria uma `VIEW` no banco dele com colunas padronizadas (`account_code`, `description`, `debit`, `credit`, `reference_month`)
- DashContábil só precisa da connection string + nome da view
- Zero introspecção necessária — contrato de dados é da view

**Tecnologia:** `node-postgres` / `mysql2` / `mssql` com connection pool seguro por tenant. A connection string é criptografada em repouso (AES-256).

---

### 6.2 Conector: API Externa (Pull)

O sistema do cliente expõe uma API REST ou GraphQL. DashContábil busca os dados periodicamente.

**Configuração:**
- `endpoint`, `method`, `headers` (auth token), `body template`
- Mapeamento de campos: "campo `valor_lancamento` → `debit`"
- Agendamento: diário, semanal, ou no primeiro dia de cada mês

**Exemplo de uso:** Integração com Omie, Conta Azul, Totvs Protheus via API nativa — sem precisar que o usuário exporte nada.

---

### 6.3 Conector: Webhook de Entrada (Push)

O sistema do cliente envia dados para o DashContábil assim que há um lançamento.

**Como funciona:**
- DashContábil gera uma **URL exclusiva por tenant/empresa**: `https://app.dashcontabil.com/api/webhook/in/{token}`
- O sistema externo faz `POST` para esta URL com o payload de lançamentos
- DashContábil processa, mapeia e atualiza o sumário mensal em tempo real

**Casos de uso:**
- ERP que notifica a cada fechamento de mês
- Sistema de notas fiscais que envia faturamento em tempo real
- Script interno do próprio contador que já existe e só precisa de um destino

---

### 6.4 Webhook de Saída (Push para Sistemas Externos)

Depois de processar e sumarizar, o DashContábil pode **enviar os dados para outros sistemas**.

**Configuração:**
- Admin cadastra uma URL de destino + secret para assinatura HMAC
- Escolhe quais eventos disparam o push: `summary.updated`, `import.completed`, `alert.triggered`
- Payload: sumário do mês já calculado (KPIs prontos), não os dados brutos

**Casos de uso:**
- Enviar resultado mensal para um sistema de BI corporativo
- Acionar um processo de aprovação de orçamento em outro sistema
- Notificar um sistema de gestão de obras quando o resultado de uma empresa muda
- Integrar com Zapier / Make para automações custom

---

### 6.5 Estratégia de Implementação (Faseada)

| Fase | Entregável | Esforço |
|---|---|---|
| **A** | Abstração do pipeline de importação em "conectores" plugáveis | 1 semana |
| **B** | Conector: View/Query em banco (PostgreSQL + MySQL) | 2 semanas |
| **C** | Webhook de entrada com endpoint por tenant | 1 semana |
| **D** | Webhook de saída com eventos configuráveis | 1 semana |
| **E** | Conector: API externa com agendamento (cron) | 2 semanas |
| **F** | Introspecção de banco com mapeamento visual | 2 semanas |
| **Total** | MVP de integrações completo | **~9 semanas** |

> **Sequência recomendada**: A → C → D → B → E → F  
> Webhook de entrada (C) é o de maior impacto com menor esforço: resolve o caso "meu ERP já tem API, quero mandar dados pro DashContábil" com apenas uma URL e um POST.

---

### 6.6 Considerações de Segurança

| Risco | Mitigação |
|---|---|
| Credenciais de banco vazadas | Criptografia AES-256 em repouso; chaves por tenant; sem log de connection strings |
| Webhook de entrada forjado | Token único por URL + validação HMAC-SHA256 do payload |
| Webhook de saída interceptado | HTTPS obrigatório + assinatura HMAC no `X-DashContabil-Signature` header |
| Acesso indevido ao banco externo | Recomendação de usuário read-only para o banco do cliente; auditoria de queries |
| SQL injection via mapeamento de campos | Queries parametrizadas; whitelist de nomes de colunas via introspecção prévia |

---

## 7. Roadmap para SaaS

### Fase 1 — Produto Atual (v2.0) ✅
- Multi-empresa, multi-usuário
- Upload + visualização
- Um cliente principal: Barros & Sá

### Fase 2 — Multi-Tenant Real (v3.0) 🔜
- Isolamento total por **tenant** (escritório contábil)
- Cada escritório gerencia suas próprias empresas e usuários
- Planos: Starter (até 5 empresas), Pro (até 25), Enterprise (ilimitado)
- Onboarding self-service

### Fase 3 — Inteligência e Automação (v4.0)
- **Alertas**: resultado abaixo do threshold → notificação email/WhatsApp
- **Relatórios PDF** gerados automaticamente por empresa/período
- **Comparativo com período anterior** automático (MoM, YoY)
- **IA para anomalias**: detecta contas fora do padrão histórico

### Fase 4 — Ecossistema (v5.0)
- **API pública** para integração com ERP (Omie, Conta Azul, Totvs)
- **Integração direta** com sistemas contábeis (sem upload manual)
- **App mobile** para gestores
- **Marketplace de layouts**: escritórios compartilham mapeamentos

---

## 7. Modelo de Negócio SaaS

### Opção A — Cobrado por Escritório Contábil (B2B)

| Plano | Empresas | Usuários | Preço/mês |
|---|---|---|---|
| Starter | até 5 | até 10 | R$ 197 |
| Pro | até 25 | até 50 | R$ 597 |
| Enterprise | ilimitado | ilimitado | R$ 1.497 |

> LTV médio estimado: 24 meses × R$ 597 = **R$ 14.328 por cliente**

### Opção B — White Label para Escritórios

O escritório contábil revende para seus clientes com a própria marca, pagando royalty por empresa ativa.

### Opção C — Cobrado por Empresa (parceiros ERP)

Integração nativa com ERPs: R$ 29/empresa/mês, cobrado diretamente na fatura do ERP.

---

## 8. Tamanho do Mercado

| Dado | Fonte |
|---|---|
| ~80.000 escritórios contábeis ativos no Brasil | CFC/2024 |
| Média de 20 clientes por escritório | estimativa setorial |
| 1,6 milhão de empresas que terceirizam contabilidade | IBGE/Sebrae |
| Ticket médio de software contábil: R$ 300–800/mês | pesquisa de mercado |

**TAM estimado**: R$ 24B/ano (mercado de software contábil Brasil)  
**SAM realista (3 anos)**: 500 escritórios × R$ 597 = **R$ 3,5M ARR**

---

## 9. Vantagens Competitivas

| Concorrente | Problema deles | Nosso diferencial |
|---|---|---|
| Power BI / Excel | Requer analista, setup complexo | Zero configuração, upload e pronto |
| Sistemas contábeis (Domínio, Zeus) | Fechados, não têm dashboard moderno | Agnóstico de sistema, lê qualquer balancete |
| Conta Azul / Omie dashboards | Só funcionam com dados dentro do ERP | Funciona com qualquer fonte externa via XLSX/CSV |
| Planilhas internas | Manual, sem histórico, sem multi-empresa | Automatizado, histórico completo, visão consolidada |

---

## 10. O Que Falta para o MVP SaaS

Tecnicamente, o produto já tem base sólida. Os gaps para multi-tenant público são:

| Item | Esforço estimado |
|---|---|
| Sistema de planos e billing (Stripe) | 2 semanas |
| Onboarding self-service (cadastro de escritório) | 1 semana |
| Isolamento de dados por tenant (já parcialmente feito com Groups) | 1 semana |
| Envio de e-mail (convites, relatórios) | 3 dias |
| Relatório PDF exportável | 1 semana |
| Landing page de vendas | 1 semana |
| **Total** | **~6 semanas** |

---

## 11. Stack Atual — pronta para escalar

| Camada | Tecnologia | Por que escala |
|---|---|---|
| Frontend | Next.js 16 + React 19 | SSR, edge-ready, Vercel deploy |
| Backend | Next.js API Routes | Serverless, escala automaticamente |
| Banco | PostgreSQL (Neon/Supabase) | Managed, pool de conexões |
| Auth | JWT sem sessão server-side | Stateless, funciona em edge |
| Infra | Vercel + Neon | Zero DevOps para começar |

---

## 12. Próximos Passos Sugeridos

1. **Validar com 3–5 escritórios contábeis reais** — entrevistas de descoberta
2. **Definir o plano mínimo viável** (quantas empresas, quais KPIs são imprescindíveis)
3. **Implementar billing** (Stripe) e onboarding self-service
4. **Lançar beta fechado** com 10 escritórios selecionados
5. **Medir**: taxa de ativação, retenção no mês 2, NPS
6. **Iterar** com base no feedback antes de escalar marketing

---

> **Resumo executivo**: O DashContábil já é um produto funcional de gestão contábil multi-empresa. A distância para um SaaS comercializável é de aproximadamente 6 semanas de desenvolvimento focado em billing, onboarding e isolamento multi-tenant. O mercado endereçável é grande, os concorrentes têm gaps claros, e a base técnica é sólida para escalar.
