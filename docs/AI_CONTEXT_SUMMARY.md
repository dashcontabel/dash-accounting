# AI Context Summary

## Produto

`dash-contabil` e uma aplicacao web para importar arquivos contabeis, aplicar mapeamentos de contas e exibir dashboards financeiros por empresa, grupo e periodo.
O fluxo central envolve balancete/razao em XLSX/XLS/CSV, parsing, validacao, persistencia e visualizacao gerencial.
Admins gerenciam usuarios, empresas, grupos, mapeamentos, imports, auditoria e patrimonio.
Clientes acessam somente empresas/grupos vinculados.
Ha tambem a rota `/app/rentabilidade`, que mostra um demonstrativo multiempresa de rentabilidade liquida, rendimento bruto, IOF/IRRF e saldos bancarios. A tabela agrupa por empresa, detalha rendimento e retencoes pelas contas contabeis mapeadas e encerra cada grupo com o total da empresa; selecoes multiempresa tambem exibem o total consolidado. Os KPIs superiores usam o mesmo estilo de observabilidade da dashboard; qualquer valor negativo assume estado vermelho e a rentabilidade liquida negativa troca a seta ascendente pela descendente.
O resumo do dashboard principal apresenta quatro divisoes em linhas completas: Receitas; Saldos Bancarios por Conta; Despesas; e Investimentos e Resultado. Receitas agrupa Faturamento, NFs Recebidas, Aluguel, Receitas Passivas e Rendimentos Liquidos; Despesas agrupa Impostos, Pro-labores e Demais Despesas. Cada cabecalho termina com seu indicador consolidado, conectado ao titulo por uma linha cromatica de destaque: `RECEITAS_TOTAL`, saldo bancario consolidado, `DESPESAS_TOTAL` e `RESULTADO`, respectivamente. Logo abaixo fica o grafico Faturamento x Despesas x Resultado. Os cards quebram dentro de cada divisao e usam apresentacao inspirada em observabilidade com numeros tabulares, status cromatico e indicador neutro animado quando ha detalhamento; o mesmo indicador e usado nos cards de Centro de Custo. O contexto de referencia/consolidacao tem destaque proprio; na selecao multiempresa, tags identificam cada empresa e permitem remove-la diretamente da consolidacao.

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
- `DEMAIS_DESPESAS` e um agrupador residual: quando usa um prefixo amplo como `3`, o motor e o detalhamento excluem contas ja classificadas em categorias especificas de despesa, evitando dupla contagem em `DESPESAS_TOTAL` e exibicao indevida de impostos no modal.
- Isolamento de dados por empresa/grupo.
- Rentabilidade: `/app/rentabilidade` monta visao de demonstrativo com empresas nas linhas, saldo de 31/12 do ano anterior, rentabilidade liquida mes a mes, totais trimestrais e saldo final do periodo. A composicao por clique usa os campos `RENDIMENTO_BRUTO`, `IOF_IRRF`, `RENTABILIDADE` e `SD_BANCARIO` do `DashboardMonthlySummary`.
- No celular, o demonstrativo de rentabilidade mantem a coluna de contas mais estreita para expor os valores durante o scroll; os cards de patrimonio usam o estilo de observabilidade e distribuem valores em duas colunas mais o total abaixo.
- Rendimentos liquidos no dashboard principal: o card usa destaque teal e seta ascendente quando `RENTABILIDADE` e zero ou positiva; valores negativos usam destaque vermelho e seta descendente para nao sugerir tendencia positiva.
- Saldo bancario no dashboard principal: em filtros nao mensais, a divisao por conta usa o ultimo `SD_BANCARIO` disponivel ate o fim selecionado; janeiro a julho exibe julho e, se agosto ainda nao foi contabilizado, janeiro a agosto continua exibindo julho. A visualizacao mensal permanece vinculada ao resumo do mes selecionado. A composicao vem de `/api/dashboard/bank-balances` e deve reconciliar com o total oficial do resumo mensal. O total consolidado aparece no fim do cabecalho da divisao, ligado ao titulo pela linha azul.
- Liquidez Seca: `(ATIVO_CIRCULANTE - ESTOQUES) / PASSIVO_CIRCULANTE` so e calculada quando `ESTOQUES` e numerico, finito e maior que zero. Estoque ausente, nulo, zero ou negativo deixa o indice sem valor e o card em estado neutro; nunca deve ser substituido por zero, pois isso duplicaria a Liquidez Corrente.
- Freshness do dashboard: monitora somente as empresas atualmente selecionadas, a cada 30 segundos, sem sobrepor requisicoes. O polling fica suspenso enquanto a aba esta oculta e consulta imediatamente ao voltar. A API valida acesso e retorna os metadados em duas operacoes Prisma no nivel da rota.
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
- A tela `/app/imports` detecta a competencia automaticamente no envio individual e em lote; no individual, permite informar o mes manualmente. A resposta do Razao pode incluir varias competencias e a troca de empresa recarrega o historico correspondente.
- Exports XLS BIFF8 com indice de aba incorreto sao recuperados em memoria pelo leitor compartilhado de Balancete/Razao, preservando o arquivo original e seu checksum.
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
