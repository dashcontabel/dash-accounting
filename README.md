# Dash Contabil

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4
- Prisma ORM
- PostgreSQL (Docker)

## Milestone 0 (Database Bootstrap)

### 1. Environment variables

Copy `.env.example` to `.env` and adjust values if needed:

```bash
cp .env.example .env
```

### 2. Start PostgreSQL with Docker

```bash
docker compose up -d
```

The database will be available at `localhost:5432` with:

- database: `dash_contabil`
- user: `postgres`
- password: `postgres`

### 3. Install dependencies

```bash
npm install
```

### 4. Run Prisma migration

```bash
npm run prisma:migrate
```

### 5. Seed initial admin

Set `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` in `.env`, then run:

```bash
npm run seed
```

The seed is idempotent:
- creates one ADMIN user if email does not exist
- skips creation if the email already exists

### 6. Optional: inspect DB

```bash
npm run prisma:studio
```

### 7. Run project checks

```bash
npm run lint
npm run build
```

## Milestone IMPORT_XLSX_MAPPED_SUMMARY

### 1. Seed de mapeamentos (ADMIN)

Com um ADMIN autenticado, execute:

`POST /api/admin/mappings/seed`

Isso cria regras iniciais de `AccountMapping` (EXACT/PREFIX/LIST), incluindo campos calculados.

### 2. Importar balancete XLSX

- Tela: `/app/imports`
- Endpoint: `POST /api/imports/xlsx`
- Form-data:
  - `file` (`.xlsx`)
  - `companyId`
  - `referenceMonth` (`YYYY-MM`)

O processamento:
- detecta colunas dinamicamente por header (Classificacao/Codigo + valores)
- normaliza moeda pt-BR
- aplica regras de mapeamento
- calcula campos derivados por formula segura
- persiste em `DashboardMonthlySummary`
- registra status/log em `ImportBatch` e contas nao mapeadas em `UnmappedAccount`
