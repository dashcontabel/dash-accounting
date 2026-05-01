import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/dashboard/field-codes
 *
 * Returns a map of dashboardField → codes[] for all non-calculated mappings.
 * Used by the dashboard to resolve dynamic account codes for card drill-down.
 * Accessible to any authenticated user (read-only, non-sensitive).
 */
export async function GET(request: NextRequest) {
  const session = await getUserFromRequest(request);
  if (!session?.sub) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const user = await prisma.user.findFirst({
    where: { id: session.sub, status: "ACTIVE" },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const mappings = await prisma.accountMapping.findMany({
    where: { isCalculated: false },
    select: { dashboardField: true, codes: true },
  });

  const fieldCodes: Record<string, string[]> = {};
  for (const m of mappings) {
    fieldCodes[m.dashboardField] = m.codes as string[];
  }

  return NextResponse.json({ fieldCodes });
}
