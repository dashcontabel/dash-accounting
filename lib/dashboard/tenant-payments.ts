export type TenantPaymentStatus = "PAID" | "OPEN" | "PARTIAL";

export type TenantPaymentEntryInput = {
  referenceMonth: string;
  entryDate: Date | string;
  accountCode: string;
  accountName: string;
  costCenter: string | null;
  lot: string | null;
  description: string | null;
  debit: unknown;
  credit: unknown;
};

export type TenantPaymentMonthStatus = {
  tenantKey: string;
  tenantName: string;
  referenceMonth: string;
  costCenter: string | null;
  provisioned: number;
  paid: number;
  openBalance: number;
  status: TenantPaymentStatus;
};

export type TenantPaymentSummary = {
  hasPaymentData: boolean;
  items: TenantPaymentMonthStatus[];
  costCenters: string[];
  competencies: string[];
  tenantNames: string[];
};

type NormalizedEntry = TenantPaymentEntryInput & {
  entryDateKey: string;
  debitValue: number;
  creditValue: number;
};

type PaymentEvent = {
  tenantKey: string;
  tenantName: string;
  referenceMonth: string;
  entryDateKey: string;
  costCenter: string | null;
  amount: number;
};

type PaymentBucket = {
  tenantKey: string;
  tenantName: string;
  referenceMonth: string;
  costCenter: string | null;
  provisioned: number;
  paid: number;
  firstEntryDateKey: string;
};

const EPSILON = 0.005;
const GENERIC_TENANT_TOKENS = new Set([
  "aluguel",
  "condominio",
  "acordo",
  "cliente",
  "recebimento",
  "provisao",
  "ref",
  "mes",
  "meses",
  "parc",
]);

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLoose(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

function normalizeAccountCode(value: string) {
  return value.trim();
}

function tenantTokens(value: string) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !GENERIC_TENANT_TOKENS.has(token));
}

function normalizeCostCenter(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeTenantName(value: string) {
  return value.replace(/\s+/g, " ").trim() || "Locatario sem nome";
}

function tenantKey(value: string) {
  const loose = normalizeLoose(value);
  return loose || "locatario-sem-nome";
}

function toDateKey(value: Date | string) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value).slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export function resolveTenantPaymentStatus(provisioned: number, paid: number): TenantPaymentStatus {
  if (paid >= provisioned - EPSILON) return "PAID";
  if (paid <= EPSILON) return "OPEN";
  return "PARTIAL";
}

function isReceivableTenantAccount(entry: NormalizedEntry) {
  const code = normalizeAccountCode(entry.accountCode);
  const name = normalizeText(entry.accountName);

  if (code.startsWith("1.1.30")) return true;
  if (code.startsWith("1.1.20.100") && Boolean(normalizeCostCenter(entry.costCenter))) return true;

  return (
    code.startsWith("1.1") &&
    name.includes("receber") &&
    (name.includes("loca") ||
      name.includes("locat") ||
      name.includes("alug") ||
      name.includes("condomin") ||
      name.includes("cliente"))
  );
}

function isRentalRevenueAccount(entry: NormalizedEntry) {
  const code = normalizeAccountCode(entry.accountCode);
  const name = normalizeText(entry.accountName);

  return (
    code.startsWith("4.1.10.200") &&
    (name.includes("loca") ||
      name.includes("alug") ||
      name.includes("condomin") ||
      name.includes("acordo") ||
      name.includes("adm"))
  );
}

function isBankAccount(entry: NormalizedEntry) {
  const code = normalizeAccountCode(entry.accountCode);
  const name = normalizeText(entry.accountName);

  return code.startsWith("1.1.10") || name.includes("banco") || name.includes("caixa");
}

function sameAmount(a: number, b: number) {
  return Math.abs(a - b) <= EPSILON;
}

function tenantMatchesDescription(tenantName: string, description: string | null) {
  const looseDescription = normalizeLoose(description ?? "");
  if (!looseDescription) return false;

  const looseTenant = normalizeLoose(tenantName);
  if (looseTenant && looseDescription.includes(looseTenant)) return true;

  const tokens = tenantTokens(tenantName);
  if (tokens.length === 0) return false;

  const matches = tokens.filter((token) => looseDescription.includes(token));
  return matches.length >= Math.min(2, tokens.length) || matches.some((token) => token.length >= 5);
}

function groupEntriesByLot(entries: NormalizedEntry[]) {
  const byLot = new Map<string, NormalizedEntry[]>();

  for (const entry of entries) {
    if (!entry.lot) continue;
    const key = `${entry.referenceMonth}|${entry.entryDateKey}|${entry.lot}`;
    const lotEntries = byLot.get(key) ?? [];
    lotEntries.push(entry);
    byLot.set(key, lotEntries);
  }

  return byLot;
}

function findOffsetEntry({
  entry,
  lotEntries,
  amount,
  classifier,
  side,
}: {
  entry: NormalizedEntry;
  lotEntries: NormalizedEntry[];
  amount: number;
  classifier: (candidate: NormalizedEntry) => boolean;
  side: "debit" | "credit";
}) {
  const candidates = lotEntries.filter((candidate) => {
    if (candidate === entry) return false;
    if (!classifier(candidate)) return false;
    const candidateAmount = side === "debit" ? candidate.debitValue : candidate.creditValue;
    return candidateAmount > EPSILON;
  });

  const exact = candidates.find((candidate) => {
    const candidateAmount = side === "debit" ? candidate.debitValue : candidate.creditValue;
    return sameAmount(candidateAmount, amount);
  });
  if (exact) return exact;

  const total = candidates.reduce(
    (sum, candidate) => sum + (side === "debit" ? candidate.debitValue : candidate.creditValue),
    0,
  );

  return sameAmount(total, amount) ? candidates[0] ?? null : null;
}

function findRevenueEntryForProvision({
  entry,
  entries,
  lotEntries,
}: {
  entry: NormalizedEntry;
  entries: NormalizedEntry[];
  lotEntries: NormalizedEntry[];
}) {
  const sameLotRevenue = findOffsetEntry({
    entry,
    lotEntries,
    amount: entry.debitValue,
    classifier: isRentalRevenueAccount,
    side: "credit",
  });
  if (sameLotRevenue) return sameLotRevenue;

  const entryCostCenter = normalizeCostCenter(entry.costCenter);

  return entries.find((candidate) => {
    if (candidate === entry) return false;
    if (!isRentalRevenueAccount(candidate)) return false;
    if (candidate.referenceMonth !== entry.referenceMonth) return false;
    if (candidate.entryDateKey !== entry.entryDateKey) return false;
    if (normalizeCostCenter(candidate.costCenter) !== entryCostCenter) return false;
    if (!sameAmount(candidate.creditValue, entry.debitValue)) return false;
    return tenantMatchesDescription(entry.accountName, candidate.description);
  }) ?? null;
}

function findBankEntryForPayment(entry: NormalizedEntry, lotEntries: NormalizedEntry[]) {
  const sameLotBank = findOffsetEntry({
    entry,
    lotEntries,
    amount: entry.creditValue,
    classifier: isBankAccount,
    side: "debit",
  });
  if (sameLotBank) return sameLotBank;

  const bankEntries = lotEntries.filter((candidate) => isBankAccount(candidate) && candidate.debitValue > EPSILON);
  if (bankEntries.length === 0) return null;

  const totalBankDebit = bankEntries.reduce((sum, candidate) => sum + candidate.debitValue, 0);
  const totalReceivableCredit = lotEntries
    .filter((candidate) => isReceivableTenantAccount(candidate) && candidate.creditValue > EPSILON)
    .reduce((sum, candidate) => sum + candidate.creditValue, 0);

  return sameAmount(totalBankDebit, totalReceivableCredit) ? bankEntries[0] ?? null : null;
}

function buildProvisionEvents(entries: NormalizedEntry[], byLot: Map<string, NormalizedEntry[]>) {
  const events: PaymentEvent[] = [];

  for (const entry of entries) {
    if (!isReceivableTenantAccount(entry) || entry.debitValue <= EPSILON || !entry.lot) continue;

    const lotEntries = byLot.get(`${entry.referenceMonth}|${entry.entryDateKey}|${entry.lot}`) ?? [];
    const revenueEntry = findRevenueEntryForProvision({
      entry,
      entries,
      lotEntries,
    });

    if (!revenueEntry) continue;

    const tenantName = normalizeTenantName(entry.accountName);
    events.push({
      tenantKey: tenantKey(tenantName),
      tenantName,
      referenceMonth: entry.referenceMonth,
      entryDateKey: entry.entryDateKey,
      costCenter: normalizeCostCenter(entry.costCenter) ?? normalizeCostCenter(revenueEntry.costCenter),
      amount: roundMoney(entry.debitValue),
    });
  }

  return events;
}

function buildPaymentEvents(entries: NormalizedEntry[], byLot: Map<string, NormalizedEntry[]>) {
  const events: PaymentEvent[] = [];

  for (const entry of entries) {
    if (!isReceivableTenantAccount(entry) || entry.creditValue <= EPSILON || !entry.lot) continue;

    const lotEntries = byLot.get(`${entry.referenceMonth}|${entry.entryDateKey}|${entry.lot}`) ?? [];
    const bankEntry = findBankEntryForPayment(entry, lotEntries);

    const tenantName = normalizeTenantName(entry.accountName);
    events.push({
      tenantKey: tenantKey(tenantName),
      tenantName,
      referenceMonth: entry.referenceMonth,
      entryDateKey: entry.entryDateKey,
      costCenter: normalizeCostCenter(entry.costCenter) ?? normalizeCostCenter(bankEntry?.costCenter ?? null),
      amount: roundMoney(entry.creditValue),
    });
  }

  return events;
}

function bucketKey(event: Pick<PaymentEvent, "tenantKey" | "referenceMonth" | "costCenter">) {
  return `${event.tenantKey}|${event.referenceMonth}|${event.costCenter ?? "__null__"}`;
}

function allocatePayments(buckets: PaymentBucket[], payments: PaymentEvent[]) {
  const orderedBuckets = [...buckets].sort((a, b) => {
    const monthOrder = a.referenceMonth.localeCompare(b.referenceMonth);
    if (monthOrder !== 0) return monthOrder;
    return a.firstEntryDateKey.localeCompare(b.firstEntryDateKey);
  });

  const orderedPayments = [...payments].sort((a, b) => {
    const dateOrder = a.entryDateKey.localeCompare(b.entryDateKey);
    if (dateOrder !== 0) return dateOrder;
    return a.referenceMonth.localeCompare(b.referenceMonth);
  });

  for (const payment of orderedPayments) {
    let remaining = payment.amount;
    if (remaining <= EPSILON) continue;

    let candidates = orderedBuckets.filter(
      (bucket) =>
        bucket.tenantKey === payment.tenantKey &&
        bucket.referenceMonth <= payment.referenceMonth &&
        bucket.provisioned - bucket.paid > EPSILON,
    );

    if (payment.costCenter) {
      const exactCostCenter = candidates.filter((bucket) => bucket.costCenter === payment.costCenter);
      if (exactCostCenter.length > 0) candidates = exactCostCenter;
    }

    for (const bucket of candidates) {
      const openAmount = bucket.provisioned - bucket.paid;
      const allocated = Math.min(openAmount, remaining);
      bucket.paid = roundMoney(bucket.paid + allocated);
      remaining = roundMoney(remaining - allocated);
      if (remaining <= EPSILON) break;
    }
  }
}

export function buildTenantPaymentSummary(inputEntries: TenantPaymentEntryInput[]): TenantPaymentSummary {
  const entries = inputEntries.map((entry) => ({
    ...entry,
    costCenter: normalizeCostCenter(entry.costCenter),
    entryDateKey: toDateKey(entry.entryDate),
    debitValue: toNumber(entry.debit),
    creditValue: toNumber(entry.credit),
  }));

  const byLot = groupEntriesByLot(entries);
  const provisions = buildProvisionEvents(entries, byLot);

  if (provisions.length === 0) {
    return {
      hasPaymentData: false,
      items: [],
      costCenters: [],
      competencies: [],
      tenantNames: [],
    };
  }

  const payments = buildPaymentEvents(entries, byLot);
  const bucketsByKey = new Map<string, PaymentBucket>();

  for (const provision of provisions) {
    const key = bucketKey(provision);
    const bucket = bucketsByKey.get(key);
    if (bucket) {
      bucket.provisioned = roundMoney(bucket.provisioned + provision.amount);
      if (provision.entryDateKey < bucket.firstEntryDateKey) {
        bucket.firstEntryDateKey = provision.entryDateKey;
      }
      continue;
    }

    bucketsByKey.set(key, {
      tenantKey: provision.tenantKey,
      tenantName: provision.tenantName,
      referenceMonth: provision.referenceMonth,
      costCenter: provision.costCenter,
      provisioned: provision.amount,
      paid: 0,
      firstEntryDateKey: provision.entryDateKey,
    });
  }

  const buckets = [...bucketsByKey.values()];
  allocatePayments(buckets, payments);

  const items = buckets
    .map<TenantPaymentMonthStatus>((bucket) => {
      const provisioned = roundMoney(bucket.provisioned);
      const paid = roundMoney(Math.min(bucket.paid, bucket.provisioned));
      const openBalance = roundMoney(Math.max(provisioned - paid, 0));

      return {
        tenantKey: bucket.tenantKey,
        tenantName: bucket.tenantName,
        referenceMonth: bucket.referenceMonth,
        costCenter: bucket.costCenter,
        provisioned,
        paid,
        openBalance,
        status: resolveTenantPaymentStatus(provisioned, paid),
      };
    })
    .sort((a, b) => {
      const tenantOrder = a.tenantName.localeCompare(b.tenantName, "pt-BR");
      if (tenantOrder !== 0) return tenantOrder;
      const monthOrder = a.referenceMonth.localeCompare(b.referenceMonth);
      if (monthOrder !== 0) return monthOrder;
      return (a.costCenter ?? "").localeCompare(b.costCenter ?? "", "pt-BR");
    });

  const costCenters = [
    ...new Set(items.map((item) => item.costCenter).filter((value): value is string => Boolean(value))),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const competencies = [...new Set(items.map((item) => item.referenceMonth))].sort();
  const tenantNames = [...new Set(items.map((item) => item.tenantName))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );

  return {
    hasPaymentData: items.length > 0,
    items,
    costCenters,
    competencies,
    tenantNames,
  };
}
