# Backlog Técnico — DashContábil

## Objetivo

Este backlog foi gerado a partir da auditoria técnica do MVP do DashContábil.

Objetivo: evoluir o sistema para produção segura, escalável e preparada para crescimento.

---

# 🔴 PRIORIDADE ALTA (CRÍTICO)

---

## ISSUE 001 — Corrigir Middleware do Next.js

### Problema
O arquivo `proxy.ts` não é reconhecido como middleware pelo Next.js App Router.

### Impacto
Rotas `/app` podem não estar protegidas no server-side.

### Ação
Renomear o arquivo:

```
proxy.ts → middleware.ts
```

### Critérios de aceite

- Middleware executando corretamente
- Rotas `/app` protegidas no server-side
- Teste com usuário não autenticado redirecionando corretamente

---

## ISSUE 002 — Substituir Rate Limit em Memória

### Problema
Rate limit implementado com `Map` em memória.

### Impacto
Não funciona corretamente em ambiente serverless (Vercel), permitindo bypass.

### Solução recomendada

- Usar Redis (Upstash)
- Ou Vercel KV

### Critérios de aceite

- Rate limit compartilhado entre instâncias
- Bloqueio consistente de requisições excessivas
- Teste de carga validando comportamento

---

## ISSUE 003 — Criar `.env.example`

### Problema
Variáveis obrigatórias não estão documentadas.

### Ação

Criar arquivo `.env.example` com:

```
DATABASE_URL=
JWT_SECRET=
ADMIN_SEED_EMAIL=
ADMIN_SEED_PASSWORD=
NEXT_PUBLIC_SITE_URL=
```

### Critérios de aceite

- Novo desenvolvedor consegue subir o projeto com base no `.env.example`
- README atualizado com instruções

---

## ISSUE 004 — Testes para Importação XLSX

### Problema
Endpoint crítico sem cobertura de testes.

### Ação

Criar testes para:

- upload válido
- arquivo inválido
- duplicidade
- erro de período
- erro de CNPJ
- erro de formato

### Critérios de aceite

- Testes automatizados passando
- Cobertura mínima dos fluxos críticos

---

## ISSUE 005 — Implementar AuditLog

### Problema
Sistema não registra ações críticas.

### Solução

Criar tabela:

```
AuditLog
- id
- userId
- companyId
- action
- entity
- entityId
- metadata (JSON)
- createdAt
```

### Eventos mínimos

- login
- importação
- exclusão de importação
- criação de usuário
- alteração de empresa

### Critérios de aceite

- Logs persistidos no banco
- Registros consultáveis futuramente

---

# 🟠 PRIORIDADE MÉDIA

---

## ISSUE 006 — Criar coluna `saldo_anterior`

### Problema
Valor armazenado dentro de `rawJson`.

### Ação

Adicionar coluna:

```
saldoAnterior DECIMAL(18,2)
```

### Critérios de aceite

- Campo disponível na tabela
- Migração executada
- Uso substituindo rawJson

---

## ISSUE 007 — Paginação Backend (Users e Companies)

### Problema
Listagens retornam todos os registros.

### Ação

Implementar:

- `take`
- `skip`
- `total`

### Critérios de aceite

- APIs paginadas
- Frontend adaptado

---

## ISSUE 008 — Paginação de Importações

### Problema
Paginação feita apenas no frontend.

### Ação

- Implementar paginação real na API

---

## ISSUE 009 — AccountMapping por Empresa

### Problema
Mapeamento global.

### Ação

Adicionar campo:

```
companyId (nullable)
```

### Critérios de aceite

- Permitir override por empresa
- Fallback para mapeamento global

---

## ISSUE 010 — Logs Estruturados

### Problema
Uso de `console.error`.

### Solução

- Integrar logger estruturado (ex: pino)

### Critérios de aceite

- Logs padronizados
- Logs em produção organizados

---

# 🟡 PRIORIDADE BAIXA (EVOLUÇÃO)

---

## ISSUE 011 — Padronizar erros da API

### Ação

Criar padrão:

```
{
  "error": "message",
  "code": "ERROR_CODE"
}
```

---

## ISSUE 012 — Importação Assíncrona

### Evolução

- Implementar fila
- Worker separado

---

## ISSUE 013 — Exportação de Relatórios

### Implementar

- CSV
- XLSX
- PDF (futuro)

---

## ISSUE 014 — Documentar Backup

### Ação

Adicionar no README:

- estratégia de backup
- restore

---

## ISSUE 015 — Testes E2E

### Ferramenta

- Playwright

### Fluxos

- login
- importação
- dashboard

---

## ISSUE 016 — Estrutura de Billing

### Ação

Criar tabelas:

```
Plan
Subscription
```

---

## ISSUE 017 — Health Check

### Ação

Criar endpoint:

```
GET /api/health
```

---

# 📌 Organização sugerida

## Sprint 1 — Infra crítica

- ISSUE 001
- ISSUE 002
- ISSUE 003

## Sprint 2 — Segurança

- ISSUE 004
- ISSUE 005
- ISSUE 007

## Sprint 3 — Escala

- ISSUE 006
- ISSUE 008
- ISSUE 009

## Sprint 4 — Produto

- ISSUE 012
- ISSUE 013
- ISSUE 016

---

# 🚀 Resultado esperado

Após essas melhorias:

- Sistema seguro
- Pronto para produção
- Escalável
- Preparado para clientes reais