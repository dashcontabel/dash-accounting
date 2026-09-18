export type RentabilidadeAccountMapping = {
  dashboardField: string;
  matchType: "EXACT" | "PREFIX" | "LIST";
  codes: unknown;
  valueColumn: "saldo_atual" | "debito" | "credito" | "saldo_anterior";
  aggregation: "SUM" | "ABS_SUM";
};

export type RentabilidadeAccountLedgerEntry = {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  balance: number;
  previousBalance: number;
};

export type RentabilidadeAccountBatch = {
  companyId: string;
  referenceMonth: string;
  entries: RentabilidadeAccountLedgerEntry[];
};

export type RentabilidadeAccountMonth = {
  grossYield: number;
  taxWithheld: number;
  netYield: number;
};

export type RentabilidadeAccountRow = {
  accountCode: string;
  accountName: string;
  months: Record<string, RentabilidadeAccountMonth>;
};

export type RentabilidadeAccountCompany = {
  companyId: string;
  accounts: RentabilidadeAccountRow[];
};

const ACCOUNT_FIELDS = new Set(["RENDIMENTO_BRUTO", "IOF_IRRF"]);

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function normalizeCode(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

function mappingCodes(mapping: RentabilidadeAccountMapping): string[] {
  if (!Array.isArray(mapping.codes)) return [];
  return mapping.codes
    .filter((code): code is string => typeof code === "string")
    .map(normalizeCode)
    .filter(Boolean);
}

function matchesMapping(
  accountCode: string,
  mapping: RentabilidadeAccountMapping,
): boolean {
  const normalizedAccountCode = normalizeCode(accountCode);
  const codes = mappingCodes(mapping);

  if (mapping.matchType === "PREFIX") {
    return codes.some((code) => normalizedAccountCode.startsWith(code));
  }

  return codes.includes(normalizedAccountCode);
}

function mappedValue(
  entry: RentabilidadeAccountLedgerEntry,
  mapping: RentabilidadeAccountMapping,
): number {
  const value = {
    saldo_atual: entry.balance,
    debito: entry.debit,
    credito: entry.credit,
    saldo_anterior: entry.previousBalance,
  }[mapping.valueColumn];

  return mapping.aggregation === "ABS_SUM" ? Math.abs(value) : value;
}

function buildBatchAccounts(
  entries: RentabilidadeAccountLedgerEntry[],
  mappings: RentabilidadeAccountMapping[],
): Map<string, Omit<RentabilidadeAccountRow, "months"> & RentabilidadeAccountMonth> {
  const accounts = new Map<
    string,
    Omit<RentabilidadeAccountRow, "months"> & RentabilidadeAccountMonth
  >();

  for (const entry of entries) {
    for (const mapping of mappings) {
      if (!matchesMapping(entry.accountCode, mapping)) continue;

      const current = accounts.get(entry.accountCode) ?? {
        accountCode: entry.accountCode,
        accountName: entry.accountName || "Conta sem descricao",
        grossYield: 0,
        taxWithheld: 0,
        netYield: 0,
      };
      const value = mappedValue(entry, mapping);

      if (mapping.dashboardField === "RENDIMENTO_BRUTO") {
        current.grossYield = roundMoney(current.grossYield + value);
      } else if (mapping.dashboardField === "IOF_IRRF") {
        current.taxWithheld = roundMoney(current.taxWithheld + value);
      }

      if (entry.accountName) current.accountName = entry.accountName;
      current.netYield = roundMoney(current.grossYield - current.taxWithheld);
      accounts.set(entry.accountCode, current);
    }
  }

  return accounts;
}

/**
 * Builds the account-level composition used by the rentabilidade statement.
 *
 * Dashboard flow fields are overwritten whenever a newer import for the same
 * company/month is processed. The last batch in the received order therefore
 * becomes the authoritative account composition for that month, preventing a
 * Balancete + Razao pair from being counted twice.
 */
export function buildRentabilidadeAccountBreakdown(
  batches: RentabilidadeAccountBatch[],
  mappings: RentabilidadeAccountMapping[],
): RentabilidadeAccountCompany[] {
  const relevantMappings = mappings.filter((mapping) =>
    ACCOUNT_FIELDS.has(mapping.dashboardField),
  );
  const latestBatchByCompanyMonth = new Map<string, RentabilidadeAccountBatch>();

  for (const batch of batches) {
    latestBatchByCompanyMonth.set(
      `${batch.companyId}:${batch.referenceMonth}`,
      batch,
    );
  }

  const companies = new Map<string, Map<string, RentabilidadeAccountRow>>();

  for (const batch of latestBatchByCompanyMonth.values()) {
    const companyAccounts = companies.get(batch.companyId) ?? new Map<string, RentabilidadeAccountRow>();
    const batchAccounts = buildBatchAccounts(batch.entries, relevantMappings);

    for (const account of batchAccounts.values()) {
      const row = companyAccounts.get(account.accountCode) ?? {
        accountCode: account.accountCode,
        accountName: account.accountName,
        months: {},
      };
      row.accountName = account.accountName;
      row.months[batch.referenceMonth] = {
        grossYield: account.grossYield,
        taxWithheld: account.taxWithheld,
        netYield: account.netYield,
      };
      companyAccounts.set(account.accountCode, row);
    }

    companies.set(batch.companyId, companyAccounts);
  }

  return [...companies.entries()].map(([companyId, accounts]) => ({
    companyId,
    accounts: [...accounts.values()]
      .filter((account) =>
        Object.values(account.months).some(
          (month) => month.grossYield !== 0 || month.taxWithheld !== 0,
        ),
      )
      .sort((a, b) =>
        a.accountCode.localeCompare(b.accountCode, "pt-BR", {
          numeric: true,
          sensitivity: "base",
        }),
      ),
  }));
}
