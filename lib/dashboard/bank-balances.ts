export type BankBalanceMapping = {
  dashboardField: string;
  matchType: "EXACT" | "PREFIX" | "LIST";
  codes: unknown;
  valueColumn: "saldo_atual" | "debito" | "credito" | "saldo_anterior";
  aggregation: "SUM" | "ABS_SUM";
};

export type BankBalanceLedgerEntry = {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  balance: number;
  previousBalance: number;
};

export type BankBalanceBatch = {
  companyId: string;
  referenceMonth: string;
  entries: BankBalanceLedgerEntry[];
};

export type BankBalanceTarget = {
  companyId: string;
  referenceMonth: string;
  total: number;
};

export type BankBalanceAccount = {
  accountCode: string;
  accountName: string;
  balance: number;
};

export type BankBalanceCompany = BankBalanceTarget & {
  accounts: BankBalanceAccount[];
};

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function normalizeCode(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

function mappingCodes(mapping: BankBalanceMapping): string[] {
  if (!Array.isArray(mapping.codes)) return [];
  return mapping.codes
    .filter((code): code is string => typeof code === "string")
    .map(normalizeCode)
    .filter(Boolean);
}

function matchesMapping(accountCode: string, mapping: BankBalanceMapping): boolean {
  const normalizedAccountCode = normalizeCode(accountCode);
  const codes = mappingCodes(mapping);

  if (mapping.matchType === "PREFIX") {
    return codes.some((code) => normalizedAccountCode.startsWith(code));
  }

  return codes.includes(normalizedAccountCode);
}

function mappedValue(entry: BankBalanceLedgerEntry, mapping: BankBalanceMapping): number {
  const value = {
    saldo_atual: entry.balance,
    debito: entry.debit,
    credito: entry.credit,
    saldo_anterior: entry.previousBalance,
  }[mapping.valueColumn];

  return mapping.aggregation === "ABS_SUM" ? Math.abs(value) : value;
}

function accountsFromBatch(
  batch: BankBalanceBatch,
  mappings: BankBalanceMapping[],
): BankBalanceAccount[] {
  const accounts = new Map<string, BankBalanceAccount>();

  for (const entry of batch.entries) {
    for (const mapping of mappings) {
      if (mapping.dashboardField !== "SD_BANCARIO" || !matchesMapping(entry.accountCode, mapping)) {
        continue;
      }

      const current = accounts.get(entry.accountCode) ?? {
        accountCode: entry.accountCode,
        accountName: entry.accountName || "Conta sem descricao",
        balance: 0,
      };
      current.balance = roundMoney(current.balance + mappedValue(entry, mapping));
      if (entry.accountName) current.accountName = entry.accountName;
      accounts.set(entry.accountCode, current);
    }
  }

  return [...accounts.values()]
    .filter((account) => Math.abs(account.balance) >= 0.005)
    .sort((a, b) =>
      a.accountCode.localeCompare(b.accountCode, "pt-BR", {
        numeric: true,
        sensitivity: "base",
      }),
    );
}

/**
 * Returns the bank balance composition for each company's last accounted month.
 *
 * There may be more than one import for the same month (for example Balancete
 * and Razao). The candidate whose account sum is closest to the authoritative
 * monthly summary is selected; ties prefer the newest batch in the received
 * order. This keeps the account cards aligned with the dashboard total without
 * adding two representations of the same accounting period.
 */
export function buildBankBalanceBreakdown(
  batches: BankBalanceBatch[],
  mappings: BankBalanceMapping[],
  targets: BankBalanceTarget[],
): BankBalanceCompany[] {
  return targets.map((target) => {
    let bestAccounts: BankBalanceAccount[] = [];
    let bestDifference = Number.POSITIVE_INFINITY;

    for (const batch of batches) {
      if (
        batch.companyId !== target.companyId ||
        batch.referenceMonth !== target.referenceMonth
      ) {
        continue;
      }

      const accounts = accountsFromBatch(batch, mappings);
      if (accounts.length === 0) continue;

      const accountTotal = roundMoney(
        accounts.reduce((sum, account) => sum + account.balance, 0),
      );
      const difference = Math.abs(accountTotal - target.total);
      if (difference <= bestDifference) {
        bestAccounts = accounts;
        bestDifference = difference;
      }
    }

    return { ...target, accounts: bestAccounts };
  });
}
