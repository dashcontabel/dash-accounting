# Proposta — Leitor Robusto de Balancete

> Análise do arquivo `BASE PARA POWER BI.xlsx` → aba **Balancete**  
> Versão: 1.0 — Março/2026

---

## 1. Estrutura Real do Arquivo Balancete

A análise do arquivo de exemplo revelou uma estrutura muito específica que o parser atual **não consegue ler corretamente**. Os problemas são descritos a seguir.

### 1.1 Layout Geral da Aba

```
Linha 0  │ Empresa: │ ... │ AMPM ENGENHARIA E PARTICIPAÇÕES LTDA │ ...
Linha 1  │ C.N.P.J.: │ ... │ 30.306.729/0001-51 │ ...
Linha 2  │ Período: │ ... │ 01/01/2024 - 31/01/2024 │ ...
Linha 3  │ (hora/metadados)
Linha 4  │ (vazia)
Linha 5  │ BALANCETE
Linha 6  │ (vazia)
Linha 7  │ ← CABEÇALHO DAS COLUNAS ←
Linha 8+ │ ← DADOS DAS CONTAS ←
...
Linha N  │ RESUMO DO BALANCETE  ← início do bloco de totais (deve ser IGNORADO)
Linha N+ │ linhas de totais (ATIVO, PASSIVO, RESULTADO etc.)
Linha M  │ Sistema licenciado para... ← rodapé
```

---

### 1.2 Mapeamento Exato das Colunas (base 0)

| Índice | Letra Excel | Cabeçalho (linha 7) | Onde aparecem os dados |
|---|---|---|---|
| 0 | A | `Código` | Número sequencial interno (**NÃO é o código contábil**) |
| 3 | D | `Classificação` | **Código contábil** (ex: `1.1.1.02.001`) — usar este |
| 7–14 | H–O | `Descrição da conta` | Texto aparece na coluna 7 + nível hierárquico |
| 15 | P | `Saldo Anterior` *(header)* | — |
| **19** | **T** | *(sub-coluna do merge)* | **Valor real do Saldo Anterior** |
| 22 | W | `Débito` | Valor do Débito |
| 26 | AA | `Crédito` | Valor do Crédito |
| 32 | AG | `Saldo Atual` | Valor do Saldo Atual |

> ⚠️ **Problema crítico — Offset do Saldo Anterior:**  
> O cabeçalho `"Saldo Anterior"` está na coluna **P (índice 15)**, mas o valor numérico nas linhas de dado está na coluna **T (índice 19)**. Isso ocorre porque o cabeçalho é uma célula mesclada (P:T no Excel), e o dado é inserido na subcélula T, não na P. O parser atual leria a coluna 15 como `saldo_anterior` e obteria **sempre zero**.

---

### 1.3 Descrição como Indentação de Coluna

O arquivo codifica a hierarquia expandindo o texto para a direita:

```
Col:  H       I         J           K             L               M
      (7)     (8)       (9)         (10)          (11)            (12)
  
R8:   ATIVO
R9:           ATIVO CIRCULANTE
R10:                    DISPONÍVEL
R11:                               BANCOS CONTA MOVIMENTO
R12:                                             BANCO DO BRASIL
R13:                                             ITAU
```

Profundidade do código → deslocamento da coluna de descrição:

| Nível (pontos no código) | Coluna da descrição |
|---|---|
| 1 (ex: `1`) | col 7 |
| 2 (ex: `1.1`) | col 8 |
| 3 (ex: `1.1.1`) | col 9 |
| 4 (ex: `1.1.1.02`) | col 10 |
| 5 (ex: `1.1.1.02.001`) | col 11 |
| N | col 6 + N |

> O parser atual usa **um único índice fixo** para a descrição (o da coluna do cabeçalho `"Descrição da conta"`, que é 7). Contas de nível 2+ terão `description = ""`.

---

### 1.4 Dados Fora de Ordem — Código Sequencial vs. Código Contábil

O campo `Código` (col 0) é um **ID interno do sistema contábil** — **não** o código hierárquico. Ele NÃO é contínuo nem representa ordem:

```
R11: seq=7   código="1.1.1.02"       ← grupo de 4 níveis
R12: seq=8   código="1.1.1.02.001"   ← conta folha (banco)
R13: seq=518 código="1.1.1.02.003"   ← conta folha (criada depois, ID alto)
R14: seq=10  código="1.1.1.03"       ← irmão do grupo anterior
R15: seq=605 código="1.1.1.03.002"   ← sub-conta (criada muito depois)
```

Para importação e mapeamento, somente o campo `Classificação` (col 3) importa. O campo `Código` (col 0) deve ser completamente ignorado.

---

### 1.5 Contas-Pai vs. Contas-Folha

O arquivo inclui tanto contas **agrupamento** (que somam os filhos) quanto contas **folha** (com movimento real). Exemplos:

```
"1"               → ATIVO            → saldo_atual = 2.302.898,78  (total geral)
"1.1"             → ATIVO CIRCULANTE → saldo_atual = 2.302.898,78  (subtotal)
"1.1.1"           → DISPONÍVEL       → saldo_atual = 2.136.604,36  (subtotal)
"1.1.1.02"        → BANCOS CONTA MOV.→ saldo_atual =    10.260,62  (subtotal)
"1.1.1.02.001"    → BANCO DO BRASIL  → saldo_atual =         0,00  ← FOLHA
"1.1.1.02.003"    → ITAU             → saldo_atual =    10.260,62  ← FOLHA
```

Se todas as linhas forem importadas, uma regra `PREFIX: ["1.1.1.02"]` somaria:
- `1.1.1.02` (= 10.260,62)
- `1.1.1.02.001` (= 0)
- `1.1.1.02.003` (= 10.260,62)

**Resultado errado: 20.521,24** em vez de 10.260,62.

---

## 2. Problemas do Parser Atual e suas Causas

| # | Problema | Causa raiz | Impacto |
|---|---|---|---|
| P1 | Lê apenas `SheetNames[0]` | `workbook.ts` linha `workbook.SheetNames[0]` | Para arquivos multi-aba, lê a aba errada |
| P2 | `saldo_anterior` é sempre zero | Offset de 4 colunas entre header (col 15) e dado (col 19) | Campo financeiro incorreto |
| P3 | `description` vazia para níveis 2+ | Parser usa coluna fixa 7; descrições estão em 8, 9, 10... | Contas sem nome |
| P4 | Dupla contagem no mapeamento | Contas pai e filhas são importadas juntas | KPIs inflados |
| P5 | Linhas de resumo podem causar ruído | "RESUMO DO BALANCETE" e totais aparecem após as contas | Entradas inválidas (mitigado pelo ACCOUNT_CODE_REGEX) |

> **Nota:** O problema P5 é parcialmente mitigado, pois as linhas de resumo têm texto na col 1 (não em col 3), então `parseAccountCode(row[3])` retorna null e a linha é pulada. Porém, linhas de total com código numérico poderiam passar — é seguro confirmar com validação explícita do "marcador de fim".

---

## 3. Proposta de Novo Parser de Balancete

### 3.1 Estratégia de Seleção de Aba

Adicionar parâmetro opcional `sheetName` ao `parseXlsxBuffer`. Tentativa em cascata:

```typescript
function selectSheet(workbook, sheetName?: string): Worksheet {
  // 1. Nome exato fornecido pelo usuário
  if (sheetName && workbook.Sheets[sheetName]) {
    return workbook.Sheets[sheetName];
  }
  // 2. Busca por nome normalizado (case-insensitive, sem acentos)
  const candidates = ["balancete", "balancete de verificacao", "trial balance"];
  for (const candidate of candidates) {
    const match = workbook.SheetNames.find(
      n => normalize(n) === candidate
    );
    if (match) return workbook.Sheets[match];
  }
  // 3. Fallback: primeira aba
  return workbook.Sheets[workbook.SheetNames[0]];
}
```

---

### 3.2 Detecção de Offset de Colunas de Valor

Após encontrar o índice do cabeçalho para cada coluna de valor, confirmar o índice real verificando as primeiras linhas de dado:

```
Para cada coluna de valor (ex: saldo_anterior com header_col=15):
  Varrer as primeiras 10 linhas de dado com código contábil válido.
  Para cada linha, verificar colunas [header_col, header_col+1, ..., next_header_col-1].
  O índice com o maior count de valores não-zero é o índice real.
```

Pseudocódigo:

```typescript
function resolveValueColumnWithOffset(
  dataRows: unknown[][],
  headerIndex: number,
  nextHeaderIndex: number,
  accountCodeColIndex: number
): number {
  const counts = new Array(nextHeaderIndex - headerIndex).fill(0);
  let sampleCount = 0;

  for (const row of dataRows) {
    if (!isValidAccountCode(row[accountCodeColIndex])) continue;
    for (let offset = 0; offset < counts.length; offset++) {
      const val = toNumber(row[headerIndex + offset]);
      if (val !== 0) counts[offset]++;
    }
    if (++sampleCount >= 10) break;
  }

  const maxIdx = counts.indexOf(Math.max(...counts));
  return headerIndex + maxIdx;
}
```

---

### 3.3 Descrição Multi-Coluna

Em vez de usar um único índice de coluna, coletar a descrição varrendo o range [descHeaderCol, valueHeaderCol - 1]:

```typescript
function extractDescription(row: unknown[], fromCol: number, toCol: number): string {
  for (let col = fromCol; col < toCol; col++) {
    const cell = String(row[col] ?? "").trim();
    if (cell) return cell;
  }
  return "";
}
```

O `fromCol` é a coluna de cabeçalho "Descrição da conta" (7 no arquivo de exemplo), e `toCol` é a coluna do primeiro cabeçalho de valor (15 no exemplo).

---

### 3.4 Estratégia Folha-Only (Sem Dupla Contagem)

**Passo 1** — Coletar todos os códigos contábeis presentes no arquivo:

```typescript
const allCodes = new Set(parsedRows.map(r => r.accountCode));
```

**Passo 2** — Para cada linha, determinar se é folha:

```typescript
function isLeaf(code: string, allCodes: Set<string>): boolean {
  // É folha se nenhum outro código começa com "code."
  // Exemplos:
  //   "1.1.1.02.001" → nenhum código começa com "1.1.1.02.001." → FOLHA ✓
  //   "1.1.1.02"     → "1.1.1.02.001" começa com "1.1.1.02."   → NÃO É FOLHA ✗
  return !Array.from(allCodes).some(
    other => other !== code && other.startsWith(code + ".")
  );
}
```

**Passo 3** — Filtrar apenas folhas (ou oferecer ambas as opções via flag):

```typescript
const leafRows = parsedRows.filter(r => isLeaf(r.accountCode, allCodes));
```

> **Otimização:** para grandes planos de contas, em vez de varrer o Set a cada código, construir uma trie ou simplesmente ordenar os códigos e verificar o próximo elemento.

---

### 3.5 Detecção do Bloco de Resumo (Fim dos Dados)

Parar de ler linhas quando encontrar a célula "RESUMO DO BALANCETE":

```typescript
const SUMMARY_MARKER = "resumo do balancete";

for (const row of dataRows) {
  // Detecta o marcador de fim
  if (row.some(cell => normalize(cell) === SUMMARY_MARKER)) break;

  const accountCode = parseAccountCode(row[accountCodeCol]);
  if (!accountCode) continue;
  // ... processa linha
}
```

---

### 3.6 Leitura do Período de Referência a partir dos Metadados

O arquivo contém o período na linha 2:

```
Linha 2, col 5: "01/01/2024 - 31/01/2024"
```

É possível extrair o `referenceMonth` automaticamente do arquivo ao invés de exigir que o usuário informe:

```typescript
function extractReferenceMonth(rows: unknown[][]): string | null {
  // Procura nas primeiras 10 linhas por um padrão "DD/MM/YYYY - DD/MM/YYYY"
  const PERIOD_REGEX = /(\d{2})\/(\d{2})\/(\d{4})/;
  for (const row of rows.slice(0, 10)) {
    for (const cell of row) {
      const match = PERIOD_REGEX.exec(String(cell ?? ""));
      if (match) {
        // Retorna "YYYY-MM" do início do período
        return `${match[3]}-${match[2]}`;
      }
    }
  }
  return null;
}
```

---

### 3.7 Leitura do CNPJ / Identificador da Empresa

O arquivo contém o CNPJ na linha 1:

```
Linha 1, col 5: "30.306.729/0001-51"
```

Pode ser usado para **vincular automaticamente o arquivo à empresa** no banco, sem que o usuário precise selecionar:

```typescript
function extractCnpj(rows: unknown[][]): string | null {
  const CNPJ_REGEX = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/;
  for (const row of rows.slice(0, 5)) {
    for (const cell of row) {
      const match = CNPJ_REGEX.exec(String(cell ?? ""));
      if (match) return match[0].replace(/\D/g, ""); // apenas dígitos
    }
  }
  return null;
}
```

---

## 4. Fluxo Completo Proposto

```
┌─────────────────────────────────────────────────────────────────────┐
│                    UPLOAD DO ARQUIVO BALANCETE                       │
│              (XLSX multi-aba ou exportação direta)                   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                    ┌───────────▼────────────┐
                    │ 1. Leitura do buffer    │
                    │    SheetJS raw=true     │
                    │    (preserva números)   │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │ 2. Seleção da aba       │
                    │    Busca "Balancete"    │
                    │    → fallback aba[0]    │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │ 3. Extração metadados   │
                    │    CNPJ → empresa       │
                    │    Período → mês ref    │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │ 4. Detecção do cabeçalho│
                    │    Scan 40 linhas:      │
                    │    Classificação +      │
                    │    ≥1 coluna de valor   │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │ 5. Resolução de colunas │
                    │ a) accountCode → col 3  │
                    │ b) description → range  │
                    │    [col7, col15)        │
                    │ c) Débito → col 22 ✓    │
                    │ d) Crédito → col 26 ✓   │
                    │ e) Saldo Atual → col 32 ✓│
                    │ f) Saldo Ant. → offset  │
                    │    detectado → col 19 ✓ │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │ 6. Iteração das linhas  │
                    │    Parar em             │
                    │    "RESUMO DO BALANCETE"│
                    │    Pular linhas sem     │
                    │    código contábil      │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │ 7. Filtro folha-only    │
                    │    Construir Set de     │
                    │    todos os códigos     │
                    │    Manter apenas folhas │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │ 8. Motor de Mapeamento  │
                    │    applyAccountMappings │
                    │    → summary (KPIs)     │
                    │    → unmappedAccounts   │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │ 9. Persistência         │
                    │    ImportBatch DONE     │
                    │    DashboardMonthlySumm │
                    │    UnmappedAccounts     │
                    └─────────────────────────┘
```

---

## 5. Mudanças Necessárias no Código

### 5.1 `lib/xlsx/workbook.ts` — Seleção de aba e raw mode

```typescript
// ANTES
export function parseXlsxBuffer(buffer: Buffer) {
  const workbook = read(buffer, { type: "buffer", cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,          // ← converte números para string formatada
    blankrows: false,
    defval: "",
  }) as unknown[][];
  return parseXlsxRows(rows);
}

// DEPOIS
export function parseXlsxBuffer(buffer: Buffer, sheetName?: string) {
  const workbook = read(buffer, { type: "buffer", cellDates: false });
  const targetSheet = resolveSheetName(workbook, sheetName);
  const worksheet = workbook.Sheets[targetSheet];
  const rows = utils.sheet_to_json(worksheet, {
    header: 1,
    raw: true,           // ← preserva números como Number, mais confiável
    blankrows: false,
    defval: "",
  }) as unknown[][];
  return parseXlsxRows(rows);
}

function resolveSheetName(workbook: WorkBook, hint?: string): string {
  if (hint && workbook.Sheets[hint]) return hint;
  const normalized = workbook.SheetNames.map(n => ({
    original: n,
    normalized: n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
  }));
  const candidates = ["balancete", "balancete de verificacao", "trial balance"];
  for (const c of candidates) {
    const found = normalized.find(n => n.normalized === c);
    if (found) return found.original;
  }
  return workbook.SheetNames[0]!;
}
```

### 5.2 `lib/xlsx/parser.ts` — Colunas multi-span e offset detection

As principais adições ao `resolveColumnMap`:

```typescript
// Após encontrar accountCode e description header cols:

// Detectar o range da descrição:
//   fromCol = índice do header "Descrição da conta"
//   toCol   = índice do primeiro header de valor

// Para cada coluna de valor, usar resolveValueColumnWithOffset()
// passando as primeiras dataRows e o range [headerCol, nextHeaderCol)

// Na extração de cada linha:
const description = extractDescription(row, descFromCol, descToCol);
```

### 5.3 `lib/xlsx/parser.ts` — Filtro folha-only (pós-parse)

```typescript
export function parseXlsxRows(rows: unknown[][]): ParsedXlsxResult {
  // ... lógica atual ...

  // Novo: filtrar para contas folha
  const allCodes = new Set(parsedRows.map(r => r.accountCode));
  const leafRows = parsedRows.filter(r => isLeafAccount(r.accountCode, allCodes));

  return {
    rows: leafRows,
    detectedColumns,
    // novo: expor metadados extraídos
    metadata: {
      cnpj: extractCnpj(rows),
      referenceMonth: extractReferenceMonth(rows),
    }
  };
}
```

### 5.4 `app/api/imports/xlsx/route.ts` — Auto-preenchimento de empresa/mês

```typescript
// Após parseXlsxBuffer:
const { rows, metadata } = parseXlsxBuffer(buffer);

// Se o usuário não informou referenceMonth, usar o detectado no arquivo
const effectiveMonth = referenceMonth ?? metadata.referenceMonth ?? null;
if (!effectiveMonth) {
  return NextResponse.json({ error: "referenceMonth nao informado e nao detectado no arquivo" }, { status: 400 });
}

// Opcional: verificar se o CNPJ do arquivo bate com o da empresa informada
if (metadata.cnpj) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const fileCnpj = metadata.cnpj;
  const companyCnpj = company?.document?.replace(/\D/g, "");
  if (companyCnpj && fileCnpj !== companyCnpj) {
    return NextResponse.json(
      { error: "O CNPJ do arquivo nao corresponde a empresa selecionada" },
      { status: 422 }
    );
  }
}
```

---

## 6. Tratamento do CSV Fora de Ordem

Para o formato CSV, o parser atual (`ledger-parser.ts`) já é robusto para dados fora de ordem, porque:

1. Processa uma linha por vez sem depender da ordem
2. O motor de mapeamento acumula por código (não por posição)

O único ajuste recomendado para o CSV é **ordenar as linhas pelo código contábil antes de devolver**, para garantir que `LedgerEntry` fique consistente no banco:

```typescript
// No final de parseLedgerCsvBuffer:
entries.sort((a, b) => compareAccountCodes(a.accountCode, b.accountCode));

function compareAccountCodes(a: string, b: string): number {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
```

---

## 7. Resumo das Melhorias por Prioridade

| Prioridade | Melhoria | Arquivo(s) afetado(s) | Impacto |
|---|---|---|---|
| 🔴 Alta | Seleção da aba "Balancete" | `workbook.ts` | Sem isso, arquivo multi-aba não funciona |
| 🔴 Alta | Offset do Saldo Anterior (col 15 → 19) | `parser.ts` | `saldo_anterior` sempre zero sem isso |
| 🔴 Alta | Descrição multi-coluna | `parser.ts` | Maioria das contas sem nome |
| 🟡 Média | Filtro folha-only | `parser.ts` | Evita dupla contagem nos KPIs |
| 🟡 Média | Parar em "RESUMO DO BALANCETE" | `parser.ts` | Robustez (parcialmente ok hoje) |
| 🟢 Baixa | Extração de CNPJ do arquivo | `parser.ts` + `route.ts` | UX: vinculação automática |
| 🟢 Baixa | Extração do período do arquivo | `parser.ts` + `route.ts` | UX: menos campos a preencher |
| 🟢 Baixa | Ordenação do CSV por código | `ledger-parser.ts` | Consistência dos dados |
