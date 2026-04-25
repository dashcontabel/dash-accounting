import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getUserFromRequest(request);
  if (!session?.sub) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  // Support multiple companyIds: ?companyId=a&companyId=b  OR  ?companyId=a
  const companyIds = request.nextUrl.searchParams.getAll("companyId").filter(Boolean);
  if (companyIds.length === 0) {
    return NextResponse.json({ error: "companyId obrigatorio." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { id: session.sub, status: "ACTIVE" },
    select: { id: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  // Single query: validate access + fetch company name + fetch summaries at once.
  // ADMIN can access any active company; CLIENT is restricted to their UserCompany links.
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
    select: {
      id: true,
      name: true,
      updatedAt: true,
      dashboardMonthlySummaries: {
        orderBy: { referenceMonth: "asc" },
        select: { referenceMonth: true, dataJson: true, updatedAt: true },
      },
    },
  });

  // Fewer results than requested means at least one companyId was not accessible.
  if (companies.length < companyIds.length) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const results = companies.map((c) => {
    const companyTs = c.updatedAt.toISOString();
    const summaryMax = c.dashboardMonthlySummaries.reduce<string | null>(
      (max, s) => {
        const iso = s.updatedAt.toISOString();
        return !max || iso > max ? iso : max;
      },
      null,
    );
    // Mirror freshness logic: max(company.updatedAt, max(summary.updatedAt))
    const lastUpdatedAt = summaryMax && summaryMax > companyTs ? summaryMax : companyTs;
    return {
      companyId: c.id,
      companyName: c.name,
      lastUpdatedAt,
      summaries: c.dashboardMonthlySummaries.map(({ referenceMonth, dataJson }) => ({
        referenceMonth,
        dataJson,
      })),
    };
  });

  return NextResponse.json(
    { companies: results },
    {
      headers: {
        // Summaries only change after an import or recalculate.
        // Cache privately in the browser for 30 s; serve stale while revalidating for up to 60 s.
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    },
  );
}
