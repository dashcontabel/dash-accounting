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
 *   costCenter       – optional, exact match; use "__null__" to filter entries with no CC
 *   page             – optional, 1-based, default 1
 */
export async function GET(request: NextRequest) {
  const user = await getActiveUserFromSession(request);
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const parsed = querySchema.safeParse({
    companyId: request.nextUrl.searchParams.get("companyId") ?? "",
    referenceMonth: request.nextUrl.searchParams.get("referenceMonth") ?? "",
    accountCode: request.nextUrl.searchParams.get("accountCode") ?? undefined,
    costCenter: request.nextUrl.searchParams.get("costCenter") ?? undefined,
    page: request.nextUrl.searchParams.get("page") ?? 1,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Parametros invalidos." }, { status: 400 });
  }

  const { companyId, referenceMonth, accountCode, costCenter, page } = parsed.data;

  try {
    await assertCompanyAccess(user, companyId);
  } catch {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  // Build the account-code filter to match the same logic as the mapping engine:
  // prefix "3.2.1" matches "3.2.1.0.1" AND "3.2.10.800.3" (plain startsWith, no trailing dot).
  const accountFilter = accountCode
    ? { accountCode: { startsWith: accountCode } }
    : {};

  // "__null__" is the sentinel value used by the CC UI for entries with no cost center
  const costCenterFilter = costCenter
    ? { costCenter: costCenter === "__null__" ? null : costCenter }
    : {};

  const [entries, total] = await Promise.all([
    prisma.razaoEntry.findMany({
      where: { companyId, referenceMonth, ...accountFilter, ...costCenterFilter },
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
      where: { companyId, referenceMonth, ...accountFilter, ...costCenterFilter },
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
