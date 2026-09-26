import { describe, expect, it } from "vitest";

import { getRevenueCardLabels } from "./revenue-card-labels";

describe("getRevenueCardLabels", () => {
  it("uses the PLACA terminology for a single PLACA company", () => {
    expect(getRevenueCardLabels([{ name: "  Placa  " }])).toEqual({
      billing: "Previsão",
      receivedInvoices: "Recebido",
    });
    expect(getRevenueCardLabels([{ name: "PLACA Administração" }])).toEqual({
      billing: "Previsão",
      receivedInvoices: "Recebido",
    });
  });

  it("keeps the standard terminology for another company", () => {
    expect(getRevenueCardLabels([{ name: "Empresa Alfa" }])).toEqual({
      billing: "Faturamento",
      receivedInvoices: "NFs Recebidas",
    });
  });

  it("keeps the standard terminology in a multi-company consolidation", () => {
    expect(getRevenueCardLabels([{ name: "PLACA" }, { name: "Empresa Beta" }])).toEqual({
      billing: "Faturamento",
      receivedInvoices: "NFs Recebidas",
    });
  });
});
