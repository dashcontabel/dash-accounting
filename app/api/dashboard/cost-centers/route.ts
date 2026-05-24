import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequest } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/company-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const querySchema = z.object({
  companyId: z.string().min(1),
  referenceMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

async function getActiveUserFromSession(request: NextRequest) {
  const session = await getUserFromRequest(request);
  if (!session?.sub) return null;
  return prisma.user.findFirst({
    where: { id: session.sub, status: "ACTIVE" },
    select: { id: true, role: true },
  });
}

export type CostCenterSummaryItem = {
  costCenter: string | null;
  totalDebit: number;
  totalCredit: number;
  /** Unique account codes that had movement in this cost center */
  accountCount: number;
};

export type CostCenterSummaryResponse = {
  hasCostCenters: boolean;
  referenceMonth: string;
  companyId: string;
  items: CostCenterSummaryItem[];
};

/**
 * Builds a Prisma OR filter that restricts entries to account codes covered by
 * at least one AccountMapping rule (non-calculated rules only).
 * This ensures the CC totals reconcile with the KPI card totals.
 */
type AccountCodeOrFilter = { accountCode: { startsWith: string } | { equals: string } };

function buildMappedAccountFilter(
  mappings: { matchType: string; codes: unknown }[]
): { OR: AccountCodeOrFilter[] } | Record<string, never> {
  const orFilters: AccountCodeOrFilter[] = [];

  for (const m of mappings) {
    const codes = Array.isArray(m.codes) ? (m.codes as string[]) : [];
    for (const raw of codes) {
      const c = raw.replace(/\s+/g, "").trim();
      if (!c) continue;
      if (m.matchType === "PREFIX") {
        orFilters.push({ accountCode: { startsWith: c } });
      } else {
        // EXACT or LIST
        orFilters.push({ accountCode: { equals: c } });
      }
    }
  }

  return orFilters.length > 0 ? { OR: orFilters } : {};
}

/**
 * GET /api/dashboard/cost-centers
 *
 * Returns debits and credits grouped by costCenter for a company + month.
 * Only returns data when the imported Razão file contained Centro de Custo sections.
 * Aggregation is restricted to account codes that match at least one AccountMapping rule,
 * so the CC totals reconcile with the KPI card totals.
 *
 * Query params:
 *   companyId       – required
 *   referenceMonth  – required, "YYYY-MM"
 */
export async function GET(request: NextRequest) {
  const user = await getActiveUserFromSession(request);
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const parsed = querySchema.safeParse({
    companyId: request.nextUrl.searchParams.get("companyId") ?? "",
    referenceMonth: request.nextUrl.searchParams.get("referenceMonth") ?? "",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Parametros invalidos." }, { status: 400 });
  }

  const { companyId, referenceMonth } = parsed.data;

  try {
    await assertCompanyAccess(user, companyId);

    // Load non-calculated mapping rules that measure P&L flow (valueColumn = debito | credito).
    // Balance-sheet mappings use saldo_atual/saldo_anterior (they measure a closing balance, not
    // the transaction flow) and must be excluded so CC totals reconcile with the KPI cards.
    const mappingRules = await prisma.accountMapping.findMany({
      where: { isCalculated: false, valueColumn: { in: ["debito", "credito"] } },
      select: { matchType: true, codes: true },
    });
    const mappedAccountFilter = buildMappedAccountFilter(mappingRules);

    // Check if any P&L entries have a costCenter value
    const anyWithCC = await prisma.razaoEntry.findFirst({
      where: { companyId, referenceMonth, costCenter: { not: null }, ...mappedAccountFilter },
      select: { id: true },
    });

    if (!anyWithCC) {
      return NextResponse.json<CostCenterSummaryResponse>({
        hasCostCenters: false,
        referenceMonth,
        companyId,
        items: [],
      });
    }

    // Aggregate debit/credit per cost center using groupBy
    const grouped = await prisma.razaoEntry.groupBy({
      by: ["costCenter"],
      where: { companyId, referenceMonth, ...mappedAccountFilter },
      _sum: { debit: true, credit: true },
      _count: { accountCode: true },
    });

    // Count distinct accounts per cost center (groupBy gives count of rows, not distinct)
    // We do a second query only when we need granular account counts.
    const accountsByCc = await prisma.razaoEntry.findMany({
      where: { companyId, referenceMonth, ...mappedAccountFilter },
      select: { costCenter: true, accountCode: true },
      distinct: ["costCenter", "accountCode"],
    });

    const accountCountMap: Record<string, number> = {};
    for (const row of accountsByCc) {
      const key = row.costCenter ?? "__null__";
      accountCountMap[key] = (accountCountMap[key] ?? 0) + 1;
    }

    const items: CostCenterSummaryItem[] = grouped.map((g) => {
      const key = g.costCenter ?? "__null__";
      return {
        costCenter: g.costCenter,
        totalDebit: Number(g._sum.debit ?? 0),
        totalCredit: Number(g._sum.credit ?? 0),
        accountCount: accountCountMap[key] ?? 0,
      };
    });

    // Sort: named cost centers first (alphabetically), then null last
    items.sort((a, b) => {
      if (a.costCenter === null) return 1;
      if (b.costCenter === null) return -1;
      return a.costCenter.localeCompare(b.costCenter, "pt-BR");
    });

    return NextResponse.json<CostCenterSummaryResponse>({
      hasCostCenters: true,
      referenceMonth,
      companyId,
      items,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Forbidden") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    console.error("[cost-centers] erro:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
