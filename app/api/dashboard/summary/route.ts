import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/company-access";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getUserFromRequest(request);
  if (!session?.sub) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId obrigatorio." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { id: session.sub, status: "ACTIVE" },
    select: { id: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  try {
    await assertCompanyAccess(user, companyId);
  } catch {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const summaries = await prisma.dashboardMonthlySummary.findMany({
    where: { companyId },
    orderBy: { referenceMonth: "asc" },
    select: { referenceMonth: true, dataJson: true },
  });

  return NextResponse.json({ summaries });
}
