import { z } from "zod";

export type NormalizedValueColumn = "saldo_atual" | "debito" | "credito" | "saldo_anterior";

export type ParsedAccountRow = {
  accountCode: string;
  description: string;
  values: Record<NormalizedValueColumn, number>;
};

export type XlsxFileMetadata = {
  cnpj: string | null;
  referenceMonth: string | null;
  periodEndMonth: string | null;
};

type HeaderInfo = {
  accountCode: number;
  descFromCol: number;
  descToCol: number;
  valueHeaders: Partial<Record<NormalizedValueColumn, number>>;
};

type ColumnMap = {
  accountCode: number;
  descFromCol: number;
  descToCol: number;
  valueColumns: Partial<Record<NormalizedValueColumn, number>>;
};

const ACCOUNT_CODE_REGEX = /^\d+(\.\d+)*$/;
const HEADER_SCAN_LIMIT = 40;
const SUMMARY_MARKER = "resumo do balancete";

const rowSchema = z.object({
  accountCode: z.string().regex(ACCOUNT_CODE_REGEX),
  description: z.string(),
  values: z.object({
    saldo_atual: z.number().finite(),
    debito: z.number().finite(),
    credito: z.number().finite(),
    saldo_anterior: z.number().finite(),
  }),
});

// Ordered from most-specific to most-generic so that a "Classificação" column
// is always preferred over a plain "Código" sequential-number column when both
// exist in the same sheet (as in standard balancete exports).
const accountCodeHeaderAliasGroups = [
  ["classificacao", "classificação"],
  ["codigo conta", "código conta"],
  ["codigo", "código"],
] as const;

// Flat list used only for header-row detection (any alias is sufficient there)
const accountCodeHeaderAliases = accountCodeHeaderAliasGroups.flat();

const descriptionHeaderAliases = ["descricao", "descrição", "conta", "nome", "descricao conta"];

const valueHeaderAliases: Record<NormalizedValueColumn, string[]> = {
  saldo_anterior: ["saldo anterior", "saldooriginal", "saldo inicial"],
  debito: ["debito", "débito", "debitos", "débitos"],
  credito: ["credito", "crédito", "creditos", "créditos"],
  saldo_atual: ["saldo atual", "saldo final"],
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePtBrCurrency(rawInput: unknown): number {
  if (typeof rawInput === "number") {
    return Number.isFinite(rawInput) ? rawInput : 0;
  }

  const raw = String(rawInput ?? "").trim();
  if (!raw || raw === "-") return 0;

  const isNegativeByParentheses = raw.startsWith("(") && raw.endsWith(")");
  const normalized = raw
    .replace(/[R$\s]/g, "")
    .replace(/[()]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  if (!normalized) return 0;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Valor monetario invalido: "${raw}"`);
  }

  return isNegativeByParentheses ? -Math.abs(parsed) : parsed;
}

function findHeaderRow(rows: unknown[][]) {
  const upperBound = Math.min(rows.length, HEADER_SCAN_LIMIT);

  for (let rowIndex = 0; rowIndex < upperBound; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const normalizedCells = row.map((cell) => normalizeText(cell));

    const hasAccountCode = normalizedCells.some((cell) =>
      accountCodeHeaderAliases.some((alias) => cell.includes(normalizeText(alias))),
    );
    const hasValueColumn = normalizedCells.some((cell) =>
      Object.values(valueHeaderAliases)
        .flat()
        .some((alias) => cell.includes(normalizeText(alias))),
    );

    if (hasAccountCode && hasValueColumn) {
      return rowIndex;
    }
  }

  return -1;
}

function parseAccountCode(input: unknown) {
  const cleaned = String(input ?? "").replace(/\s+/g, "").trim();
  if (!cleaned) return null;
  if (!ACCOUNT_CODE_REGEX.test(cleaned)) return null;
  return cleaned;
}

function readValueAt(row: unknown[], columnIndex: number | undefined): number {
  if (columnIndex === undefined || columnIndex < 0) return 0;
  return normalizePtBrCurrency(row[columnIndex]);
}

function findHeaderIndices(headerRow: unknown[]): HeaderInfo {
  const normalizedHeaders = headerRow.map((cell) => normalizeText(cell));

  // Use prioritised groups so "Classificação" wins over a plain "Código" col
  const accountCode = (() => {
    for (const group of accountCodeHeaderAliasGroups) {
      const idx = normalizedHeaders.findIndex((header) =>
        group.some((alias) => header.includes(normalizeText(alias))),
      );
      if (idx >= 0) return idx;
    }
    return -1;
  })();

  if (accountCode < 0) {
    throw new Error("Nao foi possivel identificar a coluna de Classificacao/Codigo.");
  }

  const descHeaderCol = normalizedHeaders.findIndex((header) =>
    descriptionHeaderAliases.some((alias) => header.includes(normalizeText(alias))),
  );

  const valueHeaders: Partial<Record<NormalizedValueColumn, number>> = {};
  (Object.keys(valueHeaderAliases) as NormalizedValueColumn[]).forEach((valueColumn) => {
    const aliases = valueHeaderAliases[valueColumn].map((alias) => normalizeText(alias));
    const foundIndex = normalizedHeaders.findIndex((header) =>
      aliases.some((alias) => header.includes(alias)),
    );
    if (foundIndex >= 0) {
      valueHeaders[valueColumn] = foundIndex;
    }
  });

  if (Object.keys(valueHeaders).length === 0) {
    throw new Error("Nao foi possivel identificar colunas de valores no arquivo.");
  }

  const descFromCol = descHeaderCol >= 0 ? descHeaderCol : accountCode + 1;
  const minValueHeaderCol = Math.min(...(Object.values(valueHeaders) as number[]));
  const descToCol = minValueHeaderCol > descFromCol ? minValueHeaderCol : descFromCol + 1;

  return { accountCode, descFromCol, descToCol, valueHeaders };
}

/**
 * Detects the actual data column within a merged-header span.
 * Some exports place the header label on the first merged cell but write
 * values in a non-first cell of that span (e.g. "Saldo Anterior" label at
 * col 15 but values at col 19 in a P:T merge).
 */
function resolveActualValueColumns(headerInfo: HeaderInfo, dataRows: unknown[][]): ColumnMap {
  const { accountCode, descFromCol, descToCol, valueHeaders } = headerInfo;

  const sortedEntries = (Object.entries(valueHeaders) as [NormalizedValueColumn, number][]).sort(
    ([, a], [, b]) => a - b,
  );

  const resolvedValueColumns: Partial<Record<NormalizedValueColumn, number>> = {};

  for (let i = 0; i < sortedEntries.length; i++) {
    const [colName, headerIdx] = sortedEntries[i]!;
    const nextHeaderIdx = sortedEntries[i + 1]?.[1] ?? headerIdx + 10;
    const span = nextHeaderIdx - headerIdx;

    if (span <= 1) {
      resolvedValueColumns[colName] = headerIdx;
      continue;
    }

    // Count how often each offset within the span has a non-empty value in sample rows
    const counts = new Array(span).fill(0) as number[];
    let sampled = 0;

    for (const row of dataRows) {
      if (sampled >= 20) break;
      if (!parseAccountCode(row[accountCode])) continue;

      for (let offset = 0; offset < span; offset++) {
        const val = row[headerIdx + offset];
        const hasValue =
          (typeof val === "number" && val !== 0) ||
          (typeof val === "string" && val.trim() !== "" && val.trim() !== "-");
        if (hasValue) counts[offset]++;
      }
      sampled++;
    }

    const maxCount = Math.max(...counts);
    resolvedValueColumns[colName] =
      maxCount > 0 ? headerIdx + counts.indexOf(maxCount) : headerIdx;
  }

  return { accountCode, descFromCol, descToCol, valueColumns: resolvedValueColumns };
}

/** Extracts the first non-empty, non-dash cell in the column range [fromCol, toCol). */
function extractDescription(row: unknown[], fromCol: number, toCol: number): string {
  for (let col = fromCol; col < toCol; col++) {
    const cell = String(row[col] ?? "").trim();
    if (cell && cell !== "-") return cell;
  }
  return "";
}

/**
 * Returns true when no other code in the set starts with `code + "."`,
 * i.e. this account has no children — it is a leaf / analytical account.
 */
function isLeafAccount(code: string, allCodes: Set<string>): boolean {
  const prefix = code + ".";
  for (const other of allCodes) {
    if (other.length > code.length && other.startsWith(prefix)) return false;
  }
  return true;
}

function extractCnpj(rows: unknown[][]): string | null {
  const CNPJ_REGEX = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/;
  for (const row of rows.slice(0, 10)) {
    for (const cell of row) {
      const match = CNPJ_REGEX.exec(String(cell ?? ""));
      if (match) return match[0].replace(/\D/g, "");
    }
  }
  return null;
}

function extractPeriodDates(rows: unknown[][]): { referenceMonth: string | null; periodEndMonth: string | null } {
  for (const row of rows.slice(0, 10)) {
    for (const cell of row) {
      const text = String(cell ?? "");
      const months: string[] = [];
      const re = /(\d{2})\/(\d{2})\/(\d{4})/g;
      let match: RegExpExecArray | null;
      while ((match = re.exec(text)) !== null) {
        months.push(`${match[3]}-${match[2]}`); // YYYY-MM
      }
      if (months.length >= 1) {
        const referenceMonth = months[0]!;
        const periodEndMonth =
          months.length >= 2 && months[months.length - 1] !== referenceMonth
            ? months[months.length - 1]!
            : null;
        return { referenceMonth, periodEndMonth };
      }
    }
  }
  return { referenceMonth: null, periodEndMonth: null };
}

export function parseXlsxRows(rows: unknown[][]) {
  if (!rows.length) {
    throw new Error("Arquivo XLSX sem dados.");
  }

  const headerRowIndex = findHeaderRow(rows);
  if (headerRowIndex < 0) {
    throw new Error(
      "Cabecalho nao encontrado. Verifique se a planilha contem Classificacao e valores.",
    );
  }

  const dataRows = rows.slice(headerRowIndex + 1);
  const headerInfo = findHeaderIndices(rows[headerRowIndex] ?? []);
  const columnMap = resolveActualValueColumns(headerInfo, dataRows);

  const allParsedRows: ParsedAccountRow[] = [];
  for (const row of dataRows) {
    // Stop processing when the summary block starts
    if (row.some((cell) => normalizeText(cell) === SUMMARY_MARKER)) break;

    const accountCode = parseAccountCode(row[columnMap.accountCode]);
    if (!accountCode) continue;

    const description = extractDescription(row, columnMap.descFromCol, columnMap.descToCol);
    const candidate = {
      accountCode,
      description,
      values: {
        saldo_atual: readValueAt(row, columnMap.valueColumns.saldo_atual),
        debito: readValueAt(row, columnMap.valueColumns.debito),
        credito: readValueAt(row, columnMap.valueColumns.credito),
        saldo_anterior: readValueAt(row, columnMap.valueColumns.saldo_anterior),
      },
    };

    const validated = rowSchema.safeParse(candidate);
    if (validated.success) {
      allParsedRows.push(validated.data);
    }
  }

  // Keep only leaf accounts to avoid double-counting parent/group totals
  const allCodes = new Set(allParsedRows.map((r) => r.accountCode));
  const parsedRows = allParsedRows.filter((r) => isLeafAccount(r.accountCode, allCodes));

  if (!parsedRows.length) {
    throw new Error("Nenhuma linha valida com codigo de conta foi encontrada no XLSX.");
  }

  return {
    rows: parsedRows,
    detectedColumns: {
      accountCodeIndex: columnMap.accountCode,
      descriptionFromIndex: columnMap.descFromCol,
      descriptionToIndex: columnMap.descToCol,
      valueColumnIndexes: columnMap.valueColumns,
    },
    metadata: {
      cnpj: extractCnpj(rows),
      ...extractPeriodDates(rows),
    } satisfies XlsxFileMetadata,
  };
}
