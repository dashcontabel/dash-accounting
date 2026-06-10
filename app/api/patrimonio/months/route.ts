import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getUserFromRequest(request);
  if (!session?.sub) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const user = await prisma.user.findFirst({
    where: { id: session.sub, status: "ACTIVE" },
    select: { id: true, role: true },
  });
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId") ?? undefined;

  let allowedGroupIds: string[] | null = null;
  if (user.role !== "ADMIN") {
    const rows = await prisma.userCompany.findMany({
      where: { userId: user.id, company: { isActive: true, group: { isActive: true } } },
      select: { company: { select: { groupId: true } } },
    });
    allowedGroupIds = [...new Set(rows.map((r) => r.company.groupId))];
  }

  if (allowedGroupIds !== null && groupId && !allowedGroupIds.includes(groupId)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const where: Record<string, unknown> = {};
  if (groupId) {
    where.groupId = groupId;
  } else if (allowedGroupIds !== null) {
    where.groupId = { in: allowedGroupIds };
  }

  try {
    const months = await prisma.patrimonioAsset.findMany({
      where,
      select: { referenceMonth: true },
      distinct: ["referenceMonth"],
      orderBy: { referenceMonth: "desc" },
    });

    return NextResponse.json({ months: months.map((m) => m.referenceMonth) });
  } catch {
    return NextResponse.json({ error: "Nao foi possivel carregar meses." }, { status: 500 });
  }
}
