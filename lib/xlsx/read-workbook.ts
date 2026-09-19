import { CFB, read } from "xlsx";

/**
 * Some BIFF8 exports have a BOUNDSHEET offset that points before the sheet BOF.
 * Excel can recover these files, but SheetJS reports the sheet name without
 * loading its cells. Repair the offset in memory only when all sheets are empty.
 */
export function readAccountingWorkbook(buffer: Buffer, sheetRows?: number) {
  const options = { type: "buffer" as const, cellDates: false, ...(sheetRows ? { sheetRows } : {}) };
  const workbook = read(buffer, options);
  if (
    workbook.SheetNames.length === 0 ||
    workbook.SheetNames.some((name) => workbook.Sheets[name]) ||
    buffer.length < 4 ||
    buffer.readUInt32BE(0) !== 0xd0cf11e0
  ) {
    return workbook;
  }

  const compoundFile = CFB.read(buffer, { type: "buffer" });
  const streamEntry = compoundFile.FileIndex.find(
    (entry: { name: string }) => entry.name === "Workbook" || entry.name === "Book",
  );
  if (!streamEntry?.content) return workbook;

  const stream = Buffer.from(streamEntry.content);
  const boundSheets: number[] = [];
  const sheetStarts: number[] = [];
  let inGlobalRecords = true;

  for (let position = 0; position + 4 <= stream.length;) {
    const recordType = stream.readUInt16LE(position);
    const recordLength = stream.readUInt16LE(position + 2);
    if (position + 4 + recordLength > stream.length) return workbook;

    if (inGlobalRecords && recordType === 0x0085 && recordLength >= 4) {
      boundSheets.push(position);
    } else if (recordType === 0x0809 && recordLength >= 4 && stream.readUInt16LE(position + 6) === 0x0010) {
      sheetStarts.push(position);
    } else if (inGlobalRecords && recordType === 0x000a) {
      inGlobalRecords = false;
    }
    position += 4 + recordLength;
  }

  // Only repair when every named sheet can be paired with a real worksheet BOF.
  if (boundSheets.length !== workbook.SheetNames.length || boundSheets.length !== sheetStarts.length) {
    return workbook;
  }

  for (let index = 0; index < boundSheets.length; index += 1) {
    stream.writeUInt32LE(sheetStarts[index]!, boundSheets[index]! + 4);
  }
  streamEntry.content = stream;
  const repaired = CFB.write(compoundFile, { type: "buffer" }) as Buffer;
  return read(repaired, options);
}
