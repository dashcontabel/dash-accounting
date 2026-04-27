# Relatório de Auditoria Técnica — DashContábil MVP

**Data da análise:** 27/04/2026  
**Versão analisada:** 0.1.0  
**Stack:** Next.js 16 (App Router) · TypeScript · Prisma 6 · PostgreSQL · Tailwind v4 · Vitest

---

## Resumo Geral

- **Pontos atendidos:** 52
- **Pontos parcialmente atendidos:** 18
- **Pontos pendentes:** 24
- **Riscos críticos:** 3
- **Recomendações prioritárias:** Corrigir nome do middleware (`proxy.ts` → `middleware.ts`), adicionar `.env.example`, substituir rate limit em memória por solução persistida (Redis/Upstash), adicionar auditoria de ações sensíveis e paginação nas APIs de listagem.

---

## Checklist Detalhado

### Fase 1 — Base Segura

| Área | Item avaliado | Status | Evidência no código | Observação | Prioridade |
|---|---|---|---|---|---|
| Auth | Login com JWT/cookie | Atendido | `app/api/auth/login/route.ts` | JWT assinado com HS256 via `jose`, cookie `httpOnly`, `sameSite: lax`, `secure` em produção | — |
| Auth | Cookie httpOnly | Atendido | `app/api/auth/login/route.ts` L100-110 | `httpOnly: true` explícito | — |
| Auth | Hash de senha | Atendido | `app/api/auth/login/route.ts` · `lib/auth/token.ts` | `bcryptjs` com rounds 12 no seed | — |
| Auth | Logout com limpeza de cookies | Atendido | `app/api/auth/logout/route.ts` | Limpa `dash_contabil_session` e `active_company_id` com `maxAge: 0` | — |
| Auth | Sessão persistida | Atendido | `lib/auth/token.ts` | JWT com expiração de 7 dias | — |
| Auth | Validação de payload (Zod) | Atendido | `app/api/auth/login/route.ts` L13-16 | Schema `loginSchema` valida email e senha | — |
| Auth | Rate limit no login | Parcial | `lib/auth/rate-limit.ts` | **Implementado em Map em memória.** Em ambiente serverless/multi-instância cada instância tem Map independente — rate limit não é compartilhado entre instâncias Vercel | Alta |
| Auth | Middleware de proteção de rotas | **Risco Crítico** | `proxy.ts` | Arquivo nomeado `proxy.ts` em vez de `middleware.ts`. O Next.js App Router exige que o middleware esteja em `middleware.ts` na raiz do projeto. As rotas `/` e `/app/*` **podem não estar protegidas** no nível do runtime | Alta |
| Auth | Proteção das rotas `/app` | Parcial | `proxy.ts` | Lógica correta implementada, mas arquivo não reconhecido automaticamente pelo Next.js | Alta |
| Auth | Proteção das rotas `/api` | Atendido | Todos os `route.ts` chamam `getUserFromRequest` | Cada endpoint valida sessão individualmente — independente do middleware | — |
| Auth | Endpoint `/api/auth/me` | Atendido | `app/api/auth/me/route.ts` | Retorna user, `allowedCompanies` e `activeCompanyId` | — |
| Auth | Controle por role | Atendido | `lib/auth/admin-guard.ts` · `prisma/schema.prisma` | Enum `Role { ADMIN, CLIENT }`, guard `requireAdmin()` | — |
| Auth | Controle por empresa (backend) | Atendido | `lib/company-access.ts` | `assertCompanyAccess()` usada em todos os endpoints sensíveis | — |
| Auth | Contexto ativo de empresa | Atendido | `lib/company-context.ts` · `app/api/context/active-company/route.ts` | Cookie `active_company_id` httpOnly, validado no backend antes de persistir | — |
| Auth | Tratamento de erro padronizado | Parcial | Todos os `route.ts` | Retornos JSON consistentes com status HTTP corretos, mas sem classe de erro centralizada nem estrutura `{ code, message }` padronizada | Baixa |

---

### Fase 2 — Multi-tenant e Modelo de Empresas

| Área | Item avaliado | Status | Evidência no código | Observação | Prioridade |
|---|---|---|---|---|---|
| Modelo | Tabela User | Atendido | `prisma/schema.prisma` | Campos: id, name, email, passwordHash, role, status | — |
| Modelo | Tabela Company | Atendido | `prisma/schema.prisma` | Campos: id, groupId, name, document, isActive | — |
| Modelo | Tabela Group (tenant) | Atendido | `prisma/schema.prisma` | Grupo empresarial com `isActive` | — |
| Modelo | Vínculo UserCompany | Atendido | `prisma/schema.prisma` | Chave composta `[userId, companyId]`, índice em `companyId` | — |
| Modelo | Role do usuário | Atendido | `prisma/schema.prisma` | Enum `Role { ADMIN, CLIENT }` | — |
| Modelo | Empresa ativa/contexto | Atendido | `lib/company-context.ts` | Cookie httpOnly com validação backend | — |
| Segurança | Consultas filtradas por companyId | Atendido | `lib/company-access.ts` · todos os `route.ts` | `assertCompanyAccess()` usada antes de qualquer query sensível | — |
| Segurança | Risco de acesso cruzado entre empresas | Atendido | `app/api/dashboard/summary/route.ts` L31-45 | Verifica acesso antes de retornar dados; compara length de resultado | — |
| Modelo | Usuário em múltiplas empresas | Atendido | `UserCompany` (N:M) | Suportado pelo modelo relacional | — |
| Modelo | Empresa com múltiplos usuários | Atendido | `UserCompany` (N:M) | Suportado | — |
| Modelo | Separação ADMIN / CLIENT | Atendido | `lib/auth/admin-guard.ts` | Endpoints `/api/admin/*` requerem role ADMIN | — |
| Modelo | AccountMapping por empresa | Parcial | `prisma/schema.prisma` | `AccountMapping` é **global** (sem `companyId`). Empresas com planos de contas distintos não podem ter mapeamentos diferentes | Média |

---

### Fase 3 — Importação de Balancete

| Área | Item avaliado | Status | Evidência no código | Observação | Prioridade |
|---|---|---|---|---|---|
| Importação | Upload XLSX | Atendido | `app/api/imports/xlsx/route.ts` | Limite 10MB, validação de extensão e magic bytes | — |
| Importação | Upload CSV | Atendido | `app/api/imports/route.ts` · `lib/csv/ledger-parser.ts` | Limite 5MB, parse via `csv-parse` | — |
| Importação | Parser XLSX dinâmico | Atendido | `lib/xlsx/parser.ts` · `lib/xlsx/workbook.ts` | Detecção dinâmica de colunas por header aliases, normalização pt-BR | — |
| Importação | Validação de colunas obrigatórias | Atendido | `lib/xlsx/parser.ts` L38-45 | Schema Zod valida cada linha | — |
| Importação | Validação de mês e ano | Atendido | `app/api/imports/xlsx/route.ts` | Regex `/^\d{4}-(0[1-9]\|1[0-2])$/` | — |
| Importação | Bloqueio de balancete consolidado | Atendido | `app/api/imports/xlsx/route.ts` L137-147 | Detecta `periodEndMonth` e bloqueia com mensagem clara | — |
| Importação | Controle de duplicidade | Atendido | `prisma/schema.prisma` | `@@unique([companyId, referenceMonth, checksum])` + verificação de `status: DONE` | — |
| Importação | Checksum do arquivo | Atendido | `app/api/imports/xlsx/route.ts` L82 | SHA-256 via `node:crypto` | — |
| Importação | ImportBatch com status | Atendido | `prisma/schema.prisma` | Enum `{ PENDING, PROCESSING, DONE, FAILED }` | — |
| Importação | Registro de contagem de linhas | Atendido | `ImportBatch.totalRows` / `processedRows` | Totais registrados | — |
| Importação | Registro de contas não mapeadas | Atendido | `UnmappedAccount` · `app/api/imports/[id]/route.ts` | Tabela dedicada com `take: 300` | — |
| Importação | Mensagens de erro claras | Atendido | `app/api/imports/xlsx/route.ts` | Mensagens descritivas incluindo mês/ano conflitantes | — |
| Importação | Normalização valores pt-BR | Atendido | `lib/xlsx/parser.ts` · `lib/csv/ledger-parser.ts` | Trata `.` como separador de milhar, `,` como decimal, parênteses como negativo | — |
| Importação | Histórico de importações | Atendido | `GET /api/imports?companyId=` | Lista com filtros de mês/status no frontend (paginação client-side) | — |
| Importação | Arquivo salvo em disco/storage | **Pendente** | — | O arquivo é processado **em memória** e descartado. Não há possibilidade de reprocessar sem novo upload | Alta |
| Importação | Processamento assíncrono | Parcial | `app/api/imports/xlsx/route.ts` | Processamento **síncrono** na request. Arquivos XLSX grandes (~5-10MB) podem causar timeout em serverless | Alta |
| Importação | Rollback em falha | Atendido | `app/api/imports/xlsx/route.ts` | `batchId` criado como PENDING; em catch atualiza para FAILED com `lastError` | — |
| Importação | Validação de CNPJ do arquivo | Atendido | `app/api/imports/xlsx/route.ts` L110-124 | Compara CNPJ extraído do arquivo com `company.document` | — |
| Importação | Validação de período vs. seleção do usuário | Atendido | `app/api/imports/xlsx/route.ts` L152-165 | Compara `referenceMonth` do arquivo com o informado no form | — |

---

### Fase 4 — Modelo Contábil e Normalização

| Área | Item avaliado | Status | Evidência no código | Observação | Prioridade |
|---|---|---|---|---|---|
| Modelo | LedgerEntry com campos contábeis | Atendido | `prisma/schema.prisma` | accountCode, accountName, debit, credit, balance (Decimal 18,2) | — |
| Modelo | Referência mês/ano | Atendido | `LedgerEntry.referenceMonth` | Formato `YYYY-MM` | — |
| Modelo | Empresa vinculada | Atendido | `LedgerEntry.companyId` | FK para Company | — |
| Modelo | Lote de importação vinculado | Atendido | `LedgerEntry.importBatchId` | FK para ImportBatch | — |
| Modelo | saldo_anterior como campo dedicado | Parcial | `LedgerEntry.rawJson` | `saldo_anterior` salvo no `rawJson` genérico, não em coluna tipada. Prejudica queries e legibilidade | Média |
| Modelo | Mapeamento de contas (AccountMapping) | Atendido | `prisma/schema.prisma` · `lib/xlsx/mapping-engine.ts` | Suporte a EXACT/PREFIX/LIST com SUM/ABS_SUM e fórmulas calculadas | — |
| Modelo | Fórmulas calculadas (safe eval) | Atendido | `lib/xlsx/formula.ts` | Parser de expressões próprio (tokenizer + RPN shunting-yard), sem `eval()` | — |
| Modelo | DashboardMonthlySummary (snapshot) | Atendido | `prisma/schema.prisma` | Snapshot mensal por empresa em JSON, `@@unique([companyId, referenceMonth])` | — |
| Modelo | Plano de contas padrão | Pendente | — | Sem estrutura de plano de contas canônico. AccountMapping funciona mas não é hierárquico | Média |
| Modelo | Classificação tipada de contas (ativo/passivo/DRE) | Pendente | — | Sem enum ou campo `accountType`. A classificação é implícita via mapeamento | Média |
| Modelo | Suporte a comparativos anuais | Atendido | `lib/dashboard/periods.ts` · `GET /api/dashboard/summary` | Aggregation por granularidade (mensal, bimestral, semestral, anual) | — |
| Modelo | Suporte a consolidação multiempresa | Atendido | `GET /api/dashboard/summary?companyId=a&companyId=b` | Endpoint aceita múltiplos IDs e valida acesso individual | — |
| Modelo | Histórico multi-ano | Atendido | `referenceMonth: YYYY-MM` | Sem limite de período no schema | — |

---

### Fase 5 — Dashboard e Indicadores

| Área | Item avaliado | Status | Evidência no código | Observação | Prioridade |
|---|---|---|---|---|---|
| Dashboard | Filtro por empresa | Atendido | `app/page.tsx` · `MultiCompanySelect` | Seleção múltipla de empresas | — |
| Dashboard | Filtro por período/granularidade | Atendido | `app/components/period-filter.tsx` | Mensal, bimestral, trimestral, semestral, anual, intervalo | — |
| Dashboard | Cards de indicadores (KPIs) | Atendido | `app/page.tsx` | KpiCard com formatação pt-BR e variação | — |
| Dashboard | Gráficos (Bar, Line, Pie) | Atendido | `app/page.tsx` (Recharts) | BarChart, LineChart, PieChart, Heatmap dinâmico | — |
| Dashboard | Comparativo mensal | Atendido | `lib/dashboard/periods.ts` | `aggregateSummaries()` | — |
| Dashboard | Comparativo anual | Atendido | `lib/dashboard/periods.ts` | Granularidade `annual` | — |
| Dashboard | Comparativo entre empresas | Atendido | `lib/dashboard/periods.ts` · `mergeCompanySummaries()` | Merge e soma de summaries de múltiplas empresas | — |
| Dashboard | Cálculos centralizados no backend | Atendido | `lib/xlsx/mapping-engine.ts` + `DashboardMonthlySummary` | O frontend apenas lê o `dataJson` pre-calculado | — |
| Dashboard | Cache client-side | Atendido | `lib/dashboard/cache.ts` | Map em módulo + sessionStorage para stale markers + localStorage para action hints | — |
| Dashboard | Freshness polling | Atendido | `lib/dashboard/freshness.ts` · `GET /api/dashboard/freshness` | Polling com detecção de mudança entre abas | — |
| Dashboard | Loading states | Atendido | `app/page.tsx` | Estado `isLoading` com spinner/skeleton | — |
| Dashboard | Empty states | Parcial | `app/page.tsx` | Mensagem de ausência de dados existe, mas sem componente padronizado reutilizável | Baixa |
| Dashboard | Notificações de mudança | Atendido | `app/components/notifications-bell.tsx` | Bell com histórico de eventos em localStorage | — |
| Dashboard | Paginação de listagens (API) | Pendente | `GET /api/admin/users` · `GET /api/admin/companies` | Listagens sem `take`/`skip` no servidor. Paginação de imports é apenas client-side | Média |

---

### Fase 6 — Performance e Escalabilidade

| Área | Item avaliado | Status | Evidência no código | Observação | Prioridade |
|---|---|---|---|---|---|
| Performance | Índices no banco | Atendido | `prisma/schema.prisma` | `@@index([companyId, referenceMonth])` em LedgerEntry, ImportBatch, DashboardMonthlySummary; `@@index([companyId])` em UserCompany | — |
| Performance | Snapshot mensal pre-calculado | Atendido | `DashboardMonthlySummary` | Elimina recálculo de entradas brutas a cada request do dashboard | — |
| Performance | Conexão Prisma para Vercel | Atendido | `lib/prisma.ts` | `connection_limit=1` injetado automaticamente em ambiente Vercel | — |
| Performance | Evita N+1 queries | Atendido | `app/api/auth/me/route.ts` · `app/api/dashboard/summary/route.ts` | Uso de `include`/`select` adequados | — |
| Performance | Paginação nas APIs de listagem | Pendente | `GET /api/admin/users` · `GET /api/admin/companies` | Sem `take`/`skip`. Com crescimento de dados pode causar lentidão | Média |
| Performance | Processamento de upload síncrono | Parcial | `app/api/imports/xlsx/route.ts` | Processa arquivo na request HTTP. Risco de timeout em serverless com arquivos maiores | Alta |
| Performance | Cache HTTP para dashboard/summary | Atendido | `app/api/dashboard/summary/route.ts` | `Cache-Control: private, max-age=30, stale-while-revalidate=60` | — |
| Performance | Paginação da listagem de imports | Parcial | `app/app/imports/page.tsx` | Paginação implementada **apenas no frontend** (`useMemo`). Todos os registros são carregados da API | Média |
| Performance | Consultas pesadas sem índice | Atendido | Schema revisado | Campos de filtro principais indexados | — |

---

### Fase 7 — Segurança e Auditoria

| Área | Item avaliado | Status | Evidência no código | Observação | Prioridade |
|---|---|---|---|---|---|
| Segurança | Validação server-side em todos endpoints | Atendido | Todos os `route.ts` | Zod em todos os inputs | — |
| Segurança | Proteção cross-tenant | Atendido | `lib/company-access.ts` | `assertCompanyAccess()` antes de qualquer operação sensível | — |
| Segurança | Sanitização de input | Atendido | Zod schemas + `trim()` + `toLowerCase()` | — | — |
| Segurança | Limite de tamanho de upload | Atendido | `app/api/imports/xlsx/route.ts` L13 · `app/api/imports/route.ts` L13 | 10MB (XLSX) e 5MB (CSV) | — |
| Segurança | Variáveis sensíveis via `.env` | Atendido | `lib/auth/token.ts` · `lib/prisma.ts` | JWT_SECRET, DATABASE_URL, ADMIN_SEED_* | — |
| Segurança | `.env.example` | **Pendente** | — | Arquivo não encontrado no repositório. Onboarding e documentação prejudicados | Alta |
| Segurança | Logs de ações sensíveis | Parcial | Todos os `route.ts` | Apenas `console.error` nos blocos catch. Sem log estruturado de ações (importação, exclusão, login) | Média |
| Segurança | Auditoria de importações | Parcial | `ImportBatch` (status + lastError) | Registra status e erro, mas sem log de quem fez o quê e quando de forma auditável | Média |
| Segurança | Tabela de AuditLog | **Pendente** | — | Sem tabela de auditoria. Ações críticas (criação/exclusão de usuário, empresa, importação) não são rastreadas | Alta |
| Segurança | Exposição de secrets | Atendido | `lib/auth/token.ts` L14-18 | Falha explícita (`throw`) quando `JWT_SECRET` não está definido | — |
| Segurança | Tratamento seguro de arquivos | Atendido | `app/api/imports/xlsx/route.ts` | Validação de extensão + magic bytes antes de processar | — |
| Segurança | Endpoint que confia apenas no frontend | Atendido | — | Não identificado: todos os endpoints validam sessão e acesso | — |
| Segurança | Política de backup documentada | **Pendente** | — | Sem documentação de estratégia de backup | Baixa |

---

### Fase 8 — Infraestrutura e Deploy

| Área | Item avaliado | Status | Evidência no código | Observação | Prioridade |
|---|---|---|---|---|---|
| Infra | Docker Compose para banco local | Atendido | `docker-compose.yml` | PostgreSQL 16-alpine com volume persistente | — |
| Infra | Prisma migrations | Atendido | `prisma/migrations/` | 4 migrations cobrindo init → grupo → import → xlsx+mapping | — |
| Infra | Prisma seed | Atendido | `prisma/seed.ts` | Idempotente — cria admin + grupo + empresa principal se não existir | — |
| Infra | Scripts de build/lint/test | Atendido | `package.json` | `dev`, `build`, `lint`, `test`, `prisma:migrate`, `seed` | — |
| Infra | README com instruções de setup | Atendido | `README.md` | Passo a passo claro do zero ao seed | — |
| Infra | `.env.example` | **Pendente** | — | Variáveis `JWT_SECRET`, `DATABASE_URL`, `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`, `NEXT_PUBLIC_SITE_URL` precisam de exemplo | Alta |
| Infra | Configuração para Vercel | Atendido | `lib/prisma.ts` · `next.config.ts` | `serverExternalPackages` para Prisma/bcrypt, `connection_limit` automático | — |
| Infra | Health check endpoint | Parcial | `proxy.ts` `/_proxy-check` | Implementado no `proxy.ts`, mas este arquivo pode não estar ativo como middleware | Baixa |
| Infra | Logs em produção | Parcial | `lib/prisma.ts` | Prisma em modo `["error"]` em produção. Sem logger estruturado (pino/winston) | Baixa |
| Infra | Separação banco prod/local | Não aplicável no MVP | — | Controlado por `DATABASE_URL` no `.env` | — |
| Infra | Estratégia de rollback | Pendente | — | Migrations sem script de rollback documentado | Baixa |

---

### Fase 9 — Testes e Qualidade

| Área | Item avaliado | Status | Evidência no código | Observação | Prioridade |
|---|---|---|---|---|---|
| Testes | Framework de testes | Atendido | `vitest.config.ts` | Vitest + jsdom + `@testing-library/react` | — |
| Testes | Testes de autenticação | Atendido | `app/api/auth/login/route.test.ts` · `app/api/auth/me/route.test.ts` | Cobertura de login válido, inválido, cookie, companies | — |
| Testes | Testes de autorização | Atendido | `lib/auth/admin-guard.test.ts` | Testa ADMIN e CLIENT | — |
| Testes | Testes de importação (CSV) | Atendido | `app/api/imports/route.test.ts` | Idempotência e criação de batch | — |
| Testes | Testes de mapping engine | Atendido | `lib/xlsx/mapping-engine.test.ts` | PREFIX, EXACT, LIST, fórmulas calculadas | — |
| Testes | Testes de company access | Atendido | `lib/company-access.test.ts` | ADMIN acessa tudo, CLIENT restrito | — |
| Testes | Testes de cache/freshness | Atendido | `lib/dashboard/cache.test.ts` | action hint, stale markers, consume-once | — |
| Testes | Testes de parser XLSX | Atendido | `lib/xlsx/parser.test.ts` | — | — |
| Testes | Testes do parser CSV | Atendido | `lib/csv/ledger-parser.test.ts` | — | — |
| Testes | Testes de períodos/aggregation | Atendido | `lib/dashboard/periods.test.ts` | — | — |
| Testes | Testes de componentes UI | Parcial | `app/login/login-form.test.tsx` · `app/page.test.tsx` | Cobertura básica; componentes principais do dashboard sem teste | Média |
| Testes | Testes de integração E2E | **Pendente** | — | Sem testes de ponta a ponta (Playwright/Cypress) | Baixa |
| Testes | Testes do fluxo XLSX completo | **Pendente** | `app/api/imports/xlsx/route.ts` | Endpoint XLSX sem suite de teste dedicada | Alta |
| Testes | TypeScript sem `any` desnecessário | Parcial | `app/api/imports/xlsx/route.ts` | Alguns `as never` em mocks e `as Record<string, unknown>` em rawJson | Baixa |
| Testes | Lint configurado | Atendido | `eslint.config.mjs` · `package.json` | `eslint-config-next` | — |

---

### Fase 10 — Comercial, Planos e Limites

| Área | Item avaliado | Status | Evidência no código | Observação | Prioridade |
|---|---|---|---|---|---|
| Comercial | Plano/assinatura | **Pendente** | — | Sem tabela ou campo de plano no schema | Baixa |
| Comercial | Status da assinatura | **Pendente** | — | — | Baixa |
| Comercial | Limite de empresas por tenant | **Pendente** | — | — | Baixa |
| Comercial | Limite de usuários | **Pendente** | — | — | Baixa |
| Comercial | Limite de importações | **Pendente** | — | — | Baixa |
| Comercial | Trial/Bloqueio por inadimplência | **Pendente** | — | — | Baixa |
| Comercial | Controle de features por plano | **Pendente** | — | — | Baixa |
| Comercial | Preparação para billing futuro | Parcial | `prisma/schema.prisma` | Estrutura `Group` pode acomodar billing por grupo. `UserStatus { ACTIVE, INACTIVE }` permite bloqueio. Mas sem campos específicos de plano | Baixa |

> **Avaliação:** O modelo atual permite adicionar billing com uma migration adicionando `Plan` e `Subscription` ligados ao `Group`, sem refatoração estrutural maior.

---

### Fase 11 — Relatórios e Exportações

| Área | Item avaliado | Status | Evidência no código | Observação | Prioridade |
|---|---|---|---|---|---|
| Relatórios | Exportação PDF | **Pendente** | — | Sem biblioteca ou endpoint de geração de PDF | Baixa |
| Relatórios | Exportação XLSX/CSV | **Pendente** | — | Dados disponíveis no backend via `DashboardMonthlySummary`, mas sem endpoint de export | Baixa |
| Relatórios | Relatório mensal/anual | **Pendente** | — | Dashboard exibe os dados mas sem geração de documento | Baixa |
| Relatórios | Histórico de relatórios gerados | **Pendente** | — | — | Não aplicável no MVP |
| Relatórios | Backend fornece dados em formato adequado | Atendido | `GET /api/dashboard/summary` | `dataJson` estruturado por campo e mês, pronto para relatórios | — |

> **Avaliação:** A arquitetura existente está bem preparada para adicionar uma camada de relatórios. O `dataJson` do summary pode ser consumido diretamente por uma biblioteca de geração de PDF/XLSX sem duplicação de lógica.

---

### Fase 12 — Preparação para IA e Inteligência

| Área | Item avaliado | Status | Evidência no código | Observação | Prioridade |
|---|---|---|---|---|---|
| IA | Dados estruturados por empresa/período | Atendido | `DashboardMonthlySummary` | Série temporal por empresa em formato chave-valor numérico | — |
| IA | Histórico suficiente por empresa | Atendido | — | Modelo suporta histórico ilimitado de meses | — |
| IA | Camada de indicadores reutilizável | Atendido | `lib/dashboard/periods.ts` · `lib/dashboard/types.ts` | `aggregateSummaries`, `mergeCompanySummaries` são reutilizáveis | — |
| IA | Análise de variação mensal | Parcial | `lib/dashboard/periods.ts` | Dados disponíveis, mas sem módulo de análise de variação automática | Baixa |
| IA | Classificação automática de contas | Pendente | — | AccountMapping é manual; sem sugestão automática | Baixa |
| IA | Consistência dos dados para IA | Parcial | `LedgerEntry.rawJson` | `saldo_anterior` em campo JSON genérico reduz confiabilidade para treino/análise | Média |

---

## Riscos Críticos

### 🔴 Risco 1 — Middleware com nome errado (`proxy.ts`)

**Arquivo:** `proxy.ts`  
**Impacto:** O Next.js App Router reconhece apenas `middleware.ts` (ou `middleware.js`) na raiz do projeto. O arquivo `proxy.ts`, apesar de ter a estrutura correta (export default + export const config), **não é executado automaticamente** como middleware. Isso significa que as páginas `/`, `/app/*` podem estar acessíveis sem autenticação no lado do servidor, dependendo apenas da proteção client-side.  
**Ação:** Renomear `proxy.ts` → `middleware.ts`.

---

### 🔴 Risco 2 — Rate limit em memória em ambiente serverless

**Arquivo:** `lib/auth/rate-limit.ts`  
**Impacto:** O rate limit usa `Map` em memória de processo. Em produção na Vercel, cada instância serverless tem seu próprio Map, sem compartilhamento. Um atacante pode contornar o rate limit simplesmente gerando requests que caiam em instâncias diferentes.  
**Ação:** Substituir por solução persistida: Redis (Upstash), KV da Vercel, ou banco de dados.

---

### 🟠 Risco 3 — Sem `.env.example` no repositório

**Impacto:** Variáveis necessárias (`JWT_SECRET`, `DATABASE_URL`, `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`, `NEXT_PUBLIC_SITE_URL`) não estão documentadas em exemplo. Novos desenvolvedores ou deploys podem omitir variáveis críticas.  
**Ação:** Criar `.env.example` com valores placeholder e adicionar ao README.

---

## Plano de Ação Recomendado

### Prioridade Alta

1. **Renomear `proxy.ts` → `middleware.ts`** — corrige proteção de rotas frontend no runtime do Next.js.
2. **Criar `.env.example`** — com todas as variáveis necessárias documentadas com valores de exemplo.
3. **Substituir rate limit em memória** — usar Upstash Redis (gratuito no tier básico) para rate limit compartilhado entre instâncias.
4. **Adicionar suite de testes para `POST /api/imports/xlsx`** — o endpoint de importação XLSX é o mais crítico do sistema e não possui cobertura de testes dedicada.
5. **Implementar tabela de AuditLog** — registrar ações críticas: login, criação/exclusão de usuário, importação, exclusão de batch, recálculo.

### Prioridade Média

6. **Adicionar campo `saldo_anterior` dedicado em `LedgerEntry`** — remover dependência do `rawJson` genérico. Criar migration `ALTER TABLE LedgerEntry ADD COLUMN saldo_anterior DECIMAL(18,2)`.
7. **Paginação server-side nas APIs de listagem** — `GET /api/admin/users` e `GET /api/admin/companies` precisam de `take`/`skip` com validação de parâmetros.
8. **Paginação real na listagem de imports** — `GET /api/imports` deve aceitar `page`/`limit` e retornar total, em vez de carregar tudo e paginar no frontend.
9. **Separar AccountMapping por empresa** — adicionar `companyId` opcional ao `AccountMapping` para permitir mapeamentos personalizados por empresa.
10. **Adicionar log estruturado** — usar `pino` ou similar para logs em produção em vez de `console.error`.

### Prioridade Baixa

11. **Padronizar resposta de erro** — criar tipo `{ error: string; code?: string }` e helper `apiError()` para respostas consistentes.
12. **Processar importações de forma assíncrona** — para arquivos grandes, considerar queue (Vercel Queue, BullMQ) em vez de processamento síncrono na request.
13. **Adicionar exportação XLSX/CSV** — endpoint `GET /api/dashboard/export?companyId=&year=` usando `exceljs` ou similar.
14. **Documentar estratégia de backup** — adicionar seção no README sobre backup do banco em produção.
15. **Testes E2E com Playwright** — cobrir fluxo completo: login → seleção de empresa → import → dashboard.
16. **Preparar estrutura de billing** — adicionar tabelas `Plan` e `Subscription` ao schema ligadas a `Group`, sem impactar lógica atual.
17. **Health check ativo** — expor `GET /api/health` dedicado, independente do middleware.

---

## Sugestão de Próximos Commits / Tasks Técnicas

```
feat: rename proxy.ts to middleware.ts for Next.js runtime protection
chore: add .env.example with all required variables
fix: replace in-memory rate limit with Upstash Redis KV
test: add test suite for POST /api/imports/xlsx
feat(schema): add saldo_anterior column to LedgerEntry
feat(api): add server-side pagination to admin users and companies endpoints
feat(api): add server-side pagination to GET /api/imports
feat(schema): add AuditLog table and log critical actions
feat(schema): add optional companyId to AccountMapping
feat(api): add GET /api/dashboard/export endpoint (xlsx/csv)
chore: add pino structured logger
feat(api): add GET /api/health endpoint
test: add Playwright E2E tests for critical flows
feat(schema): add Plan and Subscription tables for future billing
```

---

## Resumo por Fase

| Fase | Atendidos | Parciais | Pendentes | Avaliação Geral |
|---|---|---|---|---|
| 1 — Autenticação | 10 | 3 | 1 | ✅ Sólida, salvo middleware nomeado errado |
| 2 — Multi-tenant | 11 | 1 | 0 | ✅ Bem implementado |
| 3 — Importação | 16 | 2 | 1 | ✅ Robusto, falta storage de arquivo |
| 4 — Modelo Contábil | 9 | 2 | 2 | ✅ Bom, saldo_anterior e tipagem pendentes |
| 5 — Dashboard | 11 | 2 | 1 | ✅ Completo e performático |
| 6 — Performance | 6 | 2 | 1 | ✅ Base boa, paginação de APIs pendente |
| 7 — Segurança | 8 | 2 | 3 | ⚠️ Auditoria e .env.example pendentes |
| 8 — Infraestrutura | 7 | 2 | 2 | ✅ Boa base local, prod precisa documentação |
| 9 — Testes | 10 | 2 | 2 | ✅ Boa cobertura unit, falta XLSX e E2E |
| 10 — Comercial | 0 | 1 | 7 | ⏳ Não aplicável no MVP atual |
| 11 — Relatórios | 1 | 0 | 4 | ⏳ Dados prontos, geração pendente |
| 12 — IA | 3 | 2 | 1 | ✅ Estrutura adequada para fase futura |
