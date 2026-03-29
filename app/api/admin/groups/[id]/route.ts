import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin-guard";
import { prisma } from "@/lib/prisma";

const patchGroupSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  isActive: z.boolean().optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;
  const { id } = await context.params;

  try {
    const group = await prisma.group.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!group) {
      return NextResponse.json({ error: "Grupo nao encontrado." }, { status: 404 });
    }
    return NextResponse.json({ group });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel carregar grupo." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;
  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsedBody = patchGroupSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
    }

    const group = await prisma.group.update({
      where: { id },
      data: parsedBody.data,
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    return NextResponse.json({ group });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel atualizar grupo." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;
  const { id } = await context.params;

  try {
    const hasCompanies = await prisma.company.count({
      where: { groupId: id },
    });
    if (hasCompanies > 0) {
      return NextResponse.json(
        { error: "Nao e possivel remover grupo com empresas vinculadas." },
        { status: 400 },
      );
    }

    await prisma.group.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel remover grupo." },
      { status: 500 },
    );
  }
}
