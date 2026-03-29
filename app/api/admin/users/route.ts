import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin-guard";
import { prisma } from "@/lib/prisma";

const createUserSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
  role: z.enum(["ADMIN", "CLIENT"]).default("CLIENT"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  companyIds: z.array(z.string().min(1)).default([]),
});

export async function GET(request: NextRequest) {
  const { errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
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

    return NextResponse.json({
      users: users.map((user) => ({
        ...user,
        companyIds: user.userCompanies.map((item) => item.company.id),
        companies: user.userCompanies.map((item) => item.company),
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel listar usuarios." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const { errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const parsedBody = createUserSchema.safeParse(body);
    if (!parsedBody.success) {
      const fieldErrors = parsedBody.error.flatten().fieldErrors;
      if (fieldErrors.password) {
        return NextResponse.json({ error: "A senha deve ter entre 8 e 128 caracteres." }, { status: 400 });
      }
      return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { email: parsedBody.data.email },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Email ja cadastrado." },
        { status: 409 },
      );
    }

    if (parsedBody.data.companyIds.length > 0) {
      const companiesCount = await prisma.company.count({
        where: {
          id: { in: parsedBody.data.companyIds },
          isActive: true,
          group: { isActive: true },
        },
      });

      if (companiesCount !== parsedBody.data.companyIds.length) {
        return NextResponse.json(
          { error: "Uma ou mais empresas sao invalidas." },
          { status: 400 },
        );
      }
    }

    const passwordHash = await bcrypt.hash(parsedBody.data.password, 12);
    const user = await prisma.user.create({
      data: {
        name: parsedBody.data.name,
        email: parsedBody.data.email,
        passwordHash,
        role: parsedBody.data.role,
        status: parsedBody.data.status,
        userCompanies:
          parsedBody.data.role === "CLIENT" && parsedBody.data.companyIds.length > 0
            ? {
                createMany: {
                  data: parsedBody.data.companyIds.map((companyId) => ({
                    companyId,
                  })),
                  skipDuplicates: true,
                },
              }
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

    return NextResponse.json({ user }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel criar usuario." },
      { status: 500 },
    );
  }
}
