import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/company-access";
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

  // Validate access to all requested companies
  for (const companyId of companyIds) {
    try {
      await assertCompanyAccess(user, companyId);
    } catch {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
  }

  // Fetch summaries for all companies in parallel
  const results = await Promise.all(
    companyIds.map(async (companyId) => {
      const summaries = await prisma.dashboardMonthlySummary.findMany({
        where: { companyId },
        orderBy: { referenceMonth: "asc" },
        select: { referenceMonth: true, dataJson: true },
      });
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true },
      });
      return {
        companyId,
        companyName: company?.name ?? companyId,
        summaries,
      };
    }),
  );

  return NextResponse.json({ companies: results });
}
