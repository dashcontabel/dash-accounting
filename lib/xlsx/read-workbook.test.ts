import { describe, expect, it } from "vitest";
import { CFB, read, utils, write } from "xlsx";

import { isRazaoFormat, parseRazaoBuffer } from "./razao-parser";
import { parseXlsxBuffer } from "./workbook";

function xlsWithMisplacedSheetOffset(rows: unknown[][], sheetName: string): Buffer {
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, utils.aoa_to_sheet(rows), sheetName);
  const compoundFile = CFB.read(write(workbook, { type: "buffer", bookType: "xls" }), { type: "buffer" });
  const streamEntry = compoundFile.FileIndex.find((entry: { name: string }) => entry.name === "Workbook");
  if (!streamEntry?.content) throw new Error("Workbook stream missing from test file");

  const stream = Buffer.from(streamEntry.content);
  for (let position = 0; position + 4 <= stream.length;) {
    const recordType = stream.readUInt16LE(position);
    const recordLength = stream.readUInt16LE(position + 2);
    if (recordType === 0x0085) {
      stream.writeUInt32LE(stream.readUInt32LE(position + 4) - 4, position + 4);
      streamEntry.content = stream;
      return CFB.write(compoundFile, { type: "buffer" }) as Buffer;
    }
    position += 4 + recordLength;
  }
  throw new Error("BOUNDSHEET record missing from test file");
}

describe("accounting XLS exports with invalid sheet offsets", () => {
  it("recovers balancete rows and period without changing the uploaded bytes", () => {
    const buffer = xlsWithMisplacedSheetOffset([
      ["Período:", "01/01/2026 - 31/08/2026"],
      ["Código", "Classificação", "Descrição da conta", "Saldo Anterior", "Débito", "Crédito", "Saldo Atual"],
      [1, "1.1", "Ativo", 0, 0, 0, 100],
      [2, "1.1.1", "Banco", 0, 100, 0, 100],
    ], "Balancete");
    const original = Buffer.from(buffer);
    expect(Object.keys(read(buffer, { type: "buffer" }).Sheets)).toHaveLength(0);

    const parsed = parseXlsxBuffer(buffer, "balancete.xls");

    expect(parsed.metadata).toMatchObject({ referenceMonth: "2026-01", periodEndMonth: "2026-08" });
    expect(parsed.rows).toEqual([
      expect.objectContaining({ accountCode: "1.1.1", values: expect.objectContaining({ saldo_atual: 100 }) }),
    ]);
    expect(buffer.compare(original)).toBe(0);
  });

  it("recognizes Razão and preserves its monthly transactions", () => {
    const buffer = xlsWithMisplacedSheetOffset([
      ["Período:", "", "01/01/2026 - 31/01/2026"],
      ["Data", "Lote", "Histórico", "", "", "", "Cta.C.Part.", "Débito", "Crédito", "", "", "", "Saldo-Exercício"],
      ["Conta:", 8, "1.1.1.02.001", "", "Banco"],
      ["", "", "SALDO ANTERIOR", "", "", "", "", "", "", "", "", "", 0],
      [46031, 123, "Recebimento", "", "", "", 447, 2098.8, 0, "", "", "", 2098.8],
    ], "Razão");
    expect(Object.keys(read(buffer, { type: "buffer" }).Sheets)).toHaveLength(0);

    expect(isRazaoFormat(buffer)).toBe(true);
    const parsed = parseRazaoBuffer(buffer);

    expect(parsed.months).toEqual(["2026-01"]);
    expect(parsed.byMonth["2026-01"]?.entries).toEqual([
      expect.objectContaining({ accountCode: "1.1.1.02.001", debit: 2098.8, credit: 0 }),
    ]);
  });
});
