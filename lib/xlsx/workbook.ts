import { read, utils } from "xlsx";

import { parseXlsxRows } from "./parser";

type SupportedFormat = "xlsx" | "xls" | "csv";

export function detectFileFormat(fileName: string, buffer: Buffer): SupportedFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".xls") && !lower.endsWith(".xlsx")) return "xls";

  // Magic-byte detection as fallback: XLS = D0 CF 11 E0, XLSX = PK (50 4B)
  if (buffer.length >= 4) {
    if (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) return "xls";
    if (buffer[0] === 0x50 && buffer[1] === 0x4b) return "xlsx";
  }

  return "xlsx";
}

function resolveSheetName(workbook: ReturnType<typeof read>, hint?: string): string {
  if (!workbook.SheetNames.length) {
    throw new Error("Arquivo sem abas.");
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

export function parseXlsxBuffer(buffer: Buffer, fileName = "upload.xlsx", sheetName?: string) {
  const format = detectFileFormat(fileName, buffer);

  let workbook: ReturnType<typeof read>;

  if (format === "csv") {
    // CSV has no sheet concept — parse as UTF-8 text then feed to xlsx
    const csvText = buffer.toString("utf8");
    workbook = read(csvText, { type: "string", cellDates: false });
  } else {
    // Both .xlsx and .xls are handled by the binary buffer reader
    workbook = read(buffer, { type: "buffer", cellDates: false });
  }

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
