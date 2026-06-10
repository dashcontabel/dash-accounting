import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/groups
 * Returns groups accessible to the authenticated user.
 * ADMIN → all active groups.
 * CLIENT → groups that contain at least one company the user belongs to.
 */
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

  try {
    if (user.role === "ADMIN") {
      const groups = await prisma.group.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, isActive: true },
      });
      return NextResponse.json({ groups });
    }

    // CLIENT: only groups with at least one accessible company
    const userCompanies = await prisma.userCompany.findMany({
      where: {
        userId: user.id,
        company: { isActive: true, group: { isActive: true } },
      },
      select: { company: { select: { groupId: true, group: { select: { id: true, name: true, isActive: true } } } } },
    });

    const seen = new Set<string>();
    const groups = userCompanies
      .map((uc) => uc.company.group)
      .filter((g) => {
        if (seen.has(g.id)) return false;
        seen.add(g.id);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ groups });
  } catch {
    return NextResponse.json({ error: "Nao foi possivel carregar grupos." }, { status: 500 });
  }
}
