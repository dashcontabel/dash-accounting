# AI Project Knowledge Base

## 1. Visao Geral do Projeto

O projeto `dash-contabil` e uma aplicacao web para importar, consolidar e visualizar dados contabeis de empresas. O fluxo principal identificado no codigo e no README e: upload de arquivos contabeis XLSX/XLS/CSV, parsing de balancete ou razao, aplicacao de regras de mapeamento contabel, persistencia de resumos mensais e exibicao de dashboards financeiros.

Usuarios autenticados acessam dashboards, indices, patrimonio, documentacao interna e, conforme perfil, telas administrativas. Usuarios `ADMIN` gerenciam usuarios, empresas, grupos, mapeamentos, importacoes, auditoria e patrimonio. Usuarios `CLIENT` acessam apenas dados vinculados as suas empresas/grupos.

> Pendente de confirmacao:
> - O README e a documentacao existente nao descrevem contrato comercial, personas formais ou ambiente de deploy de producao.

---

## 2. Area de Negocio

- Segmento atendido: contabilidade, gestao financeira e analise de demonstrativos empresariais.
- Tipo de usuario: administradores internos e clientes com acesso restrito a empresas autorizadas.
- Problema de negocio: transformar arquivos contabeis operacionais em indicadores, graficos e consultas por empresa, periodo, centro de custo e grupo.
- Objetivo do sistema: reduzir trabalho manual de consolidacao de balancetes/razoes e facilitar leitura gerencial dos dados.
- Valor entregue: dashboards multiempresa, importacao validada, mapeamento de contas para campos gerenciais, rastreabilidade por auditoria e controle de acesso.

---

## 3. Dominio da Aplicacao

Entidades principais encontradas em `prisma/schema.prisma`:

- `User`: usuario autenticavel, com `role` `ADMIN` ou `CLIENT` e `status` `ACTIVE` ou `INACTIVE`.
- `Group`: agrupador de empresas. Tambem e usado por patrimonio.
- `Company`: empresa vinculada a um grupo, com documento opcional e status ativo/inativo.
- `UserCompany`: relacao N:N entre usuario e empresa, usada para isolamento de acesso de clientes.
- `CompanySetting`: configuracoes flexiveis por empresa, com chave unica por `companyId` e `key`.
- `ImportBatch`: lote de importacao por empresa, mes de referencia, tipo de fonte, checksum e status.
- `LedgerEntry`: lancamentos/linhas de balancete importadas.
- `RazaoEntry`: linhas de razao contabil, com data, conta, centro de custo, historico, debito, credito e saldo.
- `AccountMapping`: regra global que mapeia codigos contabeis para campos do dashboard.
- `DashboardMonthlySummary`: resumo mensal por empresa, armazenado em JSON.
- `UnmappedAccount`: contas importadas sem mapeamento.
- `AuditLog`: trilha de auditoria de login, imports, usuarios, empresas, grupos, mapeamentos e patrimonio.
- `SystemConfig`: configuracoes simples por chave/valor.
- `PatrimonioAsset`: linhas de patrimonio por grupo e mes. Secoes usam `rowType = SECTION`; ativos usam `rowType = ASSET` e pertencem a uma secao por `sectionId`. `TOTAL` e calculado automaticamente na API e nao deve ser persistido como cadastro comum.

Termos importantes:

- `referenceMonth`: mes de referencia em formato `YYYY-MM`.
- `sourceType`: origem do lote: `XLSX`, `RAZAO` ou `XLSX_CONSOLIDATED`.
- `checksum`: SHA-256 do arquivo, usado na idempotencia de importacao.
- `dashboardField`: campo gerencial calculado a partir de contas contabeis.
- `matchType`: estrategia de matching de conta: `EXACT`, `PREFIX` ou `LIST`.
- `valueColumn`: coluna contabel agregada: `saldo_atual`, `debito`, `credito`, `saldo_anterior`.
- `aggregation`: `SUM` ou `ABS_SUM`.

Fluxos de dominio:

- Login cria cookie HTTP-only `dash_contabil_session` com JWT.
- Dashboard consulta `/api/auth/me`, empresas permitidas e `/api/dashboard/summary`.
- Rentabilidade consulta `/api/auth/me` e `/api/dashboard/summary` para montar um demonstrativo multiempresa com saldo inicial, rentabilidade liquida mensal, totais trimestrais e saldo final.
- Importacao recebe arquivo, valida empresa/permissao, detecta formato, parseia linhas, aplica mapeamentos, cria lote e atualiza `DashboardMonthlySummary`.
- Mapeamentos podem ser semeados via `/api/admin/mappings/seed`.
- Clientes acessam apenas empresas/grupos ligados por `UserCompany`.
- Patrimonio e consultado por grupo/mes e criado/alterado por admin. Ativos devem pertencer a secoes configuraveis. O patrimonio pode ser copiado entre competencias do mesmo grupo quando o destino ainda nao possui dados.
- Configuracoes administrativas por empresa ficam em `/app/admin/settings`; a primeira parametrizacao controla quais locatarios aparecem no dashboard.

---

## 4. Regras de Negocio Principais

### Regra: Controle de acesso por perfil

Descricao:
Usuarios possuem papel `ADMIN` ou `CLIENT`. Admin pode administrar recursos; cliente tem acesso restrito a empresas/grupos vinculados.

Onde aparece:
- `proxy.ts`
- `lib/auth/admin-guard.ts`
- `lib/company-access.ts`
- Rotas em `app/api/admin/*`
- Rotas de dashboard, imports e patrimonio

Impacto no codigo:
Toda rota protegida deve buscar sessao, validar usuario ativo e aplicar filtro por papel/empresa/grupo.

Pontos de atencao:
- Nao confiar apenas no menu do frontend.
- Toda nova rota admin deve usar `requireAdmin`.
- Toda rota por empresa deve usar `assertCompanyAccess` ou filtro equivalente.

### Regra: Isolamento por empresa e grupo

Descricao:
Admins acessam empresas ativas de grupos ativos. Clientes acessam somente empresas associadas em `UserCompany`; para patrimonio, acesso de cliente deriva dos grupos dessas empresas.

Onde aparece:
- `lib/company-access.ts`
- `app/api/dashboard/summary/route.ts`
- `app/api/patrimonio/route.ts`
- `app/api/auth/me/route.ts`

Impacto no codigo:
Consultas devem filtrar `isActive: true`, grupo ativo e relacoes do usuario quando ele nao for admin.

Pontos de atencao:
- Nao retornar dados de empresas inativas ou grupos inativos.
- Validar todos os `companyId` quando endpoints aceitarem multiplas empresas.

### Regra: Importacao idempotente por checksum

Descricao:
`ImportBatch` possui chave unica por `companyId`, `referenceMonth` e `checksum`. Reenvio do mesmo arquivo pode retornar resultado idempotente.

Onde aparece:
- `prisma/schema.prisma`
- `app/api/imports/xlsx/route.ts`

Impacto no codigo:
Antes de criar novo lote, a rota verifica lote existente e pode reaplicar mapeamentos atuais sobre linhas ja armazenadas.

Pontos de atencao:
- Manter checksum do arquivo original.
- Alteracoes de mapeamento podem exigir recalculate/reprocessamento.

### Regra: Uma importacao concluida por tipo/empresa/mes

Descricao:
A rota bloqueia nova importacao `DONE` para a mesma empresa, mes e `sourceType`, salvo mesmo checksum idempotente.

Onde aparece:
- `app/api/imports/xlsx/route.ts`

Impacto no codigo:
Evita sobrescrita acidental de balancete, balancete consolidado ou razao ja concluido.

Pontos de atencao:
- Para substituir dados, o fluxo esperado e excluir importacao existente antes de reimportar.

### Regra: Validacao de CNPJ e periodo do arquivo

Descricao:
Quando o arquivo contem CNPJ, ele deve bater com `Company.document`. Para XLSX nao consolidado, periodo detectado deve corresponder ao `referenceMonth` informado.

Onde aparece:
- `lib/xlsx/parser.ts`
- `app/api/imports/xlsx/route.ts`

Impacto no codigo:
Retorna erro `422` quando arquivo e empresa/periodo nao correspondem.

Pontos de atencao:
- Nao remover essa validacao em melhorias de parser.
- Documentos devem ser comparados sem mascara.

### Regra: Motor de mapeamento contabil

Descricao:
`AccountMapping` transforma linhas contabeis em campos do dashboard por matching `EXACT`, `PREFIX` ou `LIST`, agregacao `SUM`/`ABS_SUM` e campos calculados por formula segura.

Onde aparece:
- `lib/xlsx/mapping-engine.ts`
- `lib/xlsx/formula.ts`
- `app/api/admin/mappings/*`
- `app/api/admin/mappings/seed/route.ts`

Impacto no codigo:
Mudancas em dashboard fields ou formulas afetam resumos, indices e visualizacoes.

Pontos de atencao:
- Testar mapeamentos estaticos e calculados.
- Atualizar seeds e documentacao quando novo campo gerencial for criado.

### Regra: Demonstrativo de rentabilidade

Descricao:
A rota `/app/rentabilidade` apresenta uma visao em formato de demonstrativo por empresa, usando os resumos mensais ja calculados. A tabela mostra empresas nas linhas, saldo bancario em 31/12 do ano anterior, rentabilidade liquida mes a mes, total por trimestre dentro do intervalo selecionado e saldo bancario final do periodo.

Onde aparece:
- `app/app/rentabilidade/page.tsx`
- `lib/dashboard/rentabilidade.ts`
- `app/components/app-shell.tsx`
- `app/api/dashboard/summary/route.ts`

Impacto no codigo:
A tela nao cria nova API nem nova tabela. Ela reutiliza `/api/auth/me` para descobrir empresas permitidas e `/api/dashboard/summary` para buscar os dados, preservando a validacao backend de usuario ativo, empresa ativa, grupo ativo e vinculo `UserCompany` para clientes.

Campos usados:
- `SD_BANCARIO`
- `RENDIMENTO_BRUTO`
- `IOF_IRRF`
- `RENTABILIDADE`

Pontos de atencao:
- O saldo inicial depende do resumo de dezembro do ano anterior (`YYYY-12`).
- A rentabilidade liquida usa `RENTABILIDADE` quando existe; se faltar, e derivada de `RENDIMENTO_BRUTO - IOF_IRRF`.
- Detalhe por conta bancaria nao esta disponivel no resumo mensal; se for exigido, criar endpoint protegido usando `LedgerEntry`/`RazaoEntry` e validar acesso por empresa no backend.
- Nao duplicar regras de permissao no frontend; qualquer dado novo deve continuar vindo de endpoint autorizado.

### Regra: Merge entre balancete e razao

Descricao:
Balancete (`XLSX`) e autoritativo para campos que fornece. Razao (`RAZAO`) preserva valores nao-zero de campos patrimoniais vindos de balancete para nao quebrar indices de liquidez.

Onde aparece:
- `lib/xlsx/mapping-engine.ts`

Impacto no codigo:
Regras de merge evitam perda de campos de balanco quando razao nao inclui todas as contas.

Pontos de atencao:
- Campos em `BALANCE_SHEET_FIELDS` precisam ser revisados ao criar novos indicadores patrimoniais.

### Regra: Status de pagamento por locatario no Razao

Descricao:
Empresas com Razao e centro de custo podem exibir status mensal de pagamento por locatario quando o Razao possui o fluxo de contas a receber por locatario.

Fluxo contabil esperado:
- Provisao mensal: debito em Ativo / Contas a Receber do locatario e credito em Receita de aluguel/condominio/ADM.
- Baixa por pagamento: debito em Banco/Caixa e credito na mesma conta a receber do locatario.
- Em arquivos reais, contas a receber por locatario podem aparecer como `1.1.30.*` ou como `1.1.20.100.*` com centro de custo e nome do locatario na conta.
- A receita de contrapartida pode estar no mesmo lote ou em lote separado, mas deve bater por competencia, data, centro de custo, valor e historico/nome do locatario.
- A baixa pode ser identificada pelo credito na propria conta a receber do locatario mesmo quando a linha de banco nao aparece no detalhe do Razao; quando banco aparece agrupado, a soma dos debitos bancarios pode bater com a soma dos creditos em contas a receber do lote.

Onde aparece:
- `lib/dashboard/tenant-payments.ts`
- `app/api/dashboard/tenants/route.ts`
- `app/components/tenant-section.tsx`

Impacto no codigo:
A regra calcula status sem criar novas tabelas, usando `RazaoEntry` ja importado. Como `counterpartCode` armazena o codigo interno da contrapartida do arquivo, a identificacao nao depende dele isoladamente: os lancamentos sao pareados por mes/data/lote/valor, centro de custo e pela natureza da outra ponta contabil. Pagamentos sao alocados por FIFO nas provisoes abertas do mesmo locatario, respeitando centro de custo quando disponivel.

Status calculados:
- `PAID`: valor pago maior ou igual ao provisionado.
- `OPEN`: nenhuma baixa alocada.
- `PARTIAL`: baixa menor que o valor provisionado.

Pontos de atencao:
- Movimentos bancarios em conta a receber sem contrapartida de receita nao viram provisao.
- Debitos em A/R que representam juros ou ajustes nao viram provisao de aluguel/condominio quando nao ha receita de aluguel/condominio/ADM correspondente.
- O card de locatarios continua aceitando o fluxo antigo de receitas por historico, mas o bloco mensal `payment` so aparece quando ha provisao em contas a receber.
- Historicos de aluguel/condominio tambem podem inferir locatarios dinamicamente, alem da lista conhecida hardcoded.

### Regra: Parametrizacao de locatarios visiveis

Descricao:
Administradores podem escolher, por empresa, se o dashboard deve exibir todos os locatarios detectados ou somente uma lista selecionada. A configuracao fica em `CompanySetting` com a chave `dashboard.tenants.display`.

Onde aparece:
- `app/app/admin/settings/page.tsx`
- `app/api/admin/settings/tenant-display/route.ts`
- `lib/settings/company-settings.ts`
- `app/api/dashboard/tenants/route.ts`

Impacto no codigo:
O endpoint `/api/dashboard/tenants` continua calculando todos os locatarios detectaveis, mas filtra a resposta final conforme a parametrizacao da empresa. Quando `mode = ALL`, todos os cards sao exibidos. Quando `mode = SELECTED`, apenas `visibleTenantKeys` aparecem. Admins podem consultar a rota com `includeHidden=true` para a tela de configuracoes listar todos os locatarios disponiveis.

Pontos de atencao:
- As chaves persistidas usam normalizacao sem acento/pontuacao por `tenantDisplayKey`.
- A configuracao e por empresa, nao por usuario.
- Novas parametrizacoes futuras devem reaproveitar `CompanySetting` quando forem simples chave/valor por empresa.
- Alteracoes nessa configuracao registram auditoria com `AuditAction.SETTING_UPDATE`.

### Regra: Auditoria de acoes sensiveis

Descricao:
Acoes como login, importacao, exclusao de import, alteracoes de usuarios, empresas, grupos, mapeamentos e patrimonio sao registradas em `AuditLog`.

Onde aparece:
- `lib/audit.ts`
- `AuditAction` no Prisma
- Rotas admin/import/patrimonio

Impacto no codigo:
Novas acoes administrativas relevantes devem escrever log de auditoria.

Pontos de atencao:
- Nao gravar secrets ou dados sensiveis desnecessarios em `metadata`.

### Regra: Patrimonio organizado por secoes configuraveis

Descricao:
O Demonstrativo Patrimonial e organizado por secoes reais. Cada ativo patrimonial (`rowType = ASSET`) deve pertencer a uma secao (`rowType = SECTION`) por `sectionId`. O usuario admin pode criar uma nova secao ao cadastrar ou editar um ativo.

Onde aparece:
- `prisma/schema.prisma`
- `app/api/patrimonio/route.ts`
- `app/api/patrimonio/[id]/route.ts`
- `app/api/patrimonio/copy/route.ts`
- `app/app/patrimonio/page.tsx`

Impacto no codigo:
Novos ativos patrimoniais devem informar uma secao existente ou criar uma nova secao. A linha `Total do Patrimonio` nao e cadastro manual; ela e calculada automaticamente na listagem com base nos ativos validos da competencia.

Pontos de atencao:
- Nao permitir cadastro, edicao ou copia de `Total do Patrimonio` como registro comum.
- Nao remover secao com ativos vinculados.
- Ao copiar patrimonio entre competencias, copiar somente secoes e ativos do mesmo grupo.
- Bloquear copia quando a competencia destino ja possuir patrimonio cadastrado.
- Nao mesclar nem sobrescrever dados de destino automaticamente.

---

## 5. Arquitetura Geral

Arquitetura observada:

- Next.js App Router com paginas em `app/**/page.tsx` e APIs em `app/api/**/route.ts`.
- Frontend majoritariamente client-side nas telas interativas, com componentes em `app/components`.
- Backend implementado como Route Handlers do Next.js.
- Persistencia via Prisma Client centralizado em `lib/prisma.ts`.
- Logica de dominio reutilizavel em `lib`, especialmente `lib/xlsx`, `lib/csv`, `lib/auth`, `lib/dashboard` e helpers de acesso.
- Banco PostgreSQL local via Docker Compose.

Fluxo principal:

1. Usuario autentica em `/api/auth/login`.
2. Cookie HTTP-only e validado por `proxy.ts` nas paginas protegidas e por helpers nas APIs.
3. Tela consulta APIs para empresas, dashboards, importacoes e administracao.
4. APIs validam entrada com Zod ou checks manuais, consultam Prisma e retornam JSON.
5. Importacao parseia arquivo com `xlsx`/`csv-parse`, aplica mapeamentos e persiste entradas/resumos.

Padroes arquiteturais observados:

- Separacao parcial entre handlers HTTP e logica reutilizavel em `lib`.
- Rotas administrativas agrupadas em `/api/admin`.
- Controle de acesso replicado em algumas rotas, com helpers para casos comuns.
- Testes unitarios/coletivos proximos aos arquivos testados.

> Atencao:
> - Algumas regras ainda vivem dentro de route handlers grandes, especialmente importacao.
> - Ha `console.log` no `proxy.ts`; em producao isso pode gerar ruido e expor metadados operacionais.

---

## 6. Stack Tecnologica

| Tecnologia | Uso no projeto | Observacoes |
|---|---|---|
| TypeScript | Linguagem principal | `strict` ativo no `tsconfig.json`. |
| Next.js 16.1.4 | Frontend e backend | App Router, pages e route handlers. |
| React 19.2.3 | UI | Telas interativas com client components. |
| Tailwind CSS v4 | Estilizacao | Classes utilitarias em componentes. |
| Prisma 6.3.1 | ORM | Schema em `prisma/schema.prisma`, migrations em `prisma/migrations`. |
| PostgreSQL 16 | Banco de dados | Ambiente local via `docker-compose.yml`. |
| jose | JWT | Assinatura/verificacao HS256. |
| bcryptjs | Hash de senha | Usado no login e seed. |
| zod | Validacao | Schemas em rotas e parsers. |
| xlsx | Leitura de planilhas | Parser de balancete/razao. |
| csv-parse | Leitura CSV | Parser em `lib/csv`. |
| Recharts | Graficos | Dashboard, comparativos e visualizacoes. |
| sonner | Notificacoes | Toasts no frontend. |
| Vitest | Testes | `npm run test`. |
| Testing Library | Testes React | Componentes e formularios. |
| ESLint 9 + next config | Lint | `npm run lint`. |
| Docker Compose | Infra local | PostgreSQL local. |

---

## 7. Infraestrutura e Deploy

Ambiente local:

- Instalar dependencias com `npm install`.
- Subir PostgreSQL com `docker compose up -d`.
- Rodar migrations com `npm run prisma:migrate`.
- Rodar seed com `npm run seed`.
- Desenvolvimento com `npm run dev`.
- Checks principais: `npm run test`, `npm run lint`, `npm run build`.

Variaveis de ambiente identificadas sem valores:

- `DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_SEED_EMAIL`
- `ADMIN_SEED_PASSWORD`

Arquivos observados:

- `.env.local` existe localmente e contem variaveis reais. Nao expor valores.
- README cita `.env.example`, mas nenhum `.env.example` apareceu no inventario de arquivos.
- `docker-compose.yml` define PostgreSQL local `postgres:16-alpine`.
- `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `vitest.config.ts` existem.

Deploy:

> Pendente de confirmacao:
> - Provedor de producao, pipeline CI/CD e estrategia de secrets nao foram identificados no codigo.

Cuidados:

- Nunca commitar valores reais de `.env`.
- Garantir `JWT_SECRET` forte em producao.
- `secure` do cookie depende de `NODE_ENV === "production"`.

---

## 8. Estrutura de Pastas

| Pasta/arquivo | Finalidade | Observacoes |
|---|---|---|
| `app` | App Router, paginas, layout, manifest, estilos globais e API routes | Usar `page.tsx` para telas e `route.ts` para endpoints. |
| `app/api` | Backend HTTP via Next Route Handlers | Validar auth, permissao e entrada em todas as rotas sensiveis. |
| `app/app` | Telas internas sob `/app/*` | Inclui imports, indices, patrimonio, admin e docs internas. |
| `app/components` | Componentes reutilizaveis de UI | Evitar regra de negocio critica aqui. |
| `app/login` | Tela e formulario de login | Testes de formulario ficam proximos. |
| `lib` | Logica compartilhada de dominio/infra | Preferir colocar parsers, auth, dashboard, cache e helpers aqui. |
| `lib/auth` | Token, sessao, rate limit e guarda admin | Base para protecao backend. |
| `lib/xlsx` | Parser XLSX/Razao, formulas, mapping engine | Area critica de importacao contabil. |
| `lib/csv` | Parser CSV/Razao | Coberto por testes. |
| `lib/dashboard` | Tipos, periodos, cache e freshness | Usado pelo dashboard principal. |
| `prisma` | Schema, migrations e seed | Alteracoes de modelo exigem migration e cuidado com dados existentes. |
| `scripts` | Scripts operacionais/analisadores | Inclui backup, recalculate e validacoes de arquivos. |
| `docs` | Documentacao tecnica/produto e arquivos de exemplo | Arquivos XLSX em `docs/arquivo` sao insumos/exemplos, nao documentacao textual. |
| `public` | Assets estaticos, icones e service worker | Manter imagens e manifest assets aqui. |
| `backups`, `relatorio` | Artefatos auxiliares locais | Confirmar uso antes de depender em feature nova. |

---

## 9. Padroes de Codigo

### Padrao observado: Route handlers diretos

Descricao:
Rotas exportam funcoes `GET`, `POST`, `PATCH`, `DELETE` etc. e retornam `NextResponse.json`.

Exemplo encontrado:
`app/api/admin/companies/route.ts`, `app/api/dashboard/summary/route.ts`.

Recomendacao:
Manter validacao, auth e tratamento de erro explicitos. Para handlers grandes, mover regras puras para `lib`.

### Padrao observado: Validacao com Zod

Descricao:
Schemas locais validam bodies, parametros ou estruturas de parser.

Exemplo encontrado:
`loginSchema`, `createCompanySchema`, `formSchema`, `mappingSchema`.

Recomendacao:
Usar Zod para toda entrada externa nova. Retornar `400` para payload invalido.

### Padrao observado: Prisma com selects explicitos

Descricao:
Varias rotas usam `select` para limitar campos retornados.

Exemplo encontrado:
`app/api/dashboard/summary/route.ts`, `app/api/admin/companies/route.ts`.

Recomendacao:
Evitar retornar modelos inteiros quando nao necessario, especialmente usuarios e auditoria.

### Padrao observado: Erros em portugues sem acentos consistentes

Descricao:
Mensagens de erro usam portugues, frequentemente sem acentos por historico de encoding.

Exemplo encontrado:
`"Nao autenticado."`, `"Dados invalidos."`, `"Acesso negado."`.

Recomendacao:
Manter consistencia textual ate resolver encoding do projeto.

### Padrao observado: Testes proximos ao codigo

Descricao:
Arquivos `*.test.ts` e `*.test.tsx` ficam ao lado de rotas, libs e componentes.

Exemplo encontrado:
`lib/xlsx/parser.test.ts`, `app/api/auth/login/route.test.ts`.

Recomendacao:
Criar teste junto do modulo alterado.

### Inconsistencias encontradas

> Atencao:
> - `proxy.ts` usa logs verbosos e comentario com caracteres quebrados.
> - Algumas funcoes de dominio importantes estao embutidas em route handlers grandes.
> - Documentacao existente parece parcialmente desatualizada frente ao schema atual, por exemplo `ImportSourceType` agora inclui `RAZAO` e `XLSX_CONSOLIDATED`.

---

## 10. Padroes de Backend

- Rotas ficam em `app/api/**/route.ts`.
- Rotas administrativas usam `/api/admin/*` e devem chamar `requireAdmin`.
- Autenticacao comum usa `getUserFromRequest(request)`.
- Validacao de corpo usa Zod quando possivel.
- Respostas seguem JSON com objeto de dados ou `{ error: "..." }`.
- Status comuns:
  - `200` sucesso.
  - `201` criacao.
  - `400` dados invalidos/parametro obrigatorio.
  - `401` nao autenticado.
  - `403` acesso negado.
  - `409` conflito de importacao.
  - `422` arquivo/periodo/CNPJ inconsistente.
  - `429` rate limit de login.
  - `500` falha inesperada.
- Banco e acessado via `prisma` de `@/lib/prisma`.
- Auditoria deve usar `writeAuditLog` com `AuditAction`.
- Importacao XLSX roda em runtime Node (`export const runtime = "nodejs"`).

Toda nova feature backend deve:

- Validar usuario ativo.
- Validar permissao no backend.
- Validar entrada.
- Usar transacao Prisma quando persistir multiplas escritas dependentes.
- Evitar expor hashes, tokens, secrets ou metadados sensiveis.
- Adicionar teste unitario ou de handler quando viavel.

---

## 11. Padroes de Frontend

- Telas interativas usam `"use client"`.
- Navegacao e layout principal ficam em `AppShell`.
- Menu exibe itens conforme `role`, `email` owner e flags como `adminOnly`/`clientHidden`.
- Dashboard principal em `app/page.tsx` usa hooks React, cache local de dashboard, filtros de periodo e Recharts.
- Componentes reutilizaveis ficam em `app/components`.
- Chamadas a API usam `fetch` no client, com estados locais de loading, mensagem e erro.
- Graficos pesados sao carregados com `next/dynamic` e `ssr: false` quando necessario.
- Formularios devem validar no frontend para UX, mas a regra critica deve existir tambem no backend.
- Tema claro/escuro usa `theme-provider`.

Boas praticas para novas telas:

- Reusar `AppShell`, componentes de selecao de empresa, periodo e feedback existentes.
- Nao duplicar calculos contabeis complexos no componente visual.
- Manter cards e graficos desacoplados de chamadas diretas quando houver logica reutilizavel.
- Garantir estados de loading, erro e vazio.

---

## 12. Padroes de Banco de Dados

ORM:

- Prisma com datasource PostgreSQL.
- Migrations em `prisma/migrations`.
- Seed em `prisma/seed.ts` via `npm run seed`.

Convencoes observadas:

- IDs `String @id @default(cuid())`.
- Datas `createdAt` com `now()` e `updatedAt` com `@updatedAt`.
- Soft status por `isActive` em `Group`/`Company` e `status` em `User`.
- Valores monetarios como `Decimal @db.Decimal(18, 2)`.
- JSON para dados flexiveis: `totalsJson`, `rawJson`, `dataJson`, `metadata`, `codes`.
- Indices por empresa/mes/import batch em tabelas de volume.
- Relacoes com `onDelete: Cascade` para dados dependentes de empresa/importacao e `Restrict` para grupo de empresa/patrimonio.

Entidades principais e relacoes:

- `Group` 1:N `Company`.
- `User` N:N `Company` via `UserCompany`.
- `Company` 1:N `ImportBatch`, `LedgerEntry`, `RazaoEntry`, `DashboardMonthlySummary`.
- `ImportBatch` 1:N `LedgerEntry`, `RazaoEntry`, `UnmappedAccount`.
- `Group` 1:N `PatrimonioAsset`.
- `PatrimonioAsset` possui auto-relacionamento opcional por `sectionId`: ativos apontam para linhas de secao do mesmo grupo/competencia.

Cuidados ao alterar schema:

- Criar migration Prisma.
- Avaliar impacto em dados existentes e indices.
- Atualizar seed se novas entidades/campos forem obrigatorios.
- Atualizar testes e esta base de conhecimento.
- Validar rotas que fazem `select` explicito.

---

## 13. Padroes de API

Estrutura de endpoints observada:

- `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- `/api/context/active-company`
- `/api/dashboard/summary`, `/api/dashboard/freshness`, `/api/dashboard/cost-centers`, `/api/dashboard/field-codes`, `/api/dashboard/recalculate`, `/api/dashboard/transactions`, `/api/dashboard/tenants`
- `/api/imports`, `/api/imports/xlsx`, `/api/imports/[id]`, `/api/imports/bulk-delete`
- `/api/admin/users`, `/api/admin/users/[id]`
- `/api/admin/companies`, `/api/admin/companies/[id]`
- `/api/admin/groups`, `/api/admin/groups/[id]`
- `/api/admin/mappings`, `/api/admin/mappings/[id]`, `/api/admin/mappings/seed`
- `/api/admin/audit`, `/api/admin/audit/settings`
- `/api/groups`
- `/api/patrimonio`, `/api/patrimonio/[id]`, `/api/patrimonio/months`, `/api/patrimonio/copy`

Padrao de request:

- JSON para CRUD e filtros simples.
- Query params para consultas (`companyId`, multiplos `companyId`, `groupId`, `month`).
- `multipart/form-data` para upload em `/api/imports/xlsx`.

Padrao de response:

- Objetos nomeados: `{ user }`, `{ companies }`, `{ assets }`, `{ imports }`, `{ summary }`.
- Erros: `{ error: "Mensagem" }`.

Autorizacao:

- Páginas protegidas via `proxy.ts`.
- APIs precisam validar sessao e permissao por conta propria.

Paginacao:

> Pendente de confirmacao:
> - Nao foi identificado um padrao geral de paginacao.

Filtros:

- Dashboard aceita uma ou varias empresas.
- Patrimonio aceita `groupId` e `month`.
- Copia de patrimonio usa `groupId`, `sourceMonth` e `targetMonth`, sempre no mesmo grupo e sem sobrescrever destino existente.
- Imports e transacoes usam filtros por empresa/periodo conforme rota.

---

## 14. Autenticacao e Autorizacao

Login:

- `POST /api/auth/login`
- Valida email/senha com Zod.
- Aplica rate limit em memoria por IP/email via `checkLoginRateLimit`.
- Busca usuario `ACTIVE`.
- Compara senha com `bcrypt.compare`.
- Assina JWT com `jose`.
- Define cookie HTTP-only `dash_contabil_session`, `sameSite: "lax"`, `secure` em producao, validade de 7 dias.
- Registra `AuditAction.LOGIN`.

Sessao:

- `lib/auth/token.ts` define assinatura/verificacao.
- `lib/auth/request.ts` le cookie de `NextRequest` ou header `cookie`.
- `proxy.ts` valida cookie para paginas `/`, `/app*` e redireciona para login quando necessario.

Autorizacao:

- Admin pages: `proxy.ts` bloqueia `/app/admin*` se role nao for `ADMIN`.
- Admin APIs: usar `requireAdmin`.
- Empresa: usar `assertCompanyAccess` ou filtro por `UserCompany`.
- Patrimonio: cliente acessa grupos derivados das empresas associadas.

Pontos de atencao:

- Toda nova rota protegida deve validar autorizacao no backend.
- Rate limit atual parece em memoria; pode nao ser suficiente em ambiente serverless/multi-instancia.
- Nao logar token, senha ou dados sensiveis.

---

## 15. Testes

Framework:

- Vitest 3 com ambiente `jsdom`.
- Testing Library e `@testing-library/jest-dom`.
- `vite-tsconfig-paths` para aliases.

Como rodar:

```bash
npm run test
npm run test:watch
npm run lint
npm run build
```

Onde ficam:

- Testes ao lado do codigo: `*.test.ts` e `*.test.tsx`.
- Exemplos:
  - `lib/xlsx/parser.test.ts`
  - `lib/xlsx/mapping-engine.test.ts`
  - `lib/csv/ledger-parser.test.ts`
  - `lib/dashboard/periods.test.ts`
  - `lib/company-access.test.ts`
  - `app/api/auth/login/route.test.ts`
  - `app/api/imports/xlsx/route.test.ts`
  - `app/page.test.tsx`

Padrao:

- Testes unitarios de libs puras.
- Testes de handlers API com mocks de request/Prisma/auth.
- Testes de componentes React para login e pagina principal.

Lacunas:

> Atencao:
> - Nem todas as rotas recentes parecem ter testes, especialmente patrimonio e alguns endpoints administrativos/grupos.
> - Nao foi identificado teste E2E.

Como criar novos testes:

- Criar arquivo `*.test.ts` ou `*.test.tsx` proximo ao modulo.
- Cobrir sucesso, erro, validacao, permissao e regressao.
- Para regras contabeis, preferir testes unitarios em `lib` antes de testar via UI.

---

## 16. Boas Praticas Obrigatorias

### Codigo

- Manter consistencia com o padrao existente.
- Evitar duplicacao.
- Criar funcoes pequenas e testaveis.
- Usar nomes claros.
- Evitar codigo morto.
- Evitar `console.log` desnecessario.
- Validar entradas.
- Tratar erros.
- Nao misturar regra de negocio critica com interface visual.
- Nao criar dependencias sem necessidade.
- Nao refatorar grandes areas sem motivo.

### Arquitetura

- Respeitar a arquitetura existente.
- Preservar separacao de responsabilidades.
- Evitar alto acoplamento.
- Priorizar codigo facil de testar.
- Criar abstracoes apenas quando fizer sentido.
- Nao inventar novo padrao sem necessidade.

### Seguranca

- Nao expor secrets.
- Nao logar dados sensiveis.
- Validar permissoes no backend.
- Proteger rotas sensiveis.
- Garantir isolamento de dados por empresa/grupo.
- Sanitizar e validar entradas do usuario.

### Banco de dados

- Avaliar impacto antes de alterar schema.
- Criar migrations quando necessario.
- Preservar integridade referencial.
- Evitar campos duplicados sem justificativa.
- Documentar toda mudanca relevante.

---

## 17. Checklist Antes de Implementar

- Ler `docs/AI_CONTEXT_SUMMARY.md`.
- Consultar esta base se houver duvida.
- Entender o padrao existente.
- Localizar arquivos relacionados.
- Verificar regras de negocio afetadas.
- Verificar impacto em banco de dados.
- Verificar impacto em autenticacao/autorizacao.
- Verificar impacto em testes.
- Planejar a menor alteracao segura possivel.

---

## 18. Checklist Depois de Implementar

- Criar ou atualizar testes unitarios.
- Rodar testes disponiveis.
- Rodar lint, se existir.
- Verificar build, se aplicavel.
- Validar fluxo principal alterado.
- Remover logs desnecessarios.
- Revisar seguranca e permissoes.
- Atualizar esta base de conhecimento se houver mudanca relevante.
- Atualizar `docs/AI_CONTEXT_SUMMARY.md` se o resumo rapido for impactado.
- Registrar decisao tecnica se necessario.

---

## 19. Testes Unitarios Obrigatorios

Toda nova feature, bugfix ou regra de negocio deve ter teste unitario sempre que possivel.

Os testes devem cobrir:

- Cenario de sucesso.
- Cenarios de erro.
- Validacoes.
- Regras de negocio.
- Permissoes.
- Casos extremos relevantes.
- Regressoes de bugs corrigidos.

Se nao for possivel criar teste por limitacao atual do projeto, documente o motivo e recomende o proximo passo.

Nao ignore falhas de teste.

---

## 20. Atualizacao Continua da Base

Esta base deve ser atualizada sempre que houver:

- Nova feature.
- Correcao relevante.
- Nova regra de negocio.
- Alteracao de regra existente.
- Nova entidade.
- Alteracao de banco de dados.
- Nova API.
- Mudanca de arquitetura.
- Nova dependencia.
- Mudanca de infraestrutura.
- Mudanca em autenticacao ou autorizacao.
- Novo padrao de codigo.
- Decisao tecnica importante.

A base deve evoluir junto com o projeto.

---

## 21. Historico de Decisoes Tecnicas

### Decisao: Centralizar contexto de IA em Markdown

Data:
2026-06-10

Contexto:
O projeto precisava de uma base curta, objetiva e reutilizavel para agentes de IA entenderem dominio, stack, arquitetura, regras e cuidados sem reler todo o repositorio.

Decisao:
Criar `docs/AI_PROJECT_KNOWLEDGE_BASE.md`, `docs/AI_CONTEXT_SUMMARY.md` e `AGENTS.md`.

Motivo:
Reduzir custo de contexto, acelerar futuras tarefas e registrar regras criticas do projeto.

Impacto:
Agentes devem ler primeiro o resumo e consultar a base principal conforme necessidade.

Status:
Ativa

### Decisao: Manter documentacao nova em ASCII

Data:
2026-06-10

Contexto:
Arquivos e saidas existentes mostram caracteres acentuados quebrados em alguns pontos.

Decisao:
Escrever a nova documentacao em portugues sem acentos.

Motivo:
Evitar novos problemas de encoding e manter leitura estavel em ferramentas de terminal.

Impacto:
Texto fica menos natural, mas mais robusto no ambiente atual.

Status:
Ativa

---

## 22. Pontos de Atencao

- Arquivos `.env` reais existem localmente; nunca expor valores.
- README menciona `.env.example`, mas o arquivo nao foi encontrado no inventario.
- `proxy.ts` contem logs verbosos de autenticacao e ambiente.
- Rate limit de login em memoria pode nao escalar em deploy distribuido.
- Importacao XLSX/Razao concentra muitas regras em um handler grande.
- Documentacao tecnica existente parece parcialmente desatualizada frente ao schema atual.
- Rotas recentes de patrimonio/grupos aparecem em mudancas locais nao commitadas e podem precisar de revisao/testes.
- Nem todas as APIs possuem testes.
- Regras de mapeamento contabel impactam diretamente o dashboard e devem ser tratadas como regra de negocio critica.
- Mudancas em `DashboardMonthlySummary.dataJson` podem quebrar graficos, indices e drill-downs se campos mudarem sem compatibilidade.

---

## 23. Pendencias de Confirmacao

> Pendente de confirmacao:
> - Ambiente de deploy de producao e CI/CD.
> - Politica real de retencao de importacoes e backups.
> - Lista oficial de indicadores/dashboard fields esperados pelo negocio.
> - Se `OWNER_EMAIL = "owner@dashcontabil.com"` deve continuar hardcoded no frontend.
> - Se `.env.example` deve ser criado para refletir variaveis reais sem secrets.
> - Padrao esperado de paginacao para listas grandes.
> - Regras comerciais completas para patrimonio.

---

## 24. Resumo Otimizado para IA

`dash-contabil` e uma aplicacao Next.js App Router + TypeScript para importar arquivos contabeis, mapear contas e exibir dashboards financeiros multiempresa. O backend e feito com Route Handlers em `app/api`, Prisma e PostgreSQL. O frontend fica em `app`, com componentes reutilizaveis em `app/components`, Tailwind CSS, Recharts e estados client-side. A logica reutilizavel mais importante fica em `lib`: auth, acesso por empresa, parsers XLSX/CSV/Razao, mapping engine, dashboard periods/cache/freshness e auditoria.

O dominio principal inclui `User`, `Group`, `Company`, `UserCompany`, `ImportBatch`, `LedgerEntry`, `RazaoEntry`, `AccountMapping`, `DashboardMonthlySummary`, `UnmappedAccount`, `AuditLog`, `SystemConfig` e `PatrimonioAsset`. Usuarios tem role `ADMIN` ou `CLIENT`; clientes so acessam empresas vinculadas por `UserCompany`. Grupos agrupam empresas e tambem patrimonio. Importacoes sao por empresa e `referenceMonth` (`YYYY-MM`), com `sourceType` `XLSX`, `RAZAO` ou `XLSX_CONSOLIDATED`.

Auth usa JWT assinado com `jose` em cookie HTTP-only `dash_contabil_session`; senha usa `bcryptjs`. Paginas protegidas passam por `proxy.ts`, mas toda API sensivel tambem deve validar sessao e permissao no backend. Rotas admin devem usar `requireAdmin`. Rotas por empresa devem usar `assertCompanyAccess` ou filtro equivalente por `UserCompany`, empresa ativa e grupo ativo.

Importacao e fluxo critico: `/api/imports/xlsx` aceita `.xlsx`, `.xls` e `.csv`, limita arquivo a 10 MB, detecta razao ou balancete, valida CNPJ/periodo quando possivel, calcula checksum SHA-256, aplica `AccountMapping` e atualiza `DashboardMonthlySummary`. O mapping engine usa `EXACT`, `PREFIX` ou `LIST`, agrega `saldo_atual`, `debito`, `credito` ou `saldo_anterior` por `SUM`/`ABS_SUM` e calcula formulas seguras. Reenvio do mesmo arquivo e idempotente por `companyId + referenceMonth + checksum`; importacoes concluidas do mesmo tipo por empresa/mes causam conflito.

Banco usa Prisma com IDs `cuid`, `Decimal(18,2)` para valores monetarios, JSON para dados flexiveis e migrations em `prisma/migrations`. Alteracoes de schema exigem migration, revisao de dados existentes, testes e atualizacao desta base.

Testes usam Vitest + Testing Library. Rode `npm run test`; tambem existem `npm run lint` e `npm run build`. Testes ficam ao lado dos modulos (`*.test.ts`, `*.test.tsx`). Ao implementar, priorize menor mudanca segura, mantenha padroes existentes, valide entradas com Zod, nao coloque regra critica apenas no frontend, nao exponha secrets, escreva auditoria para acoes sensiveis e atualize esta documentacao quando a mudanca alterar dominio, API, banco, auth, infra ou padroes.
