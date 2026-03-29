import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin-guard";
import { prisma } from "@/lib/prisma";

const patchUserSchema = z.object({
  name: z.string().trim().min(1).max(120).optional().nullable(),
  email: z.string().trim().toLowerCase().email().optional(),
  password: z.string().min(8).max(128).optional(),
  role: z.enum(["ADMIN", "CLIENT"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  companyIds: z.array(z.string().min(1)).optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const { id } = await context.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        userCompanies: {
          select: {
            company: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        ...user,
        companyIds: user.userCompanies.map((item) => item.company.id),
        companies: user.userCompanies.map((item) => item.company),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel carregar usuario." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { admin, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;
  if (!admin) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsedBody = patchUserSchema.safeParse(body);
    if (!parsedBody.success) {
      const fieldErrors = parsedBody.error.flatten().fieldErrors;
      if (fieldErrors.password) {
        return NextResponse.json({ error: "A senha deve ter entre 8 e 128 caracteres." }, { status: 400 });
      }
      return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!existingUser) {
      return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 });
    }

    if (parsedBody.data.email) {
      const sameEmailUser = await prisma.user.findFirst({
        where: {
          email: parsedBody.data.email,
          NOT: { id },
        },
        select: { id: true },
      });
      if (sameEmailUser) {
        return NextResponse.json(
          { error: "Email ja cadastrado." },
          { status: 409 },
        );
      }
    }

    if (parsedBody.data.companyIds) {
      const uniqueCompanyIds = [...new Set(parsedBody.data.companyIds)];
      const companiesCount = await prisma.company.count({
        where: {
          id: { in: uniqueCompanyIds },
          isActive: true,
          group: { isActive: true },
        },
      });
      if (companiesCount !== uniqueCompanyIds.length) {
        return NextResponse.json(
          { error: "Uma ou mais empresas sao invalidas." },
          { status: 400 },
        );
      }
    }

    const roleAfterUpdate = parsedBody.data.role ?? existingUser.role;
    if (admin.id === id && roleAfterUpdate !== "ADMIN") {
      return NextResponse.json(
        { error: "Nao e permitido remover seu proprio perfil ADMIN." },
        { status: 400 },
      );
    }

    const user = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: {
          name: parsedBody.data.name,
          email: parsedBody.data.email,
          role: parsedBody.data.role,
          status: parsedBody.data.status,
          passwordHash: parsedBody.data.password
            ? await bcrypt.hash(parsedBody.data.password, 12)
            : undefined,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
        },
      });

      if (parsedBody.data.companyIds) {
        const uniqueCompanyIds = [...new Set(parsedBody.data.companyIds)];

        await tx.userCompany.deleteMany({
          where: { userId: id },
        });

        if (updatedUser.role === "CLIENT" && uniqueCompanyIds.length > 0) {
          await tx.userCompany.createMany({
            data: uniqueCompanyIds.map((companyId) => ({
              userId: id,
              companyId,
            })),
            skipDuplicates: true,
          });
        }
      } else if (parsedBody.data.role === "ADMIN") {
        await tx.userCompany.deleteMany({
          where: { userId: id },
        });
      }

      return updatedUser;
    });

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel atualizar usuario." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { admin, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;
  if (!admin) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  if (admin.id === id) {
    return NextResponse.json(
      { error: "Nao e permitido remover seu proprio usuario." },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 });
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel remover usuario." },
      { status: 500 },
    );
  }
}
