import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Lightweight polling endpoint used by the DataFreshnessBadge / notification system.
 *
 * Returns the maximum `updatedAt` timestamp per company so the client can detect
 * when an admin has imported, deleted, or recalculated data for a company that
 * the current user is viewing.
 *
 * Two queries total regardless of how many companies are requested:
 *   1. Validate access + get accessible company IDs
 *   2. GROUP BY companyId → max(updatedAt)
 */
export async function GET(request: NextRequest) {
  const session = await getUserFromRequest(request);
  if (!session?.sub) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

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
    select: { id: true },
  });

  if (companies.length < companyIds.length) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const accessibleIds = companies.map((c) => c.id);

  // Fetch Company.updatedAt (bumped on any structural mutation like delete) and
  // the most recent DashboardMonthlySummary.updatedAt in a single query.
  // Returning max(company.updatedAt, latestSummary.updatedAt) means the client
  // always gets a non-null timestamp that advances on every mutation (import,
  // recalculate, delete).
  const companyRows = await prisma.company.findMany({
    where: { id: { in: accessibleIds } },
    select: {
      id: true,
      updatedAt: true,
      dashboardMonthlySummaries: {
        select: { updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
      importBatches: {
        where: { status: "DONE" },
        select: { referenceMonth: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const result = companyRows.map((c) => {
    const companyTs = c.updatedAt.toISOString();
    const summaryTs = c.dashboardMonthlySummaries[0]?.updatedAt.toISOString() ?? null;
    // Always return a timestamp — at minimum Company.updatedAt
    const updatedAt = summaryTs && summaryTs > companyTs ? summaryTs : companyTs;
    const lb = c.importBatches[0];
    return {
      companyId: c.id,
      updatedAt,
      latestBatch: lb
        ? { referenceMonth: lb.referenceMonth, createdAt: lb.createdAt.toISOString() }
        : null,
    };
  });

  return NextResponse.json(
    { companies: result },
    // private → never cached on Vercel edge/CDN (response is user-scoped).
    // max-age=20 → browser reuses the same response for up to 20 s, cutting
    //   duplicate fetches on re-mounts (tab switches, React StrictMode, etc.).
    // stale-while-revalidate=10 → for the next 10 s the browser serves the
    //   stale copy immediately while refreshing in the background — avoids a
    //   visible loading gap without delaying staleness detection meaningfully.
    { headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=10" } },
  );
}
