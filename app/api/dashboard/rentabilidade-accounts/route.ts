import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequest } from "@/lib/auth";
import {
  buildRentabilidadeAccountBreakdown,
  type RentabilidadeAccountMapping,
} from "@/lib/dashboard/rentabilidade-accounts";
import { normalizeMonthRange } from "@/lib/dashboard/rentabilidade";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const querySchema = z.object({
  year: z.string().regex(/^\d{4}$/),
  from: z.string().regex(/^(0[1-9]|1[0-2])$/),
  to: z.string().regex(/^(0[1-9]|1[0-2])$/),
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
    year: request.nextUrl.searchParams.get("year") ?? "",
    from: request.nextUrl.searchParams.get("from") ?? "",
    to: request.nextUrl.searchParams.get("to") ?? "",
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

  const [from, to] = normalizeMonthRange(query.data.from, query.data.to);
  const mappings = await prisma.accountMapping.findMany({
    where: {
      dashboardField: { in: ["RENDIMENTO_BRUTO", "IOF_IRRF"] },
      isCalculated: false,
    },
    orderBy: { createdAt: "asc" },
    select: {
      dashboardField: true,
      matchType: true,
      codes: true,
      valueColumn: true,
      aggregation: true,
    },
  });
  const batches = await prisma.importBatch.findMany({
    where: {
      companyId: { in: companyIds },
      referenceMonth: {
        gte: `${query.data.year}-${from}`,
        lte: `${query.data.year}-${to}`,
      },
      status: "DONE",
    },
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
  });

  const breakdown = buildRentabilidadeAccountBreakdown(
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
    mappings as RentabilidadeAccountMapping[],
  );
  const breakdownByCompany = new Map(
    breakdown.map((company) => [company.companyId, company.accounts]),
  );
  const companyById = new Map(companies.map((company) => [company.id, company]));

  return NextResponse.json(
    {
      companies: companyIds.map((companyId) => ({
        companyId,
        companyName: companyById.get(companyId)?.name ?? companyId,
        accounts: breakdownByCompany.get(companyId) ?? [],
      })),
    },
    {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    },
  );
}
