import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/admin-guard";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { admin, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;
  if (!admin) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const mappings = await prisma.accountMapping.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      dashboardField: true,
      matchType: true,
      codes: true,
      valueColumn: true,
      aggregation: true,
      isCalculated: true,
      formula: true,
    },
  });

  return NextResponse.json({ mappings });
}
