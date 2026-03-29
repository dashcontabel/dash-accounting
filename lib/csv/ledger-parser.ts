import { Readable } from "node:stream";

import { parse } from "csv-parse";
import { z } from "zod";

type RawCsvRecord = Record<string, string | undefined>;

type NormalizedLedgerRow = {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  balance: number;
  rawJson: RawCsvRecord;
};

const rowSchema = z.object({
  accountCode: z.string().trim().min(1),
  accountName: z.string().trim().min(1),
  debit: z.number().finite(),
  credit: z.number().finite(),
  balance: z.number().finite(),
});

const headerAliases: Record<keyof Omit<NormalizedLedgerRow, "rawJson">, string[]> = {
  accountCode: ["accountcode", "account_code", "codigo", "codigoconta", "conta", "codconta"],
  accountName: ["accountname", "account_name", "nome", "nomeconta", "descricao", "descricaoconta"],
  debit: ["debit", "debito", "debitos"],
  credit: ["credit", "credito", "creditos"],
  balance: ["balance", "saldo"],
};

function normalizeHeaderKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizePtBrNumber(input: string) {
  const raw = String(input ?? "").trim();
  if (!raw) return 0;

  const isNegativeByParentheses = raw.startsWith("(") && raw.endsWith(")");
  const withoutSymbols = raw
    .replace(/[R$\s]/g, "")
    .replace(/[()]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(withoutSymbols);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Valor numerico invalido: "${input}"`);
  }

  return isNegativeByParentheses ? -Math.abs(parsed) : parsed;
}

function getFirstValue(record: RawCsvRecord, aliases: string[]) {
  const entries = Object.entries(record);
  for (const [key, value] of entries) {
    if (!value) continue;
    const normalizedKey = normalizeHeaderKey(key);
    if (aliases.includes(normalizedKey)) {
      return String(value);
    }
  }

  return "";
}

function normalizeRecord(record: RawCsvRecord): Omit<NormalizedLedgerRow, "rawJson"> {
  return {
    accountCode: getFirstValue(record, headerAliases.accountCode).trim(),
    accountName: getFirstValue(record, headerAliases.accountName).trim(),
    debit: normalizePtBrNumber(getFirstValue(record, headerAliases.debit)),
    credit: normalizePtBrNumber(getFirstValue(record, headerAliases.credit)),
    balance: normalizePtBrNumber(getFirstValue(record, headerAliases.balance)),
  };
}

function detectDelimiter(sample: string) {
  if (sample.includes(";")) return ";";
  if (sample.includes("\t")) return "\t";
  return ",";
}

export async function parseLedgerCsvBuffer(buffer: Buffer) {
  const sample = buffer.toString("utf8", 0, Math.min(buffer.length, 4096));
  const firstLine = sample.split(/\r?\n/)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);

  const source = Readable.from([buffer]);
  const parser = source.pipe(
    parse({
      columns: true,
      bom: true,
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true,
      delimiter,
    }),
  );

  const entries: NormalizedLedgerRow[] = [];
  let rowIndex = 1;
  let totalDebit = 0;
  let totalCredit = 0;

  for await (const rawRecord of parser) {
    rowIndex += 1;
    const normalized = normalizeRecord(rawRecord as RawCsvRecord);
    const parsed = rowSchema.safeParse(normalized);

    if (!parsed.success) {
      throw new Error(`Linha ${rowIndex} invalida.`);
    }

    entries.push({
      ...parsed.data,
      rawJson: rawRecord as RawCsvRecord,
    });

    totalDebit += parsed.data.debit;
    totalCredit += parsed.data.credit;
  }

  if (entries.length === 0) {
    throw new Error("Arquivo CSV vazio ou sem linhas validas.");
  }

  // Sort entries by account code hierarchy (numerically per segment)
  entries.sort((a, b) => {
    const partsA = a.accountCode.split(".").map(Number);
    const partsB = b.accountCode.split(".").map(Number);
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  });

  return {
    entries,
    totals: {
      rows: entries.length,
      totalDebit,
      totalCredit,
    },
  };
}

export async function parseLedgerCsvFile(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return parseLedgerCsvBuffer(buffer);
}
