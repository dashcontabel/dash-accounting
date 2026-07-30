import { describe, expect, it } from "vitest";

import {
  buildTenantPaymentSummary,
  resolveTenantPaymentStatus,
  type TenantPaymentEntryInput,
} from "./tenant-payments";

function entry(overrides: Partial<TenantPaymentEntryInput>): TenantPaymentEntryInput {
  return {
    referenceMonth: "2026-04",
    entryDate: new Date("2026-04-10"),
    accountCode: "1.1.30.001",
    accountName: "Agil",
    costCenter: "Placa - ADM",
    lot: "1900",
    description: "VR REF A ALUGUEL AGIL",
    debit: 0,
    credit: 0,
    ...overrides,
  };
}

describe("tenant payment summary", () => {
  it("calculates partial, paid and open statuses from receivable provisions and bank payments", () => {
    const summary = buildTenantPaymentSummary([
      entry({ lot: "p1", debit: 1000 }),
      entry({
        lot: "p1",
        accountCode: "4.1.10.200.3",
        accountName: "LOCACAO DE IMOVEIS",
        credit: 1000,
      }),
      entry({
        lot: "b1",
        entryDate: new Date("2026-04-20"),
        credit: 400,
      }),
      entry({
        lot: "b1",
        entryDate: new Date("2026-04-20"),
        accountCode: "1.1.10.200.2",
        accountName: "BANCO DO BRASIL",
        debit: 400,
      }),
      entry({
        referenceMonth: "2026-05",
        entryDate: new Date("2026-05-10"),
        lot: "p2",
        accountName: "Barbara",
        debit: 800,
      }),
      entry({
        referenceMonth: "2026-05",
        entryDate: new Date("2026-05-10"),
        lot: "p2",
        accountCode: "4.1.10.200.2",
        accountName: "CONDOMINIO",
        credit: 800,
      }),
      entry({
        referenceMonth: "2026-05",
        entryDate: new Date("2026-05-25"),
        lot: "b2",
        accountName: "Barbara",
        credit: 800,
      }),
      entry({
        referenceMonth: "2026-05",
        entryDate: new Date("2026-05-25"),
        lot: "b2",
        accountCode: "1.1.10.200.2",
        accountName: "BANCO DO BRASIL",
        debit: 800,
      }),
      entry({
        referenceMonth: "2026-06",
        entryDate: new Date("2026-06-10"),
        lot: "p3",
        accountName: "Carlos",
        debit: 500,
      }),
      entry({
        referenceMonth: "2026-06",
        entryDate: new Date("2026-06-10"),
        lot: "p3",
        accountCode: "4.1.10.200.4",
        accountName: "ACORDO ALUGUEL COND",
        credit: 500,
      }),
    ]);

    expect(summary.hasPaymentData).toBe(true);
    expect(summary.competencies).toEqual(["2026-04", "2026-05", "2026-06"]);
    expect(summary.costCenters).toEqual(["Placa - ADM"]);
    expect(summary.items).toEqual([
      expect.objectContaining({
        tenantName: "Agil",
        referenceMonth: "2026-04",
        provisioned: 1000,
        paid: 400,
        openBalance: 600,
        status: "PARTIAL",
      }),
      expect.objectContaining({
        tenantName: "Barbara",
        referenceMonth: "2026-05",
        provisioned: 800,
        paid: 800,
        openBalance: 0,
        status: "PAID",
      }),
      expect.objectContaining({
        tenantName: "Carlos",
        referenceMonth: "2026-06",
        provisioned: 500,
        paid: 0,
        openBalance: 500,
        status: "OPEN",
      }),
    ]);
  });

  it("does not treat receivable bank movements as provisions without a revenue counterpart", () => {
    const summary = buildTenantPaymentSummary([
      entry({ lot: "1882", debit: 5449.26 }),
      entry({
        lot: "1882",
        accountCode: "1.1.10.200.2",
        accountName: "BANCO DO BRASIL",
        credit: 5449.26,
      }),
    ]);

    expect(summary.hasPaymentData).toBe(false);
    expect(summary.items).toEqual([]);
  });

  it("allocates later payments to the oldest open provision for the same tenant", () => {
    const summary = buildTenantPaymentSummary([
      entry({ referenceMonth: "2026-04", entryDate: new Date("2026-04-10"), lot: "p1", debit: 1000 }),
      entry({
        referenceMonth: "2026-04",
        entryDate: new Date("2026-04-10"),
        lot: "p1",
        accountCode: "4.1.10.200.3",
        accountName: "LOCACAO DE IMOVEIS",
        credit: 1000,
      }),
      entry({ referenceMonth: "2026-05", entryDate: new Date("2026-05-10"), lot: "p2", debit: 1000 }),
      entry({
        referenceMonth: "2026-05",
        entryDate: new Date("2026-05-10"),
        lot: "p2",
        accountCode: "4.1.10.200.3",
        accountName: "LOCACAO DE IMOVEIS",
        credit: 1000,
      }),
      entry({ referenceMonth: "2026-05", entryDate: new Date("2026-05-20"), lot: "b1", credit: 1500 }),
      entry({
        referenceMonth: "2026-05",
        entryDate: new Date("2026-05-20"),
        lot: "b1",
        accountCode: "1.1.10.200.2",
        accountName: "BANCO DO BRASIL",
        debit: 1500,
      }),
    ]);

    expect(summary.items).toEqual([
      expect.objectContaining({ referenceMonth: "2026-04", paid: 1000, status: "PAID" }),
      expect.objectContaining({ referenceMonth: "2026-05", paid: 500, status: "PARTIAL" }),
    ]);
  });

  it("supports v2 tenant accounts with separate revenue provision lots and grouped bank receipts", () => {
    const summary = buildTenantPaymentSummary([
      entry({
        referenceMonth: "2026-01",
        entryDate: new Date("2026-01-10"),
        accountCode: "1.1.20.100.1",
        accountName: "AGIL ARQUITETURA",
        costCenter: "Condominio",
        lot: "2394",
        description: "PROVISAO AGIL ARQUITETURA 01/2026",
        debit: 633,
      }),
      entry({
        referenceMonth: "2026-01",
        entryDate: new Date("2026-01-10"),
        accountCode: "4.1.10.200.2",
        accountName: "CONDOMINIO",
        costCenter: "Condominio",
        lot: "2396",
        description: "CONDOMINIO AGIL ARQUITETURA 01/2026",
        credit: 633,
      }),
      entry({
        referenceMonth: "2026-01",
        entryDate: new Date("2026-01-10"),
        accountCode: "1.1.20.100.1",
        accountName: "AGIL ARQUITETURA",
        costCenter: "Placa - ADM",
        lot: "2394",
        description: "PROVISAO AGIL ARQUITETURA 01/2026",
        debit: 1424,
      }),
      entry({
        referenceMonth: "2026-01",
        entryDate: new Date("2026-01-10"),
        accountCode: "4.1.10.200.3",
        accountName: "LOCACAO DE IMOVEIS",
        costCenter: "Placa - ADM",
        lot: "2395",
        description: "ALUGUEL AGIL ARQUITETURA 01/2026",
        credit: 1424,
      }),
      entry({
        referenceMonth: "2026-03",
        entryDate: new Date("2026-03-06"),
        accountCode: "1.1.10.200.2",
        accountName: "BANCO DO BRASIL",
        costCenter: "Sem Centro de Custo",
        lot: "2258",
        description: "REC AGIL ARQUITETURA 03/2026",
        debit: 2057,
      }),
      entry({
        referenceMonth: "2026-03",
        entryDate: new Date("2026-03-06"),
        accountCode: "1.1.20.100.1",
        accountName: "AGIL ARQUITETURA",
        costCenter: "Condominio",
        lot: "2258",
        description: "REC AGIL ARQUITETURA 03/2026",
        credit: 633,
      }),
      entry({
        referenceMonth: "2026-03",
        entryDate: new Date("2026-03-06"),
        accountCode: "1.1.20.100.1",
        accountName: "AGIL ARQUITETURA",
        costCenter: "Placa - ADM",
        lot: "2258",
        description: "REC AGIL ARQUITETURA 03/2026",
        credit: 1424,
      }),
    ]);

    expect(summary.costCenters).toEqual(["Condominio", "Placa - ADM"]);
    expect(summary.items).toEqual([
      expect.objectContaining({
        tenantName: "AGIL ARQUITETURA",
        referenceMonth: "2026-01",
        costCenter: "Condominio",
        provisioned: 633,
        paid: 633,
        openBalance: 0,
        status: "PAID",
      }),
      expect.objectContaining({
        tenantName: "AGIL ARQUITETURA",
        referenceMonth: "2026-01",
        costCenter: "Placa - ADM",
        provisioned: 1424,
        paid: 1424,
        openBalance: 0,
        status: "PAID",
      }),
    ]);
  });

  it("counts receivable credits as payments even when the bank row is not present in detail", () => {
    const summary = buildTenantPaymentSummary([
      entry({
        referenceMonth: "2026-01",
        entryDate: new Date("2026-01-10"),
        accountCode: "1.1.20.100.1",
        accountName: "AGIL ARQUITETURA",
        costCenter: "Condominio",
        lot: "2394",
        description: "PROVISAO AGIL ARQUITETURA 01/2026",
        debit: 633,
      }),
      entry({
        referenceMonth: "2026-01",
        entryDate: new Date("2026-01-10"),
        accountCode: "4.1.10.200.2",
        accountName: "CONDOMINIO",
        costCenter: "Condominio",
        lot: "2396",
        description: "CONDOMINIO AGIL ARQUITETURA 01/2026",
        credit: 633,
      }),
      entry({
        referenceMonth: "2026-03",
        entryDate: new Date("2026-03-06"),
        accountCode: "1.1.20.100.1",
        accountName: "AGIL ARQUITETURA",
        costCenter: "Condominio",
        lot: "2258",
        description: "REC AGIL ARQUITETURA 03/2026",
        credit: 633,
      }),
    ]);

    expect(summary.items).toEqual([
      expect.objectContaining({
        tenantName: "AGIL ARQUITETURA",
        provisioned: 633,
        paid: 633,
        openBalance: 0,
        status: "PAID",
      }),
    ]);
  });

  it("resolves status from provisioned and paid amounts", () => {
    expect(resolveTenantPaymentStatus(100, 100)).toBe("PAID");
    expect(resolveTenantPaymentStatus(100, 0)).toBe("OPEN");
    expect(resolveTenantPaymentStatus(100, 25)).toBe("PARTIAL");
  });
});
