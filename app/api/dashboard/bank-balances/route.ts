import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequest } from "@/lib/auth";
import {
  buildBankBalanceBreakdown,
  type BankBalanceMapping,
} from "@/lib/dashboard/bank-balances";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const querySchema = z.object({
  endMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

export async function GET(request: NextRequest) {
  const session = await getUserFromRequest(request);
  if (!session?.sub) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const companyIds = [
    ...new Set(request.nextUrl.searchParams.getAll("companyId").filter(Boolean)),
  ];
  const query = querySchema.safeParse({
    endMonth: request.nextUrl.searchParams.get("endMonth") ?? "",
  });
  if (companyIds.length === 0 || !query.success) {
    return NextResponse.json({ error: "Parametros invalidos." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { id: session.sub, status: "ACTIVE" },
    select: { id: true, role: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const accessFilter =
    user.role === "ADMIN"
      ? {}
      : { userCompanies: { some: { userId: user.id } } };
  const companies = await prisma.company.findMany({
    where: {
      id: { in: companyIds },
      isActive: true,
      group: { isActive: true },
      ...accessFilter,
    },
    select: { id: true, name: true },
  });
  if (companies.length < companyIds.length) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const summaries = await prisma.dashboardMonthlySummary.findMany({
    where: {
      companyId: { in: companyIds },
      referenceMonth: { lte: query.data.endMonth },
    },
    orderBy: { referenceMonth: "desc" },
    select: { companyId: true, referenceMonth: true, dataJson: true },
  });
  const lastSummaryByCompany = new Map<
    string,
    { companyId: string; referenceMonth: string; total: number }
  >();
  for (const summary of summaries) {
    if (lastSummaryByCompany.has(summary.companyId)) continue;
    const data = summary.dataJson as Record<string, unknown>;
    const bankBalance = data.SD_BANCARIO;
    if (typeof bankBalance !== "number" || !Number.isFinite(bankBalance)) continue;
    lastSummaryByCompany.set(summary.companyId, {
      companyId: summary.companyId,
      referenceMonth: summary.referenceMonth,
      total: bankBalance,
    });
  }

  const targets = companyIds.flatMap((companyId) => {
    const target = lastSummaryByCompany.get(companyId);
    return target ? [target] : [];
  });
  const targetPairs = targets.map((target) => ({
    companyId: target.companyId,
    referenceMonth: target.referenceMonth,
  }));
  const [mappings, batches] = await Promise.all([
    prisma.accountMapping.findMany({
      where: { dashboardField: "SD_BANCARIO", isCalculated: false },
      orderBy: { createdAt: "asc" },
      select: {
        dashboardField: true,
        matchType: true,
        codes: true,
        valueColumn: true,
        aggregation: true,
      },
    }),
    targetPairs.length > 0
      ? prisma.importBatch.findMany({
          where: { status: "DONE", OR: targetPairs },
          orderBy: { createdAt: "asc" },
          select: {
            companyId: true,
            referenceMonth: true,
            ledgerEntries: {
              select: {
                accountCode: true,
                accountName: true,
                debit: true,
                credit: true,
                balance: true,
                rawJson: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const breakdown = buildBankBalanceBreakdown(
    batches.map((batch) => ({
      companyId: batch.companyId,
      referenceMonth: batch.referenceMonth,
      entries: batch.ledgerEntries.map((entry) => ({
        accountCode: entry.accountCode,
        accountName: entry.accountName,
        debit: Number(entry.debit),
        credit: Number(entry.credit),
        balance: Number(entry.balance),
        previousBalance:
          typeof entry.rawJson === "object" && entry.rawJson !== null
            ? Number((entry.rawJson as Record<string, unknown>).saldo_anterior ?? 0)
            : 0,
      })),
    })),
    mappings as BankBalanceMapping[],
    targets,
  );
  const breakdownByCompany = new Map(
    breakdown.map((company) => [company.companyId, company]),
  );
  const companyById = new Map(companies.map((company) => [company.id, company]));

  return NextResponse.json(
    {
      companies: companyIds.map((companyId) => {
        const balance = breakdownByCompany.get(companyId);
        return {
          companyId,
          companyName: companyById.get(companyId)?.name ?? companyId,
          referenceMonth: balance?.referenceMonth ?? null,
          total: balance?.total ?? 0,
          accounts: balance?.accounts ?? [],
        };
      }),
    },
    {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    },
  );
}
