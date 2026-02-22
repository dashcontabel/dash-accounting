import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin-guard";
import { prisma } from "@/lib/prisma";

const createCompanySchema = z.object({
  name: z.string().trim().min(2).max(120),
  document: z.string().trim().min(8).max(32).optional().nullable(),
  isActive: z.boolean().default(true),
  groupId: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const { errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  try {
    const companies = await prisma.company.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        document: true,
        isActive: true,
        groupId: true,
        createdAt: true,
        updatedAt: true,
        group: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    return NextResponse.json({ companies });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel listar empresas." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const { errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const parsedBody = createCompanySchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
    }

    const group = await prisma.group.findUnique({
      where: { id: parsedBody.data.groupId },
      select: { id: true },
    });
    if (!group) {
      return NextResponse.json({ error: "Grupo invalido." }, { status: 400 });
    }

    const company = await prisma.company.create({
      data: {
        name: parsedBody.data.name,
        document: parsedBody.data.document || null,
        isActive: parsedBody.data.isActive,
        groupId: parsedBody.data.groupId,
      },
      select: {
        id: true,
        name: true,
        document: true,
        isActive: true,
        groupId: true,
      },
    });

    return NextResponse.json({ company }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel criar empresa." },
      { status: 500 },
    );
  }
}
