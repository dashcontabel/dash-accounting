import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin-guard";
import { prisma } from "@/lib/prisma";

const patchCompanySchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  document: z.string().trim().min(8).max(32).optional().nullable(),
  isActive: z.boolean().optional(),
  groupId: z.string().min(1).optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;
  const { id } = await context.params;

  try {
    const company = await prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        document: true,
        isActive: true,
        groupId: true,
        group: {
          select: { id: true, name: true, isActive: true },
        },
      },
    });

    if (!company) {
      return NextResponse.json({ error: "Empresa nao encontrada." }, { status: 404 });
    }

    return NextResponse.json({ company });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel carregar empresa." },
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
    const parsedBody = patchCompanySchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
    }

    if (parsedBody.data.groupId) {
      const group = await prisma.group.findUnique({
        where: { id: parsedBody.data.groupId },
        select: { id: true },
      });
      if (!group) {
        return NextResponse.json({ error: "Grupo invalido." }, { status: 400 });
      }
    }

    const company = await prisma.company.update({
      where: { id },
      data: {
        name: parsedBody.data.name,
        document: parsedBody.data.document,
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

    return NextResponse.json({ company });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel atualizar empresa." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;
  const { id } = await context.params;

  try {
    await prisma.company.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel remover empresa." },
      { status: 500 },
    );
  }
}
