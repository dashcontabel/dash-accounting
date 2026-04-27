import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin-guard";
import { prisma } from "@/lib/prisma";

// Only this email can access audit logs
const OWNER_EMAIL = "owner@dashcontabil.com";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  action: z.string().optional(),
  userId: z.string().optional(),
  companyId: z.string().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

export async function GET(request: NextRequest) {
  const { admin, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  if (admin!.email !== OWNER_EMAIL) {
    return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const { page, limit, action, userId, companyId, from, to } = parsed.data;
  const skip = (page - 1) * limit;

  const where = {
    ...(action ? { action: action as never } : {}),
    ...(userId ? { userId } : {}),
    ...(companyId ? { companyId } : {}),
    ...((from ?? to)
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        companyId: true,
        metadata: true,
        createdAt: true,
        user: {
          select: { id: true, email: true, name: true, role: true },
        },
      },
    }),
  ]);

  return NextResponse.json({
    logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}
