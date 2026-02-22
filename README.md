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
