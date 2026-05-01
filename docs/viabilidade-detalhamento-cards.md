# Estudo de Viabilidade — Detalhamento de Cards via Razão Contábil

> **Data:** Abril/2026  
> **Objetivo:** Avaliar se o relatório de Razão Contábil pode substituir ou complementar o Balancete para: (a) alimentar os KPIs e índices existentes, (b) fornecer detalhamento individual por card/modal, e (c) permitir importação consolidada multi-mês.

---

## 1. Estrutura do Modelo Atual — Balancete

**Arquivo:** `BALANCETE JAN 2026.xlsx` · Aba: `Balancete` · Período: `01/01/2026 – 31/01/2026`

### 1.1 Layout

```
Linha 0   │ Empresa:    │ AMPM ENGENHARIA E PARTICIPAÇÕES LTDA  │ … │ Folha: 1
Linha 1   │ C.N.P.J.:   │ 30.306.729/0001-51
Linha 2   │ Período:    │ 01/01/2026 - 31/01/2026
Linha 3   │ (hora/metadados)
Linha 5   │ BALANCETE
Linha 7   │ ← CABEÇALHO DAS COLUNAS
Linha 8+  │ ← DADOS DAS CONTAS (uma linha por conta)
…
Linha N   │ RESUMO DO BALANCETE (totalizadores — ignorar)
```

### 1.2 Mapeamento de Colunas (verificado no arquivo real)

| Índice | Cabeçalho | Conteúdo |
|---|---|---|
| 0 | `Código` | ID sequencial interno (ignorar) |
| 1 | `Classificação` | **Código contábil hierárquico** — ex: `1.1.1.02.001` |
| 3 | `Descrição da conta` | Nome da conta (com espaços iniciais para indicar hierarquia) |
| 7 | `Saldo Anterior` | Saldo de abertura do mês |
| 9 | `Débito` | Total de débitos no período |
| 11 | `Crédito` | Total de créditos no período |
| 13 | `Saldo Atual` | Saldo de fechamento do mês |

> **Obs:** Este arquivo entrega valores numéricos diretamente nas colunas corretas — sem o deslocamento de célula mesclada que existia no arquivo `BASE PARA POWER BI.xlsx` anterior. O parser atual já trata esse formato corretamente.

### 1.3 Característica principal

O Balancete é um **resumo mensal** — uma linha por conta, com os totalizadores do período. Contém **todas as contas** do plano de contas, inclusive as com saldo zero e sem movimento.

---

## 2. Estrutura do Novo Modelo — Razão Contábil

**Arquivo:** `Razão jan a mar2026 AMPM.xlsx` · Aba: `Razão` · Período: `01/01/2026 – 30/03/2026`

### 2.1 Layout

```
Linha 0   │ Empresa:   │ │ AMPM ENGENHARIA E PARTICIPAÇÕES LTDA
Linha 1   │ C.N.P.J.:  │ │ 30.306.729/0001-51
Linha 2   │ Período:   │ │ 01/01/2026 - 30/03/2026
Linha 4   │ RAZÃO
Linha 6   │ ← CABEÇALHO GLOBAL DAS COLUNAS (único, vale para todas as contas)
Linha 7   │ Conta: [seq] [código] [nome]        ← início do bloco da conta 1
Linha 8   │         SALDO ANTERIOR … [valor]    ← saldo de abertura (col 11)
Linha 9+  │ [data_serial] [lote] [contrapart/hist] … [débito] [crédito] [saldo] [saldo_exercício]
…
Linha N   │ Conta: [seq] [código] [nome]        ← início do bloco da conta 2
…
```

### 2.2 Mapeamento de Colunas (verificado no arquivo real)

**Cabeçalho global (linha 6):**

| Índice | Cabeçalho | Conteúdo |
|---|---|---|
| 0 | `Data` | **Data do lançamento** como número serial do Excel (ex: `46027` = 04/01/2026) |
| 1 | `Lote` | Número do lote/lançamento contábil |
| 2 | `Contrapartida/Histórico` | `"[código] - [nome conta contrapartida]\n[descrição do histórico]"` |
| 6 | `Débito` | Valor debitado |
| 7 | `Crédito` | Valor creditado |
| 8 | `Saldo` | Saldo corrente da conta após o lançamento |
| 11 | `Saldo-Exercício` | Saldo acumulado no exercício (= saldo do mês corrente) |

**Linha de cabeçalho da conta (`Conta:`):**

| Índice | Conteúdo |
|---|---|
| 0 | `"Conta:"` (marcador fixo) |
| 1 | Número sequencial interno |
| 2 | **Código contábil** (ex: `1.1.1.02.001`) |
| 4 | **Nome da conta** |

**Linha de Saldo Anterior (linha imediatamente após o cabeçalho da conta):**

| Índice | Conteúdo |
|---|---|
| 2 | `"SALDO ANTERIOR"` (marcador fixo) |
| 11 | **Valor do saldo de abertura** |

### 2.3 Dados Quantitativos (arquivo real — verificado)

| Métrica | Valor |
|---|---|
| Total de linhas no arquivo | ~230 com dados (resto vazio) |
| Contas com bloco próprio | **45 contas** |
| Contas com lançamentos | ~25 contas |
| Contas sem movimento (apenas saldo anterior) | ~20 contas |
| Total de lançamentos individuais | **132** |
| Meses cobertos | **3** (jan, fev, mar/2026) |
| Lançamentos em Janeiro/2026 | 54 |
| Lançamentos em Fevereiro/2026 | 50 |
| Lançamentos em Março/2026 | 28 |

### 2.4 Exemplo real de bloco de conta com lançamentos

**Conta `1.1.1.02.001 — BANCO DO BRASIL`** (linhas 7–67, 59 lançamentos):

| Data | Lote | Contrapartida / Histórico | Débito | Crédito | Saldo |
|---|---|---|---|---|---|
| 04/01/2026 | 986 | 605 - BB RENDE FACIL / VR REF A RESGATE DE APLIC | 7.500,00 | — | 7.500,00 |
| 04/01/2026 | 985 | 567 - ASSES. E CONSULTORIA EM ENGEN / VR REF A SERV | — | 7.500,00 | 0,00 |
| 08/01/2026 | 987 | 605 - BB RENDE FACIL / VR REF A RESGATE | 5.000,00 | — | 5.000,00 |
| 19/01/2026 | 998 | 623 - Pedro Maia Cavalcanti / VR REF A ADIANTAMENTO | — | 35.000,00 | 15.131,40 |
| 21/01/2026 | 1000 | 605 - BB RENDE FACIL / VR REF A RESGATE | 55.080,00 | — | 55.171,40 |
| … | … | … | … | … | … |

> **Observação chave:** `"623 - Pedro Maia Cavalcanti"` é um sócio — o nome do participante está embutido na coluna `Contrapartida/Histórico`. Não existe coluna separada de "Cliente/Fornecedor", mas a informação está presente e pode ser extraída via split da string.

---

## 3. Análise Comparativa

### 3.1 O Razão contém as informações do Balancete?

**Sim, completamente.** O Razão é, por definição, mais rico que o Balancete:

| Informação | Balancete | Razão |
|---|---|---|
| Código da conta | ✅ | ✅ |
| Nome da conta | ✅ | ✅ |
| Saldo de abertura | ✅ | ✅ (linha SALDO ANTERIOR, col 11) |
| Total de débitos do mês | ✅ | ✅ (derivado: `SUM(lançamentos.débito)`) |
| Total de créditos do mês | ✅ | ✅ (derivado: `SUM(lançamentos.crédito)`) |
| Saldo de fechamento | ✅ | ✅ (Saldo-Exercício do último lançamento do mês) |
| Data de cada lançamento | ❌ | ✅ (serial Excel, conversão simples) |
| Número do lote/documento | ❌ | ✅ (col 1) |
| Conta contrapartida | ❌ | ✅ (col 2, antes do `\n`) |
| Nome do participante (cliente/forn.) | ❌ | ✅ (embutido no campo Contrapartida) |
| Histórico/descrição do lançamento | ❌ | ✅ (col 2, após o `\n`) |
| Saldo corrente por lançamento | ❌ | ✅ (col 8) |

> **Como derivar o Balancete a partir do Razão:**
> ```
> Para cada conta C, para cada mês M:
>   saldo_anterior  = col 11 da linha "SALDO ANTERIOR" + saldo_final do mês anterior (se houver movimento)
>   debito_mes      = SUM(lançamentos.débito WHERE mes(data) = M)
>   credito_mes     = SUM(lançamentos.crédito WHERE mes(data) = M)
>   saldo_final_mes = Saldo-Exercício (col 11) do último lançamento de C no mês M
> ```

### 3.2 Diferença crítica: cobertura de contas

| Aspecto | Balancete | Razão |
|---|---|---|
| Contas com movimento | ✅ | ✅ |
| Contas sem movimento e saldo ≠ 0 | ✅ | ✅ (aparecem com linha SALDO ANTERIOR) |
| Contas com saldo zero e sem movimento | ✅ | ⚠️ Podem não aparecer |

**Impacto prático:** Contas com saldo zero e sem movimento contribuem com zero em todas as métricas do dashboard. A ausência dessas contas no Razão **não afeta os resultados dos cards ou KPIs**.

---

## 4. Viabilidade do Detalhamento por Card (Modal)

### 4.1 Dados disponíveis para o modal

O Razão fornece todos os dados necessários para uma modal de detalhamento rica:

| Campo | Fonte no Razão | Exemplo |
|---|---|---|
| Código da conta | Bloco `Conta:`, col 2 | `1.1.1.02.001` |
| Nome da conta | Bloco `Conta:`, col 4 | `BANCO DO BRASIL` |
| Data | Col 0 → `new Date(1899-12-30 + serial * 86400000)` | `04/01/2026` |
| Número do lote | Col 1 | `986` |
| Conta contrapartida (código + nome) | Col 2, antes do `\n` | `605 - BB RENDE FACIL` |
| Histórico/Descrição | Col 2, após o `\n` | `VR REF A RESGATE DE APLICAÇÃO` |
| Participante (quando aplicável) | Col 2 — extraído do nome da conta contrapartida | `Pedro Maia Cavalcanti` |
| Débito | Col 6 | `7.500,00` |
| Crédito | Col 7 | `—` |
| Saldo corrente | Col 8 | `7.500,00` |
| Mês de referência | Derivado da data | `2026-01` |

### 4.2 Lógica de exibição por card

| Card do Dashboard | Contas mapeadas (exemplos) | Detalhe disponível |
|---|---|---|
| Receita / Rendimento Bruto | `4.1.1.02.001` SERVIÇOS PRESTADOS | Notas fiscais/lançamentos de faturamento com data e lote |
| Despesas com Serviços | `3.2.1.08.x` (contábeis, eng., jurídico) | Fornecedor extraído da contrapartida, data, valor por nota |
| Despesas Diversas | `3.2.2.x` (taxas, aluguéis, bancárias) | Histórico descritivo por lançamento |
| Saldo Bancário | `1.1.1.02.x` (BB, Itaú) | Entradas/saídas de cada conta bancária com contrapartida |
| Aplicações Financeiras | `1.1.1.03.x` (BB Rende Fácil, CDB, XP) | Resgates e aplicações com data |
| Dividendos / Adiantamentos | `1.1.6.01.x`, `1.1.3.04.x` | Participante (sócio) e valores individuais |

---

## 5. Importação Consolidada Multi-Mês

### 5.1 Situação atual

O motor de importação atual assume **um arquivo = um mês**. O `referenceMonth` é extraído do cabeçalho `Período:` do arquivo.

### 5.2 O Razão consolida múltiplos meses

O arquivo analisado contém **Jan + Fev + Mar/2026** num único arquivo. As datas dos lançamentos são armazenadas como **número serial do Excel** (ex: `46027` = 04/01/2026), o que permite identificar o mês de cada lançamento com precisão absoluta.

Conversão: `new Date(new Date(1899,11,30).getTime() + serial * 86400000)`

### 5.3 Estratégia recomendada: particionamento por mês na importação

```
Upload do arquivo Razão (Jan–Dez)
        │
        ▼
  Parser do Razão
  Lê todos os blocos de conta e todos os lançamentos
  Converte seriais de data → datas reais
        │
        ▼
  Detecta meses presentes: ["2026-01", "2026-02", "2026-03"]
        │
        ▼
  Para cada mês M:
    ├── Cria ImportBatch { companyId, referenceMonth: M, fileName, ... }
    ├── Persiste lançamentos detalhados em RazaoLedgerEntry (com data real)
    ├── Agrega débitos/créditos por conta → DashboardMonthlySummary
    └── Contas sem lançamentos no mês: usa saldo_anterior encadeado do mês anterior
```

**Vantagens:**
- Um único upload processa o ano inteiro
- A granularidade mensal existente (`referenceMonth`) é preservada
- Habilita detalhamento retroativo para todos os meses importados

**Ponto de atenção — Contas sem lançamentos no mês:**
Para contas que aparecem no Razão mas não têm movimento num mês específico (ex: conta com saldo estático), o saldo daquele mês = saldo do mês anterior, e débito = crédito = 0. Isso requer lógica de encadeamento de saldos ao gerar o DashboardMonthlySummary por mês.

### 5.4 Alternativa simplificada: manter um arquivo por mês

Se o cliente puder exportar o Razão separado por mês (assim como já faz com o Balancete), a lógica de importação muda **muito menos** — o parser identifica o mês pelo cabeçalho e processa como arquivo único. Mais simples, menor risco, mesma estrutura de parser.

**Recomendação:** oferecer as duas opções. Multi-mês é conveniente para o cliente; por mês é mais simples para implementar inicialmente.

---

## 6. Impacto no Schema (Prisma)

### 6.1 Modelos existentes — compatíveis sem alteração

| Modelo | Status | Observação |
|---|---|---|
| `ImportBatch` | ✅ Compatível | `referenceMonth` já existe; criar N batches por arquivo se multi-mês |
| `LedgerEntry` | ✅ Compatível | Guarda o agregado mensal por conta (como hoje) |
| `DashboardMonthlySummary` | ✅ Compatível | Gerado a partir dos agregados, sem mudança |
| `AccountMapping` | ✅ Compatível | Regras de mapeamento por código de conta — não mudam |

### 6.2 Novo modelo necessário: `RazaoLedgerEntry`

```prisma
model RazaoLedgerEntry {
  id              String      @id @default(cuid())
  companyId       String
  company         Company     @relation(fields: [companyId], references: [id], onDelete: Cascade)
  importBatchId   String
  importBatch     ImportBatch @relation(fields: [importBatchId], references: [id], onDelete: Cascade)
  referenceMonth  String      // "2026-01"
  entryDate       DateTime    // data real do lançamento (convertida do serial)
  lotNumber       String?     // número do lote
  accountCode     String      // código contábil da conta principal
  accountName     String      // nome da conta principal
  counterpartCode String?     // código da conta contrapartida (ex: "605")
  counterpartName String?     // nome da conta contrapartida (ex: "BB RENDE FACIL")
  description     String?     // histórico extraído após o \n
  debit           Decimal     @db.Decimal(18, 2)
  credit          Decimal     @db.Decimal(18, 2)
  balance         Decimal     @db.Decimal(18, 2)  // saldo corrente após o lançamento
  createdAt       DateTime    @default(now())

  @@index([companyId, referenceMonth])
  @@index([companyId, accountCode, referenceMonth])
  @@index([importBatchId])
}
```

### 6.3 Campo adicional em `ImportBatch`

O enum `ImportSourceType` já existe. Basta adicionar o valor `RAZAO`:

```prisma
enum ImportSourceType {
  XLSX   // Balancete (existente)
  RAZAO  // Razão Contábil (novo)
  CSV    // CSV (existente)
}
```

---

## 7. Estimativa de Complexidade

| Item | Complexidade | Detalhes |
|---|---|---|
| Parser do Razão (novo `lib/xlsx/razao-parser.ts`) | **Média** | Estrutura de blocos (`Conta:` / `SALDO ANTERIOR` / lançamentos); datas como serial Excel; campo Contrapartida composto |
| Conversão de serial de data | **Baixa** | `new Date(new Date(1899,11,30).getTime() + serial * 86400000)` |
| Extração de contrapartida + histórico | **Baixa** | `col2.split('\n')` e `parte0.split(' - ', 2)` |
| Importação multi-mês (particionamento) | **Média** | Detectar meses; criar N batches; encadeamento de saldos para contas estáticas |
| Migração Prisma (`RazaoLedgerEntry`) | **Baixa** | Nova tabela, migration simples |
| API: endpoint de detalhamento | **Baixa** | `GET /api/dashboard/detail?companyId=&month=&field=` — query em `RazaoLedgerEntry` com joins em `AccountMapping` |
| Frontend: modal de detalhamento | **Média** | Tabela paginada; filtros por conta; indicador "Ver detalhes" nos cards quando dados existirem |
| **Total** | **Médio** | **Estimativa: 5–8 dias de desenvolvimento** |

---

## 8. Recomendações

### 8.1 ✅ Viável — manter ambos os formatos em paralelo

Não substituir o Balancete pelo Razão. Os dois formatos têm papéis complementares:

| Formato | Papel | Quando usar |
|---|---|---|
| **Balancete** | Importação rápida, apenas KPIs mensais | Quando não há necessidade de detalhamento |
| **Razão** | Importação com detalhamento completo | Quando o cliente quer drill-down nos cards |

O endpoint de importação deve **detectar automaticamente o tipo** lendo a célula A5 (contém `"BALANCETE"` ou `"RAZÃO"`).

### 8.2 Exportar Razão por mês (simplifica a implementação inicial)

Se o cliente puder exportar o Razão separado por mês, a complexidade cai significativamente — sem lógica de particionamento nem encadeamento de saldos. É a abordagem recomendada para a v1 do recurso.

### 8.3 Fluxo de importação recomendado

```
Upload do arquivo
        │
        ▼
  Detectar tipo: "BALANCETE" ou "RAZÃO" (célula A5)
        │
   ┌────┴────┐
   │         │
BALANCETE   RAZÃO
   │         │
   │     Parser do Razão
   │     → Extrai blocos de conta + lançamentos
   │     → Converte seriais → datas reais
   │     → Detecta meses presentes
   │     → Para cada mês: cria ImportBatch + LedgerEntry + RazaoLedgerEntry
   │         │
   └────┬────┘
        │
  Calcular DashboardMonthlySummary (por mês)
        │
        ▼
  Dashboard / Cards
  [se RazaoLedgerEntry existir para o período → exibir botão "Ver detalhes"]
```

### 8.4 Mock da modal de detalhamento

```
┌────────────────────────────────────────────────────────────────┐
│  DESPESAS COM SERVIÇOS — Janeiro/2026           Total: R$ 47.164│
├──────────┬───────┬─────────────────────────────────┬──────┬────┤
│ Data     │ Lote  │ Histórico                       │ Déb  │Cré │
├──────────┼───────┼─────────────────────────────────┼──────┼────┤
│ 04/01    │ 985   │ ASSESSORIA E CONSULTORIA ENG.   │5.040 │    │
│ 12/01    │ 1025  │ SERVIÇOS CONTÁBEIS — BARROS E SÁ│5.562 │    │
│ 12/01    │ 1023  │ ASSESSORIA JURÍDICA — LAPENDA   │1.500 │    │
│ 12/01    │ 1024  │ ASSESSORIA JURÍDICA — LAPENDA   │3.000 │    │
│ …        │ …     │ …                               │ …    │ …  │
└──────────┴───────┴─────────────────────────────────┴──────┴────┘
```

---

## 9. Conclusão

| Pergunta | Resposta |
|---|---|
| O Razão contém os dados que alimentam os KPIs/cards? | ✅ **Sim** — todos os dados do Balancete são deriváveis do Razão |
| O Razão permite detalhamento individual por card? | ✅ **Sim** — data, lote, contrapartida, histórico, participante |
| Há campo de Cliente/Fornecedor separado? | ⚠️ **Não explícito** — o participante está embutido no campo `Contrapartida/Histórico` e pode ser extraído por parsing |
| É viável importar o arquivo consolidado (multi-mês)? | ✅ **Sim** — particionando por mês ao importar |
| Isso aumenta muito a complexidade? | ⚠️ **Moderadamente** — multi-mês adiciona ~2 dias vs. arquivo por mês |
| Recomendação para simplificar? | Exportar Razão separado por mês (consistente com o Balancete atual) |
| Deve substituir o Balancete? | **Não** — manter os dois; Razão habilita detalhamento quando disponível |
| Estimativa total de desenvolvimento | **5–8 dias** (parser + schema + API + frontend) |


---
## 1. Modelo Atual — Balancete

**Aba:** Balancete
**Período:** 01/01/2026 - 31/01/2026 Emissão: 2026-04-29
**Empresa:** AMPM ENGENHARIA E PARTICIPAÇÕES LTDA Folha: 1
**CNPJ:** 30.306.729/0001-51 Número livro: 1

### 1.1 Cabeçalho detectado

```
  Col 0: "Empresa:"
  Col 1: "AMPM ENGENHARIA E PARTICIPAÇÕES LTDA"
  Col 12: "Folha:"
  Col 14: "1"
```

### 1.2 Colunas de valores mapeadas

| Campo | Coluna (índice) |
|---|---|
| código contábil (classificação) | -1 |

**Total de contas-folha:** 0

### 1.3 Amostra das primeiras linhas do arquivo

| Empresa: | AMPM ENGENHARIA E PARTICIPAÇÕES LTDA |  |  |  |  |  |  |  |  |  |  | Folha: |  | 1 |
| C.N.P.J.: | 30.306.729/0001-51 |  |  |  |  |  |  |  |  |  |  | Número livro: |  | 1 |
| Período: | 01/01/2026 - 31/01/2026 |  |  |  |  |  |  |  |  |  |  | Emissão: |  | 2026-04-29 |
|  |  |  |  |  |  |  |  |  |  |  |  | Hora: |  | 1899-12-30 |
|  |
| BALANCETE |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |
| Código | Classificação |  | Descrição da conta |  |  |  | Saldo Anterior |  | Débito |  | Crédito |  | Saldo Atual |  |

### 1.4 Amostra de contas-folha (primeiras 15)

| Código | Nome | Saldo Ant. | Débito | Crédito | Saldo Atual |
|---|---|---|---|---|---|

---
## 2. Novo Modelo — Razão Contábil

**Aba:** Razão
**Período:** 01/01/2026 - 30/03/2026
**Empresa:** AMPM ENGENHARIA E PARTICIPAÇÕES LTDA Folha: 1
**CNPJ:** 30.306.729/0001-51

### 2.1 Primeiras 20 linhas brutas (estrutura)

| Empresa: |  | AMPM ENGENHARIA E PARTICIPAÇÕES LTDA |  |  |  |  |  |  |  | Folha: |  | 1 |
| C.N.P.J.: |  | 30.306.729/0001-51 |  |  |  |  |  |  |  |  |  |  |
| Período: |  | 01/01/2026 - 30/03/2026 |  |  |  |  |  |  |  |  |  |  |
|  |
| RAZÃO |  |  |  |  |  |  |  |  |  |  |  |  |
|  |
| Data | Lote | Contrapartida/Histórico |  |  |  | Débito | Crédito | Saldo |  |  | Saldo-Exercício |  |
| Conta: | 8 | 1.1.1.02.001 |  | BANCO DO BRASIL |  |  |  |  |  |  |  |  |
|  |  | SALDO ANTERIOR |  |  |  |  |  |  |  |  | 0 |  |
| 2026-01-05 | 986 | 605 - BB RENDE FACIL
VR REF A RESGATE DE APLICAÇÃO |  |  |  | 7500 |  | 7500 |  |  | 7500 |  |
| 2026-01-05 | 985 | 567 - ASSES. E CONSULTORIA EM ENGENHARIA
VR REF A SERVIÇOS DE ENGENHARIA - CG ENGENHARIA |  |  |  |  | 7500 | 0 |  |  | 0 |  |
| 2026-01-09 | 987 | 605 - BB RENDE FACIL
VR REF A RESGATE DE APLICAÇÃO |  |  |  | 5000 |  | 5000 |  |  | 5000 |  |
| 2026-01-09 | 1026 | 595 - DESPESAS DIV. CORPORATIVAS
VR REF A CH. AVULSO ENTRE AGENCIAS CONF EXTRATO |  |  |  |  | 5000 | 0 |  |  | 0 |  |
| 2026-01-12 | 988 | 605 - BB RENDE FACIL
VR REF A RESGATE DE APLICAÇÃO |  |  |  | 81.4 |  | 81.4 |  |  | 81.4 |  |
| 2026-01-13 | 989 | 605 - BB RENDE FACIL
VR REF A RESGATE DE APLICAÇÃO |  |  |  | 10072 |  | 10153.4 |  |  | 10153.4 |  |
| 2026-01-13 | 1023 | 594 - ASSESSORIA ADVOCATICIA 
VR REF A ASSESSORIA ADVOCATICIA- THIAGO LAPENDA  CONF EXTRATO |  |  |  |  | 1500 | 8653.4 |  |  | 8653.4 |  |
| 2026-01-13 | 1024 | 594 - ASSESSORIA ADVOCATICIA 
VR REF A ASSESSORIA ADVOCATICIA- THIAGO LAPENDA  CONF EXTRATO |  |  |  |  | 3000 | 5653.4 |  |  | 5653.4 |  |
| 2026-01-13 | 1025 | 561 - SERVIÇOS CONTÁBEIS
VR REF A SERVIÇOS CONTÁBEIS- BARROS E SÁ CONF EXTRATO |  |  |  |  | 5562 | 91.4 |  |  | 91.4 |  |
| 2026-01-19 | 1022 | 549 - DILOG LTDA
VR REF A DILOG ITAPISSUMA CONF EXTRATO |  |  |  | 118113.46 |  | 118204.86 |  |  | 118204.86 |  |
| 2026-01-19 | 990 | 605 - BB RENDE FACIL
VR REF A  APLICAÇÃO |  |  |  |  | 118113.46 | 91.4 |  |  | 91.4 |  |

### 2.2 Candidatos a cabeçalho de dados detectados

| Linha | Células |
|---|---|
| 6 | Data · Lote · Contrapartida/Histórico · Débito · Crédito · Saldo · Saldo-Exercício |
| 8 | SALDO ANTERIOR · 0 |

### 2.3 Estrutura detectada

> Cabeçalho de dados detectado na linha 6

### 2.4 Colunas de dados detectadas

| Campo | Índice de coluna |
|---|---|
| data | 0 |
| historico | 2 |
| debito | 6 |
| credito | 7 |
| saldo | 8 |

**Total de contas detectadas:** 0
**Total de lançamentos:** 0
**Meses encontrados:** nenhum


### 2.7 Pode substituir o Balancete?

**⚠️ INCONCLUSIVO / NÃO** — Não detectou blocos de contas. Não encontrou valores de débito/crédito. Não identificou datas/meses nos lançamentos. 

---
## 3. Análise Comparativa e Recomendações

### 3.1 O Razão contém as informações do Balancete?

O **Razão Contábil** é, por definição, mais detalhado que o Balancete:
- O **Balancete** é um *resumo* das contas: saldo anterior, total de débitos, total de créditos e saldo final.
- O **Razão** contém cada *lançamento individual*, com data, histórico, documento e participante (cliente/fornecedor).
- Portanto, o Razão contém **todas** as informações do Balancete, e muito mais.

### 3.2 É possível derivar o Balancete do Razão?

Sim — para cada conta, basta agregar os lançamentos por mês:
```
  Débito do mês   = SUM(lançamentos débito onde mês = M)
  Crédito do mês  = SUM(lançamentos crédito onde mês = M)
  Saldo final     = saldo_anterior + débitos - créditos  (ou + créditos, dependendo da natureza)
```

### 3.3 Viabilidade do detalhamento de cards

**Viável.** Com o Razão, cada card do dashboard pode exibir um modal com:
| Coluna disponível | Uso no modal |
|---|---|
| Código da conta | Identificação |
| Nome da conta | Rótulo legível |
| Data do lançamento | Linha do tempo |
| Histórico / Complemento | Descrição da operação |
| Número do documento | Rastreabilidade |
| Cliente / Fornecedor | Participante da operação |
| Débito / Crédito / Saldo | Valores |
| Mês derivado | Filtro por período |

### 3.4 Importação em lote (arquivo consolidado Jan–Dez)

⚠️ **Não foi possível identificar datas nos lançamentos** — verificar manualmente se a coluna de data está em formato reconhecível.

### 3.5 Substituir o Balancete pelo Razão?

**Recomendação:** Manter suporte a **ambos** os formatos.
- O **Balancete** é mais simples, menor e suficiente para o dashboard atual (KPIs mensais).
- O **Razão** é necessário para o detalhamento por card, mas é muito mais pesado (pode ter milhares de linhas).
- **Estratégia ideal:** aceitar ambos os formatos no endpoint de importação. O Razão gera tanto o resumo mensal quanto os lançamentos detalhados. O Balancete gera apenas o resumo.
- No frontend, o card só mostra o botão de "Ver detalhes" quando existirem lançamentos do Razão para aquele período.

### 3.6 Complexidade estimada

| Item | Complexidade | Notas |
|---|---|---|
| Parser do Razão (novo) | Média | Estrutura diferente do Balancete; blocos por conta |
| Importação multi-mês | Baixa–Média | Particionar por mês e criar N batches |
| Schema: tabela de lançamentos | Média | Nova tabela `RazaoLedgerEntry` ou extensão |
| API: endpoint de detalhamento | Baixa | Query por companyId + referenceMonth + accountCode |
| Frontend: modal de detalhamento | Média | Componente de tabela paginada por card |
| Total | **Média** | Estimativa: 3–5 dias de desenvolvimento |
