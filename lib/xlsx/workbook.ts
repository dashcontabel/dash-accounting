import { read, utils } from "xlsx";

import { parseXlsxRows } from "./parser";

function resolveSheetName(workbook: ReturnType<typeof read>, hint?: string): string {
  if (!workbook.SheetNames.length) {
    throw new Error("Arquivo XLSX sem abas.");
  }

  if (hint && workbook.Sheets[hint]) return hint;

  const normalize = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const candidates = ["balancete", "balancete de verificacao", "trial balance"];
  for (const candidate of candidates) {
    const match = workbook.SheetNames.find((n) => normalize(n) === candidate);
    if (match) return match;
  }

  return workbook.SheetNames[0]!;
}

export function parseXlsxBuffer(buffer: Buffer, sheetName?: string) {
  const workbook = read(buffer, { type: "buffer", cellDates: false });
  const targetSheetName = resolveSheetName(workbook, sheetName);
  const worksheet = workbook.Sheets[targetSheetName];

  if (!worksheet) {
    throw new Error(`Aba "${targetSheetName}" nao encontrada no arquivo.`);
  }

  const rows = utils.sheet_to_json(worksheet, {
    header: 1,
    raw: true,
    blankrows: false,
    defval: "",
  }) as unknown[][];

  return parseXlsxRows(rows);
}
