# AI Context Summary

## Produto

`dash-contabil` e uma aplicacao web para importar arquivos contabeis, aplicar mapeamentos de contas e exibir dashboards financeiros por empresa, grupo e periodo.
O fluxo central envolve balancete/razao em XLSX/XLS/CSV, parsing, validacao, persistencia e visualizacao gerencial.
Admins gerenciam usuarios, empresas, grupos, mapeamentos, imports, auditoria e patrimonio.
Clientes acessam somente empresas/grupos vinculados.
Ha tambem a rota `/app/rentabilidade`, que mostra um demonstrativo multiempresa de rentabilidade liquida, rendimento bruto, IOF/IRRF e saldos bancarios usando os resumos mensais ja autorizados.

---

## Stack Principal

- Frontend: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Recharts.
- Backend: Next.js Route Handlers em `app/api`.
- Banco: PostgreSQL 16.
- ORM: Prisma 6.
- Auth: JWT com `jose`, cookie HTTP-only `dash_contabil_session`, senha com `bcryptjs`.
- Testes: Vitest, jsdom, Testing Library.
- Deploy: nao identificado; ambiente local usa Docker Compose para PostgreSQL.

---

## Dominio

Principais entidades:

- `User`, `Group`, `Company`, `UserCompany`, `CompanySetting`.
- `ImportBatch`, `LedgerEntry`, `RazaoEntry`, `UnmappedAccount`.
- `AccountMapping`, `DashboardMonthlySummary`.
- `AuditLog`, `SystemConfig`, `PatrimonioAsset`.
- Patrimonio usa secoes configuraveis (`SECTION`) e ativos vinculados por `sectionId`; total e calculado automaticamente.

Conceitos criticos:

- `referenceMonth` em formato `YYYY-MM`.
- `sourceType`: `XLSX`, `RAZAO`, `XLSX_CONSOLIDATED`.
- Mapeamentos por `EXACT`, `PREFIX`, `LIST`, `SUM`, `ABS_SUM` e formulas calculadas.
- Isolamento de dados por empresa/grupo.
- Rentabilidade: `/app/rentabilidade` monta visao de demonstrativo com empresas nas linhas, saldo de 31/12 do ano anterior, rentabilidade liquida mes a mes, totais trimestrais e saldo final do periodo. A composicao por clique usa os campos `RENDIMENTO_BRUTO`, `IOF_IRRF`, `RENTABILIDADE` e `SD_BANCARIO` do `DashboardMonthlySummary`.
- Locatarios: `/api/dashboard/tenants` calcula recebido por historico e, quando o Razao tem contas a receber por locatario, calcula `payment` mensal com provisionado, pago, saldo em aberto e status (`PAID`, `OPEN`, `PARTIAL`). A exibicao dos cards respeita `CompanySetting` com a chave `dashboard.tenants.display`.

---

## Arquitetura

Next.js App Router com telas em `app/**/page.tsx`, APIs em `app/api/**/route.ts` e componentes em `app/components`.
Logica reutilizavel fica em `lib`, especialmente `auth`, `xlsx`, `csv`, `dashboard`, `company-access`, `audit` e `prisma`.
Prisma centraliza acesso ao banco e migrations ficam em `prisma/migrations`.
Route handlers retornam JSON e usam Zod/helpers para validacao e autorizacao.

---

## Regras Criticas

- Toda API protegida deve validar sessao no backend.
- Toda rota admin deve usar `requireAdmin`.
- Toda consulta por empresa deve validar acesso por `UserCompany` ou regra equivalente.
- Clientes nao podem acessar empresas/grupos fora do seu vinculo.
- Importacao deve validar arquivo, tamanho, extensao, CNPJ/periodo quando disponivel, permissao e idempotencia por checksum.
- Nova importacao concluida do mesmo `sourceType`, empresa e mes deve evitar sobrescrita acidental.
- Mapeamentos contabeis afetam dashboard e devem ter testes.
- Status mensal de pagamento de locatarios e calculado de `RazaoEntry` por pareamento de competencia/data/lote/valor/centro de custo: provisao e debito em contas a receber (`1.1.30.*` ou `1.1.20.100.*`) contra receita de aluguel/condominio/ADM; baixa e credito na propria conta a receber, com banco/caixa como confirmacao quando presente.
- Parametrizacoes por empresa ficam em `CompanySetting`; a primeira chave usada e `dashboard.tenants.display`, com modo `ALL` ou `SELECTED` e lista de chaves de locatarios visiveis.
- Mudancas de schema exigem migration Prisma e revisao de impacto.
- Nao expor `.env`, `JWT_SECRET`, hashes ou dados sensiveis.
- Acoes administrativas relevantes devem registrar auditoria.
- Ativos patrimoniais devem pertencer a uma secao; `Total do Patrimonio` nao e secao editavel/persistida e a copia entre competencias deve bloquear destino com dados.

---

## Como Desenvolver Neste Projeto

- Antes de criar codigo novo, verificar padrao existente no mesmo modulo.
- Preferir helpers em `lib` para regra reutilizavel.
- Validar entradas com Zod em APIs.
- Nao colocar regra de negocio critica apenas em componente visual.
- Usar `NextResponse.json` com `{ error: "..." }` para erros.
- Reusar `AppShell` e componentes existentes no frontend.
- Usar Prisma com `select` explicito quando retornar dados.
- Criar ou atualizar testes proximos ao arquivo alterado.
- Rodar testes/lint/build conforme impacto.
- Atualizar `docs/AI_PROJECT_KNOWLEDGE_BASE.md` e este resumo quando houver mudanca relevante.

---

## Testes

Rodar:

```bash
npm run test
npm run lint
npm run build
```

Testes ficam ao lado do codigo como `*.test.ts` ou `*.test.tsx`.
Existem testes para auth, imports, parsers XLSX/CSV, mapping engine, dashboard periods/cache, company access e alguns componentes.
Rotas recentes de patrimonio/grupos e alguns endpoints admin podem precisar de cobertura adicional.

---

## Atencao

- Existem arquivos `.env` reais locais; documentar apenas nomes de variaveis.
- README cita `.env.example`, mas o arquivo nao foi encontrado.
- `proxy.ts` tem logs verbosos.
- Rate limit de login parece em memoria.
- Importacao XLSX/Razao concentra muitas regras em handler grande.
- Documentacao tecnica existente pode estar parcialmente desatualizada frente ao schema atual.
- Mudancas locais nao commitadas existem em patrimonio, grupos, app shell, Prisma e seed; nao reverter sem pedido explicito.
