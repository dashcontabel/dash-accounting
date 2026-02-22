/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { parseLedgerCsvFile } from "./ledger-parser";

describe("parseLedgerCsvFile", () => {
  it("parses semicolon CSV and normalizes pt-BR numbers", async () => {
    const csv = [
      "codigo;nome;debito;credito;saldo",
      "1.1.01;Caixa;1.234,56;100,00;1.134,56",
    ].join("\n");
    const file = new File([csv], "balancete.csv", { type: "text/csv" });

    const result = await parseLedgerCsvFile(file);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].accountCode).toBe("1.1.01");
    expect(result.entries[0].accountName).toBe("Caixa");
    expect(result.entries[0].debit).toBe(1234.56);
    expect(result.entries[0].credit).toBe(100);
    expect(result.entries[0].balance).toBe(1134.56);
  });
});
