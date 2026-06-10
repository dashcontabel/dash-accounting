# Dash Contabil

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4
- Prisma ORM
- PostgreSQL (Docker)

## Base de Conhecimento para IA

Este projeto possui uma base de conhecimento em Markdown para orientar agentes de IA e desenvolvedores em novas tarefas.

Arquivos principais:

- `docs/AI_CONTEXT_SUMMARY.md`: resumo rapido para tarefas pequenas.
- `docs/AI_PROJECT_KNOWLEDGE_BASE.md`: base tecnica completa do projeto.
- `AGENTS.md`: instrucoes permanentes para agentes de desenvolvimento.

Como usar:

1. Antes de pedir uma alteracao, leia ou anexe `docs/AI_CONTEXT_SUMMARY.md`.
2. Para tarefas maiores, peca ao agente para consultar `docs/AI_PROJECT_KNOWLEDGE_BASE.md`.
3. Para qualquer implementacao, peca que o agente siga `AGENTS.md`.
4. Se a tarefa alterar dominio, banco, API, autenticacao, autorizacao, infraestrutura, testes ou arquitetura, atualize a base de conhecimento.
5. Nunca inclua valores reais de `.env`, secrets, tokens, senhas ou dados sensiveis nos prompts.

### Template de prompt para nova feature

```md
Quero implementar uma nova feature neste projeto.

Antes de alterar codigo:
- Leia `docs/AI_CONTEXT_SUMMARY.md`.
- Consulte `docs/AI_PROJECT_KNOWLEDGE_BASE.md` se precisar de contexto tecnico.
- Siga as regras de `AGENTS.md`.

Feature:
[descreva a feature]

Objetivo de negocio:
[explique o problema que a feature resolve]

Escopo esperado:
- [item 1]
- [item 2]
- [item 3]

Regras de negocio:
- [regra 1]
- [regra 2]

Requisitos tecnicos:
- Manter padroes existentes.
- Validar permissao no backend quando houver rota protegida.
- Validar entradas com Zod quando aplicavel.
- Criar ou atualizar testes.
- Rodar testes/lint/build conforme impacto.
- Atualizar a base de conhecimento se houver mudanca relevante.

Entregue a implementacao completa, com resumo do que foi alterado e dos testes executados.
```

### Template de prompt para code review

```md
Faca um code review das mudancas atuais.

Antes de revisar:
- Leia `docs/AI_CONTEXT_SUMMARY.md`.
- Consulte `docs/AI_PROJECT_KNOWLEDGE_BASE.md` para regras criticas.
- Use `AGENTS.md` como referencia de padroes obrigatorios.

Foque em:
- Bugs e regressoes.
- Quebras de regra de negocio.
- Problemas de autenticacao/autorizacao.
- Vazamento de dados sensiveis.
- Riscos em banco de dados e migrations.
- Falta de testes.
- Inconsistencias com os padroes do projeto.

Formato esperado:
- Liste achados por severidade.
- Cite arquivos e linhas quando possivel.
- Inclua perguntas em aberto.
- Informe se nao encontrou problemas relevantes.
```

### Template de prompt para correcao de bug ou fix

```md
Preciso corrigir um bug neste projeto.

Antes de alterar codigo:
- Leia `docs/AI_CONTEXT_SUMMARY.md`.
- Consulte `docs/AI_PROJECT_KNOWLEDGE_BASE.md` se o bug envolver dominio, API, banco, auth ou importacao.
- Siga `AGENTS.md`.

Bug:
[descreva o comportamento incorreto]

Comportamento esperado:
[descreva o comportamento correto]

Passos para reproduzir:
1. [passo 1]
2. [passo 2]
3. [passo 3]

Arquivos/fluxos suspeitos:
- [opcional]

Requisitos:
- Identificar a causa raiz.
- Implementar a menor correcao segura.
- Criar ou atualizar teste de regressao quando possivel.
- Rodar testes relevantes.
- Atualizar a base de conhecimento se o bug revelar regra ou decisao importante.

Entregue a correcao com resumo, causa raiz e testes executados.
```

### Template de prompt para criacao de documentacao

```md
Quero criar ou atualizar documentacao neste projeto.

Antes de escrever:
- Leia `docs/AI_CONTEXT_SUMMARY.md`.
- Consulte `docs/AI_PROJECT_KNOWLEDGE_BASE.md`.
- Siga `AGENTS.md`.

Tema da documentacao:
[descreva o assunto]

Publico alvo:
[desenvolvedores, agentes de IA, usuarios internos, admins, clientes etc.]

Arquivos que devem ser criados ou atualizados:
- [arquivo 1]
- [arquivo 2]

Requisitos:
- Usar apenas arquivos Markdown quando for documentacao do projeto.
- Nao inventar informacoes.
- Registrar pendencias quando algo nao estiver claro.
- Nao expor secrets ou dados sensiveis.
- Manter texto objetivo e facil de atualizar.

Entregue os arquivos atualizados e um resumo curto das mudancas.
```

### Template de prompt para criacao de testes

```md
Quero criar ou melhorar testes neste projeto.

Antes de alterar codigo:
- Leia `docs/AI_CONTEXT_SUMMARY.md`.
- Consulte `docs/AI_PROJECT_KNOWLEDGE_BASE.md` para padroes de teste e regras criticas.
- Siga `AGENTS.md`.

Area a testar:
[descreva modulo, rota, componente ou regra de negocio]

Cenarios obrigatorios:
- Sucesso: [descreva]
- Erro: [descreva]
- Validacao: [descreva]
- Permissao/autorizacao: [descreva, se aplicavel]
- Regressao: [descreva, se aplicavel]

Requisitos:
- Criar testes proximos ao codigo como `*.test.ts` ou `*.test.tsx`.
- Usar Vitest e Testing Library quando aplicavel.
- Mockar Prisma/auth/fetch apenas quando necessario.
- Rodar testes relevantes.
- Nao alterar comportamento funcional fora do necessario para testar.

Entregue os testes criados, ajustes minimos necessarios e comandos executados.
```

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
