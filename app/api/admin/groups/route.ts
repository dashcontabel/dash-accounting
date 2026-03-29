import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin-guard";
import { prisma } from "@/lib/prisma";

const createGroupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  isActive: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  const { errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  try {
    const groups = await prisma.group.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { companies: true },
        },
      },
    });

    return NextResponse.json({ groups });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel listar grupos." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const { errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const parsedBody = createGroupSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
    }

    const group = await prisma.group.create({
      data: parsedBody.data,
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    return NextResponse.json({ group }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel criar grupo." },
      { status: 500 },
    );
  }
}
