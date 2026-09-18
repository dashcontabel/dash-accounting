import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequest } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/company-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const PAGE_SIZE = 100;

const querySchema = z.object({
  companyId: z.string().min(1),
  referenceMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  accountCode: z.string().optional(),
  excludeDashboardFields: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  costCenter: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
});

async function getActiveUserFromSession(request: NextRequest) {
  const session = await getUserFromRequest(request);
  if (!session?.sub) return null;
  return prisma.user.findFirst({
    where: { id: session.sub, status: "ACTIVE" },
    select: { id: true, role: true },
  });
}

type MappingAccountFilter = {
  accountCode: { startsWith: string } | { equals: string };
};

function buildMappingAccountFilters(
  mappings: Array<{ matchType: string; codes: unknown }>,
): MappingAccountFilter[] {
  return mappings.flatMap((mapping) => {
    if (!Array.isArray(mapping.codes)) return [];

    return mapping.codes
      .filter((code): code is string => typeof code === "string" && Boolean(code.trim()))
      .map((code) => ({
        accountCode: mapping.matchType === "PREFIX"
          ? { startsWith: code.replace(/\s+/g, "").trim() }
          : { equals: code.replace(/\s+/g, "").trim() },
      }));
  });
}

/**
 * GET /api/dashboard/transactions
 *
 * Returns individual Razão entries for a company + month, optionally filtered
 * by account code (for card drill-down modals) and/or cost center.
 *
 * Query params:
 *   companyId        – required
 *   referenceMonth   – required, "YYYY-MM"
 *   accountCode      – optional, filters to a single account (or its children via PREFIX logic)
 *   excludeDashboardField – optional/repeatable, excludes accounts mapped to these fields
 *   costCenter       – optional, exact match; use "__null__" to filter entries with no CC
 *   page             – optional, 1-based, default 1
 */
export async function GET(request: NextRequest) {
  const user = await getActiveUserFromSession(request);
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  // accountCode may be sent as a single param or repeated (multi-code OR filter)
  const rawAccountCodes = request.nextUrl.searchParams.getAll("accountCode").filter(Boolean);
  const rawExcludeDashboardFields = [
    ...new Set(request.nextUrl.searchParams.getAll("excludeDashboardField").filter(Boolean)),
  ];

  const parsed = querySchema.safeParse({
    companyId: request.nextUrl.searchParams.get("companyId") ?? "",
    referenceMonth: request.nextUrl.searchParams.get("referenceMonth") ?? "",
    accountCode: rawAccountCodes[0] ?? undefined,
    excludeDashboardFields: rawExcludeDashboardFields,
    costCenter: request.nextUrl.searchParams.get("costCenter") ?? undefined,
    page: request.nextUrl.searchParams.get("page") ?? 1,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Parametros invalidos." }, { status: 400 });
  }

  const { companyId, referenceMonth, excludeDashboardFields, costCenter, page } = parsed.data;

  try {
    await assertCompanyAccess(user, companyId);
  } catch {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  // Build the account-code filter. When multiple codes are provided (e.g. DISTRIB_LUCROS
  // uses a LIST mapping with several codes) combine them with OR + startsWith so that the
  // same prefix-match logic used by the mapping engine applies to each code.
  const accountFilter =
    rawAccountCodes.length === 0
      ? {}
      : rawAccountCodes.length === 1
        ? { accountCode: { startsWith: rawAccountCodes[0]! } }
        : { OR: rawAccountCodes.map((c) => ({ accountCode: { startsWith: c } })) };

  const exclusionMappings = excludeDashboardFields.length > 0
    ? await prisma.accountMapping.findMany({
        where: {
          dashboardField: { in: excludeDashboardFields },
          isCalculated: false,
        },
        select: { matchType: true, codes: true },
      })
    : [];
  const excludedAccounts = buildMappingAccountFilters(exclusionMappings);
  const exclusionFilter = excludedAccounts.length > 0
    ? { NOT: { OR: excludedAccounts } }
    : {};

  // "__null__" is the sentinel value used by the CC UI for entries with no cost center
  const costCenterFilter = costCenter
    ? { costCenter: costCenter === "__null__" ? null : costCenter }
    : {};
  const where = {
    companyId,
    referenceMonth,
    ...accountFilter,
    ...exclusionFilter,
    ...costCenterFilter,
  };

  const [entries, total] = await Promise.all([
    prisma.razaoEntry.findMany({
      where,
      orderBy: [{ entryDate: "asc" }, { accountCode: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        entryDate: true,
        referenceMonth: true,
        accountCode: true,
        accountName: true,
        lot: true,
        counterpartCode: true,
        counterpartName: true,
        description: true,
        debit: true,
        credit: true,
        balance: true,
      },
    }),
    prisma.razaoEntry.count({
      where,
    }),
  ]);

  return NextResponse.json({
    entries: entries.map((e) => ({
      ...e,
      debit: Number(e.debit),
      credit: Number(e.credit),
      balance: Number(e.balance),
    })),
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    },
  });
}
