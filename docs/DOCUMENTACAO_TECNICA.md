# Documentação Técnica — dash-contabil

> Versão: 2.0 — Março/2026

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Stack Tecnológica](#2-stack-tecnológica)
3. [Infraestrutura e Configuração](#3-infraestrutura-e-configuração)
4. [Modelo de Dados (Prisma / PostgreSQL)](#4-modelo-de-dados)
5. [Autenticação e Autorização](#5-autenticação-e-autorização)
6. [API REST — Referência Completa](#6-api-rest)
7. [Pipeline de Importação](#7-pipeline-de-importação)
8. [Motor de Mapeamento Contábil](#8-motor-de-mapeamento-contábil)
9. [Parser XLSX — Arquitetura Atual](#9-parser-xlsx)
10. [Parser CSV — Arquitetura Atual](#10-parser-csv)
11. [Dashboard — Lógica de Períodos e Multi-Empresa](#11-dashboard)
12. [Frontend — Páginas e Componentes](#12-frontend)
13. [Testes](#13-testes)
14. [Limitações Conhecidas e Débitos Técnicos](#14-limitações-conhecidas)

---

## 1. Visão Geral

O **dash-contabil** é uma aplicação web multi-tenant para importação, análise e visualização de dados contábeis. O fluxo central é:

```
Arquivo Contábil (XLSX ou CSV)
        │
        ▼
  Endpoint de Upload
        │
        ▼
  Parser (XLSX / CSV)
  Extrai linhas de conta com: código, descrição, débito, crédito, saldo anterior, saldo atual
        │
        ▼
  Motor de Mapeamento (AccountMapping rules)
  Agrupa contas em KPIs: FATURAMENTO, IMPOSTOS, SD_BANCARIO, RENTABILIDADE, etc.
        │
        ▼
  DashboardMonthlySummary
  Salvo em banco por empresa + mês de referência
        │
        ▼
  Dashboard / Relatórios
```

### Dashboard Multi-Empresa e Filtros de Período

A partir da v2.0, o endpoint `GET /api/dashboard/summary` aceita **múltiplos `companyId`** e retorna os resumos mensais de todas as empresas solicitadas. O frontend consolida esses dados em:

- **Seleção de empresas** com modal de busca (`MultiCompanySelect`)
- **Filtros de granularidade** (Mensal / Bimestral / Trimestral / Semestral / Anual) via `PeriodFilter`
- **Gráfico comparativo** (BarChart) com receitas de cada empresa por período
- **Mapa de calor** (HeatmapChart) com Resultado por empresa × mês

```
DashboardMonthlySummary[]   (banco, por empresa + mês)
        │
        ▼
GET /api/dashboard/summary?companyId=a&companyId=b
        │  { companies: [{ companyId, companyName, summaries[] }] }
        ▼
lib/dashboard/periods.ts
  ├── aggregateSummaries()   → agrupa meses em períodos (bimestral/trimestral/etc.)
  └── mergeCompanySummaries() → consolida N empresas em 1 série temporal
        │
        ▼
app/page.tsx
  ├── KPIs individuais (período selecionado)
  ├── Gráfico de linhas (evolução mensal/periódica)
  ├── Gráfico comparativo multi-empresa
  └── Mapa de calor (empresa × mês, sempre granularidade mensal)
```

---

## 2. Stack Tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework Web | Next.js (App Router) | 16.1.4 |
| Runtime | React / React DOM | 19.x |
| Banco de Dados | PostgreSQL | 16 |
| ORM | Prisma | 6.3.x |
| Autenticação | JWT (jose) + bcryptjs | HS256, 7 dias |
| Parsing XLSX | xlsx (SheetJS) | 0.18.x |
| Parsing CSV | csv-parse | 6.x |
| Validação | Zod | 4.x |
| Estilo | Tailwind CSS | v4 |
| Gráficos | Recharts | 2.x |
| Testes | Vitest + Testing Library | — |
| Linguagem | TypeScript (strict) | ES2017 target |

---

## 3. Infraestrutura e Configuração

### Docker Compose

```yaml
# Banco PostgreSQL local
postgres:
  image: postgres:16-alpine
  container_name: dash-contabil-postgres
  POSTGRES_DB: dash_contabil
  POSTGRES_USER: postgres
  POSTGRES_PASSWORD: postgres
  ports: 5432:5432
```

### Variáveis de Ambiente Necessárias

| Variável | Descrição | Obrigatória? |
|---|---|---|
| `DATABASE_URL` | Connection string PostgreSQL (`postgresql://user:pass@host/db`) | Sim |
| `JWT_SECRET` | Chave HMAC para assinar tokens | Sim |
| `ADMIN_SEED_EMAIL` | Email do admin inicial (seed) | Apenas no seed |
| `ADMIN_SEED_PASSWORD` | Senha do admin inicial (seed) | Apenas no seed |

### Scripts NPM

| Script | Comando | Uso |
|---|---|---|
| `dev` | `next dev` | Desenvolvimento local |
| `build` | `next build` | Build de produção |
| `test` | `vitest run` | Executar testes |
| `seed` | `prisma db seed` | Popular banco inicial |
| `prisma:migrate` | `prisma migrate dev` | Aplicar migrações |
| `prisma:studio` | `prisma studio` | GUI do banco |

---

## 4. Modelo de Dados

### Diagrama de Entidades (ERD resumido)

```
Group ──< Company >── UserCompany ──< User
                │
                ├──< ImportBatch >── LedgerEntry
                │                └── UnmappedAccount
                └──< DashboardMonthlySummary

AccountMapping (global, sem FK)
```

### Enumerações

| Enum | Valores |
|---|---|
| `Role` | `ADMIN`, `CLIENT` |
| `UserStatus` | `ACTIVE`, `INACTIVE` |
| `ImportBatchStatus` | `PENDING`, `PROCESSING`, `DONE`, `FAILED` |
| `ImportSourceType` | `XLSX` |
| `MappingMatchType` | `EXACT`, `PREFIX`, `LIST` |
| `MappingValueColumn` | `saldo_atual`, `debito`, `credito`, `saldo_anterior` |
| `MappingAggregation` | `SUM`, `ABS_SUM` |

### Tabelas Principais

#### `User`
```
id            String  @id (cuid)
name          String?
email         String  @unique
passwordHash  String
role          Role    @default(CLIENT)
status        UserStatus @default(ACTIVE)
createdAt     DateTime
updatedAt     DateTime
```

#### `Group`
```
id        String  @id (cuid)
name      String  @unique
isActive  Boolean @default(true)
```

#### `Company`
```
id        String  @id (cuid)
groupId   String  → Group (Restrict delete)
name      String
document  String? @unique  ← CNPJ / CPF
isActive  Boolean @default(true)
```

#### `ImportBatch`
```
id               String
companyId        String  → Company
referenceMonth   DateTime  ← início do mês (YYYY-MM-01)
sourceType       ImportSourceType
status           ImportBatchStatus
checksum         String  ← SHA-256 do arquivo
fileName         String?
totalsJson       Json?   ← { rows, totalDebit, totalCredit, ... }
totalRows        Int
processedRows    Int
lastError        String?
createdByUserId  String?

UNIQUE: (companyId, referenceMonth, checksum)  ← chave de idempotência
```

#### `LedgerEntry`
```
id             String
importBatchId  String  → ImportBatch
companyId      String  → Company
referenceMonth DateTime
accountCode    String
accountName    String
debit          Decimal(18,2)
credit         Decimal(18,2)
balance        Decimal(18,2)
rawJson        Json?
```

#### `AccountMapping`
```
id             String
dashboardField String  ← ex: "FATURAMENTO", "IMPOSTOS"
matchType      MappingMatchType
codes          Json    ← array de strings
valueColumn    MappingValueColumn
aggregation    MappingAggregation
isCalculated   Boolean
formula        String?  ← ex: "FATURAMENTO - IMPOSTOS - DEMAIS_DESPESAS"
```

#### `DashboardMonthlySummary`
```
id             String
companyId      String  → Company
referenceMonth DateTime
dataJson       Json    ← { FATURAMENTO: 114987.92, IMPOSTOS: 9299.72, ... }

UNIQUE: (companyId, referenceMonth)
```

#### `UnmappedAccount`
```
id             String
importBatchId  String  → ImportBatch
accountCode    String
description    String?
```

---

## 5. Autenticação e Autorização

### Fluxo de Login

```
1. POST /api/auth/login
   ├── Valida schema (Zod): { email, password }
   ├── Rate limiter em memória: 5 tentativas / 15min por "IP:email"
   ├── Busca User ativo no banco
   ├── bcrypt.compare(password, passwordHash)
   ├── Limpa rate limit
   └── Assina JWT (HS256, 7 dias) → seta cookie httpOnly "dash_contabil_session"

2. Middleware intercepta TODAS as rotas:
   ├── /  e /app/**   → exige sessão válida → redireciona p/ /login
   ├── /login         → se autenticado, redireciona p/ /
   └── /app/admin/**  → exige role = ADMIN → redireciona p/ /

3. Cada route handler valida novamente via getUserFromRequest()
   ├── Lê cookie "dash_contabil_session"
   ├── verifyToken() via jose
   └── Retorna { sub, email, role } ou null
```

### Estrutura do JWT

```json
// Header
{ "alg": "HS256" }

// Payload
{
  "sub": "<userId>",
  "email": "user@example.com",
  "role": "ADMIN" | "CLIENT"
}
```

### Controle de Acesso por Empresa

```
ADMIN → acessa TODAS as empresas ativas
CLIENT → acessa apenas empresas vinculadas (UserCompany) e ativas
```

Função `assertCompanyAccess(user, companyId)` lança erro `COMPANY_ACCESS_DENIED` se a empresa não estiver na lista permitida para o usuário.

---

## 6. API REST

### Autenticação

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| POST | `/api/auth/login` | Login | Não |
| POST | `/api/auth/logout` | Logout | Não |
| GET | `/api/auth/me` | Sessão atual + empresas | Sim |

**POST /api/auth/login**
```json
// Request
{ "email": "admin@example.com", "password": "senha123" }

// Response 200
{ "user": { "id", "email", "name", "role", "status" } }

// Response 429 (rate limit)
{ "error": "Too many login attempts", "retryAfterSeconds": 840 }
```

**GET /api/auth/me**
```json
{
  "user": { "id", "email", "name", "role", "status" },
  "allowedCompanies": [{ "id", "name", "document", "groupId" }],
  "activeCompanyId": "empresa-id-ou-null"
}
```

---

### Contexto de Empresa Ativa

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/context/active-company` | Define empresa ativa (cookie 30 dias) |

---

### Dashboard

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/dashboard/summary` | Resumos mensais de uma ou mais empresas |

**GET /api/dashboard/summary**

Aceita um ou múltiplos parâmetros `companyId`:

```
GET /api/dashboard/summary?companyId=id1
GET /api/dashboard/summary?companyId=id1&companyId=id2
```

```json
// Response 200
{
  "companies": [
    {
      "companyId": "uuid",
      "companyName": "Empresa ABC",
      "summaries": [
        {
          "referenceMonth": "2025-01-01T00:00:00.000Z",
          "dataJson": {
            "FATURAMENTO": 114987.92,
            "IMPOSTOS": 9299.72,
            "RESULTADO": 42310.00,
            "SD_BANCARIO": 88000.00
          }
        }
      ]
    }
  ]
}
```

Valida acesso individual a cada empresa antes de retornar. Retorna `403` se o usuário não tiver acesso a qualquer uma das empresas solicitadas.

---

### Importações

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/imports?companyId=<id>` | Lista lotes de importação |
| POST | `/api/imports` | Upload CSV (multipart, max 5 MB) |
| POST | `/api/imports/xlsx` | Upload XLSX (multipart, max 10 MB) |
| GET | `/api/imports/:id` | Detalhe de um lote |

**POST /api/imports/xlsx** (form-data)
```
file: <arquivo.xlsx>
companyId: "empresa-uuid"
referenceMonth: "2024-01"   ← formato YYYY-MM
```
```json
// Response 201 (novo lote)
{
  "idempotent": false,
  "batchId": "...",
  "status": "DONE",
  "summary": { "FATURAMENTO": 114987.92, "IMPOSTOS": 9299.72, ... }
}

// Response 200 (arquivo idêntico já importado)
{ "idempotent": true, "batchId": "...", "status": "DONE" }
```

**GET /api/imports/:id**
```json
{
  "batch": { "id", "status", "totalRows", "processedRows", "fileName", ... },
  "summary": { "dataJson": { "FATURAMENTO": ..., "RENTABILIDADE": ... } },
  "unmappedAccounts": [{ "accountCode": "3.2.1.08.005", "description": "SERVIÇOS CONTÁBEIS" }]
}
```

---

### Administração (role = ADMIN)

| Método | Rota | Descrição |
|---|---|---|
| GET/POST | `/api/admin/groups` | Listar / Criar grupos |
| GET/PATCH/DELETE | `/api/admin/groups/:id` | Detalhe / Editar / Excluir grupo |
| GET/POST | `/api/admin/companies` | Listar / Criar empresas |
| GET/PATCH/DELETE | `/api/admin/companies/:id` | Detalhe / Editar / Excluir empresa |
| GET/POST | `/api/admin/users` | Listar / Criar usuários |
| GET/PATCH/DELETE | `/api/admin/users/:id` | Detalhe / Editar / Excluir usuário |
| POST | `/api/admin/mappings/seed` | Resetar mapeamentos para os padrões |

---

## 7. Pipeline de Importação

### Fluxo XLSX (principal)

```
1. Recebe multipart: file, companyId, referenceMonth
2. Valida: size <= 10 MB, extensão .xlsx
3. Calcula SHA-256 do buffer → chave de idempotência
4. Verifica se já existe ImportBatch com mesmo (companyId, referenceMonth, checksum)
   └── Se sim: retorna lote existente (HTTP 200)
5. Cria ImportBatch status=PENDING
6. parseXlsxBuffer(buffer)
   └── SheetJS lê buffer → raw rows → parseXlsxRows()
       ├── Detecta linha de cabeçalho (primeiras 40 linhas)
       ├── Mapeia colunas: Classificação, Descrição, Saldo Anterior, Débito, Crédito, Saldo Atual
       └── Retorna ParsedAccountRow[]
7. Busca todos AccountMapping do banco
8. applyAccountMappings(parsedRows, mappings)
   └── Retorna { summary, mappedAccountCodes, unmappedAccounts }
9. Transação Prisma:
   ├── Upsert DashboardMonthlySummary (companyId + referenceMonth)
   ├── Deleta + recria UnmappedAccount para este batch
   └── Atualiza ImportBatch status=DONE, totalsJson
10. Retorna { idempotent: false, batchId, status, summary }
```

### Fluxo CSV

```
1. Recebe multipart: file, companyId, referenceMonth
2. Valida: size <= 5 MB
3. Calcula SHA-256 → idempotência
4. parseLedgerCsvBuffer(buffer)
   ├── Detecta delimitador (; | \t | ,)
   ├── Normaliza cabeçalho (remove acentos, lowercase)
   ├── Mapeia colunas: código, nome, débito, crédito, saldo
   └── Retorna { entries: NormalizedLedgerRow[], totals }
5. Insere LedgerEntry[] em chunks de 500 (transação)
6. Atualiza ImportBatch status=DONE
```

---

## 8. Motor de Mapeamento Contábil

O `applyAccountMappings` em `lib/xlsx/mapping-engine.ts` transforma a lista de contas num dicionário de KPIs do dashboard.

### Tipos de Regra

| matchType | Descrição |
|---|---|
| `EXACT` | `accountCode === code` (exact equality) |
| `PREFIX` | `accountCode.startsWith(code + ".")` ou `=== code` |
| `LIST` | Igual a EXACT para múltiplos codes |

### Tipos de Agregação

| aggregation | Fórmula |
|---|---|
| `SUM` | Soma os valores (positivo e negativo) |
| `ABS_SUM` | Soma os valores absolutos |

### Regras Padrão (seed)

| Campo | Tipo | Códigos | Coluna de valor |
|---|---|---|---|
| `FATURAMENTO` | PREFIX | `["3.1"]` | credito |
| `IMPOSTOS` | PREFIX | `["3.2.01"]` | debito → ABS_SUM |
| `SD_BANCARIO` | LIST | `["1.1.01.01","1.1.01.02"]` | saldo_atual |
| `ALUGUEL` | PREFIX | `["3.2.02.01"]` | debito → ABS_SUM |
| `CONDOMINIO` | PREFIX | `["3.2.02.02"]` | debito → ABS_SUM |
| `DISTRIB_LUCROS` | PREFIX | `["3.2.03"]` | debito → ABS_SUM |
| `DEMAIS_DESPESAS` | Calculado | — | fórmula: `"0"` |
| `RENTABILIDADE` | Calculado | — | fórmula: `"FATURAMENTO - IMPOSTOS - DEMAIS_DESPESAS"` |

### Avaliador de Fórmulas

O `evaluateFormula(formula, context)` em `lib/xlsx/formula.ts` usa o algoritmo Shunting Yard (RPN) para avaliar expressões aritméticas sem `eval`. Suporta `+`, `-`, `*`, `/`, parênteses e variáveis do contexto.

---

## 9. Parser XLSX

### Localização: `lib/xlsx/`

```
workbook.ts    → lê buffer com SheetJS, chama parseXlsxRows
parser.ts      → detecta cabeçalho, mapeia colunas, extrai dados
formula.ts     → avaliador de expressões aritméticas
mapping-engine.ts → aplica regras de mapeamento
index.ts       → re-exports públicos
```

### Algoritmo de Detecção de Cabeçalho

O parser varre as primeiras 40 linhas procurando uma linha que contenha:
1. **Pelo menos uma** célula correspondendo aos aliases de `accountCode` (`classificacao`, `codigo`, etc.)
2. **Pelo menos uma** célula correspondendo aos aliases de qualquer coluna de valor (`saldo anterior`, `debito`, `credito`, `saldo atual`)

### Aliases Reconhecidos

| Campo lógico | Aliases (normalizados) |
|---|---|
| accountCode | `classificacao`, `classificação`, `codigo`, `código`, `codigo conta`, `código conta` |
| description | `descricao`, `descrição`, `conta`, `nome`, `descricao conta` |
| saldo_anterior | `saldo anterior`, `saldooriginal`, `saldo inicial` |
| debito | `debito`, `débito`, `debitos`, `débitos` |
| credito | `credito`, `crédito`, `creditos`, `créditos` |
| saldo_atual | `saldo atual`, `saldo final` |

### Nota: Sheet lida

O `workbook.ts` lê **sempre o índice 0** (`SheetNames[0]`). Para arquivos com múltiplas abas, a aba correta deve ser a primeira, ou o parser precisa ser estendido para aceitar um parâmetro `sheetName`.

---

## 10. Parser CSV

### Localização: `lib/csv/`

```
ledger-parser.ts  → parser principal
index.ts          → re-exports
```

### Funcionalidades

- **Detecção automática de delimitador**: varre a primeira linha buscando `;`, `\t` ou `,`
- **Normalização de números BR**: aceita `1.234,56` (ponto-milhar, vírgula-decimal), `R$ 1.234,56`, e o padrão com parênteses negativos `(1.234,56)`
- **Tolerância a maiúsculas/acentos** no cabeçalho

---

## 11. Dashboard — Lógica de Períodos e Multi-Empresa

### Localização: `lib/dashboard/periods.ts`

Módulo puro (sem dependências de banco) responsável por agregar os resumos mensais em janelas temporais e consolidar dados de múltiplas empresas.

### Tipos Exportados

```typescript
type PeriodGranularity = "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual";

type MonthlySummary = {
  referenceMonth: string; // "YYYY-MM"
  dataJson: Record<string, number>;
};

type AggregatedPeriod = {
  label: string;        // ex: "Jan/25", "Jan–Fev/25", "2025"
  months: string[];     // meses incluídos: ["2025-01", "2025-02"]
  dataJson: Record<string, number>;
};
```

### `aggregateSummaries(summaries, granularity, year)`

Filtra os resumos pelo ano selecionado, ordena cronologicamente e agrupa em chunks conforme a granularidade:

| Granularidade | Chunk (meses) | Rótulo exemplo |
|---|---|---|
| `monthly` | 1 | `Jan/25` |
| `bimonthly` | 2 | `Jan–Fev/25` |
| `quarterly` | 3 | `Jan–Mar/25` |
| `semiannual` | 6 | `Jan–Jun/25` |
| `annual` | 12 | `2025` |

**Regras de agregação:**
- Campos normais: **soma** ao longo dos meses do chunk
- `SD_BANCARIO`: **média** (saldo bancário não se acumula)
- `RESULTADO`, `RENTABILIDADE`, `ALUGUEL_LIQUIDO`: **recalculados** a partir das somas dos campos base (evita dupla contagem)

### `mergeCompanySummaries(allSummaries)`

Consolida os `MonthlySummary[]` de N empresas numa única série temporal. Útil para exibir totais agregados nos gráficos principais quando múltiplas empresas são selecionadas.

---

## 12. Frontend — Páginas e Componentes

### Estrutura de Rotas

```
/                     → Dashboard (dados reais de DashboardMonthlySummary)
/login                → Tela de autenticação
/app/imports          → Upload e listagem de importações
/app/docs/import-mapping → Documentação interna de mapeamento
/app/admin/companies  → CRUD de empresas (ADMIN)
/app/admin/users      → CRUD de usuários (ADMIN)
/app/admin/mappings   → CRUD de regras de mapeamento (ADMIN)
```

### Componentes Reutilizáveis

| Componente | Localização | Descrição |
|---|---|---|
| `AppShell` | `components/app-shell.tsx` | Layout sidebar responsivo (desktop fixo / mobile drawer) |
| `CompanyLogo` | `components/company-logo.tsx` | Logo com tamanho compacto ou normal |
| `LoginForm` | `login/login-form.tsx` | Formulário de autenticação, redireciona via `?next=` |
| `MultiCompanySelect` | `components/multi-company-select.tsx` | Seletor de empresas com modal |
| `PeriodFilter` | `components/period-filter.tsx` | Filtro de granularidade + ano + mês |
| `HeatmapChart` | `components/heatmap-chart.tsx` | Mapa de calor Resultado por empresa × mês |

### `MultiCompanySelect`

Componente de seleção de múltiplas empresas com padrão de trigger + modal:

- **Trigger**: botão compacto com indicador colorido (◉ zinc = nenhuma, ◉ emerald = todas, ◉ azul = parcial) e rótulo dinâmico
- **Modal (`CompanyModal`)**: overlay com backdrop, campo de busca (visível quando > 6 empresas), checkbox "Todas as empresas" com estado indeterminado, lista com scroll e rodapé com contagem + botões Cancelar / Confirmar
- **Estado draft**: alterações no modal só se propagam ao confirmar — clique fora ou Escape cancela sem efeito
- **Responsividade**: `max-width: min(24rem, calc(100vw - 2rem))` garante que não estoure em telas estreitas; nomes longos quebram linha com `wrap-break-word`

### `PeriodFilter`

Controles de período agrupados em um único componente:

- Cinco botões de granularidade (Mensal / Bimestral / Trimestral / Semestral / Anual)
- `<select>` de ano (flex-1, nunca estoura o container)
- `<select>` de mês (exibido apenas quando granularidade = Mensal)

### `HeatmapChart`

Visualização de Resultado por empresa × mês com escala de cores divergente (verde = superávit, vermelho = déficit, intensidade proporcional à magnitude).

- **Desktop** (`sm:block`): tabela com primeira coluna sticky (`sticky left-0`) para que os nomes das empresas permaneçam visíveis durante scroll horizontal; gradiente de scroll-hint visível em mobile
- **Mobile** (`sm:hidden`): layout de cards empilhados — um card por empresa, com as células de mês dispostas em grade flexível com quebra de linha
- O heatmap usa **sempre granularidade mensal** (colunas = Jan–Dez), independentemente do filtro de período selecionado nos gráficos acima

### Dashboard — Estado e Fluxo de Dados (`app/page.tsx`)

```
mount
  └── GET /api/auth/me
      → allowedCompanies, activeCompanyId → selectedCompanyIds (state)

selectedCompanyIds change
  └── GET /api/dashboard/summary?companyId=...
      → companiesData: CompanyData[]

companiesData change
  ├── mergedSummaries = mergeCompanySummaries(companiesData)
  ├── aggregatedPeriods = aggregateSummaries(merged, granularity, year)
  ├── activeSummary = dados do período/mês selecionado → KPIs, gráficos
  ├── comparativeSeries = receitas de cada empresa por período (multi-empresa)
  └── heatmapData = resultado mensal por empresa (sempre monthly)
```

**Visibilidade dos blocos:**
- KPIs + gráfico principal: sempre visíveis com qualquer seleção
- Gráfico comparativo (BarChart multi-empresa): visível quando `companiesData.length > 1`
- Mapa de calor: visível quando `companiesData.length > 0` **e** `granularity ≠ "monthly"`, **ou** `companiesData.length > 1`

---

## 13. Testes

Testes usando **Vitest** + `@testing-library/react` (JSDOM). Total: **37 testes, 0 falhas**.

| Arquivo | Cobertura |
|---|---|
| `app/page.test.tsx` | Renderização do dashboard (multi-empresa, filtros) |
| `app/login/login-form.test.tsx` | Fluxo de login no cliente |
| `app/api/auth/login/route.test.ts` | Endpoint de login (rate limit, credenciais) |
| `app/api/auth/me/route.test.ts` | Endpoint /me (sessão, empresas) |
| `app/api/admin/users/route.test.ts` | CRUD de usuários (admin guard) |
| `app/api/imports/route.test.ts` | Upload CSV (idempotência, parse) |
| `app/api/imports/xlsx/route.test.ts` | Upload XLSX (mapeamento, summary, idempotência) |
| `app/api/admin/mappings/seed/route.test.ts` | Seed de mapeamentos |
| `app/api/context/active-company/route.test.ts` | Definição de empresa ativa |
| `lib/auth/admin-guard.test.ts` | Guard de admin |
| `lib/company-access.test.ts` | Controle de acesso por empresa |
| `lib/csv/ledger-parser.test.ts` | Parser CSV (formatos BR, delimitadores) |
| `lib/xlsx/mapping-engine.test.ts` | Motor de mapeamento |
| `lib/xlsx/parser.test.ts` | Parser XLSX |
| `lib/xlsx/workbook.test.ts` | Leitura de workbook |
| `lib/dashboard/periods.test.ts` | Agregação de períodos e merge multi-empresa |

Configuração em `vitest.config.ts` + `vitest.setup.ts`.

---

## 14. Limitações Conhecidas

### L1 — ImportBatch para CSV não gera DashboardMonthlySummary
O endpoint `POST /api/imports` (CSV) salva `LedgerEntry` no banco mas **não executa o motor de mapeamento** nem gera `DashboardMonthlySummary`. Apenas o fluxo XLSX produz o resumo do dashboard utilizado nos gráficos.

### L2 — Parser XLSX lê apenas a primeira aba
O `workbook.ts` acessa `SheetNames[0]`. Se o XLSX enviado tiver múltiplas abas (como o arquivo "BASE PARA POWER BI.xlsx"), apenas a primeira aba é processada.

### L3 — Parser XLSX não lida com `Descrição da conta` nas sub-colunas
No formato de balancete exportado por sistemas contábeis, a descrição é "indentada" — colocada em colunas diferentes conforme o nível hierárquico. O parser atual usa um único índice de coluna para a descrição, perdendo nomes de contas em níveis mais profundos.

### L4 — Offset de colunas com células mescladas
Em arquivos Excel com células mescladas no cabeçalho (como "Saldo Anterior" mesclado em P:T), o índice detectado no cabeçalho pode divergir do índice onde os dados realmente aparecem nas linhas de dado. Isso causará leituras de `saldo_anterior` como zero.

### L5 — Sem suporte a hierarquia / contas-pai vs. contas-folha
O parser importa todas as linhas com código válido, incluindo contas agrupamento (pai). Se o arquivo tiver tanto a conta "4.1.1" (total) quanto a "4.1.1.02" e "4.1.1.02.001" (folhas), o motor de mapeamento com regra PREFIX vai acumular os valores múltiplas vezes (dupla contagem).

### L6 — AccountMapping é global (sem escopo por empresa)
As regras de mapeamento se aplicam a todas as empresas. Empresas com plano de contas diferente precisariam de um conjunto separado de `AccountMapping` (não suportado hoje).

### L7 — Rate limiter em memória (sem persistência)
O limitador de tentativas de login é baseado em `Map` em memória. Em ambientes multi-processo ou após restart, os contadores são perdidos.

### L8 — `mergeCompanySummaries` — SD_BANCARIO multi-empresa
Ao consolidar N empresas, o `SD_BANCARIO` é somado (somas dos saldos bancários de todas as empresas). Em casos onde se deseja o saldo total do grupo, isso é correto; mas se a intenção for a média do grupo, seria necessário uma lógica adicional.
