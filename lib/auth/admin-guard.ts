import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import { getUserFromRequest } from "./request";

export type AdminUser = {
  id: string;
  email: string;
  role: "ADMIN";
};

export async function requireAdmin(request: NextRequest): Promise<{
  admin: AdminUser | null;
  errorResponse: NextResponse | null;
}> {
  const session = await getUserFromRequest(request);
  if (!session?.sub) {
    return {
      admin: null,
      errorResponse: NextResponse.json({ error: "Nao autenticado." }, { status: 401 }),
    };
  }

  const user = await prisma.user.findFirst({
    where: {
      id: session.sub,
      status: "ACTIVE",
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  if (!user) {
    return {
      admin: null,
      errorResponse: NextResponse.json({ error: "Nao autenticado." }, { status: 401 }),
    };
  }

  if (user.role !== "ADMIN") {
    return {
      admin: null,
      errorResponse: NextResponse.json({ error: "Acesso negado." }, { status: 403 }),
    };
  }

  return {
    admin: {
      id: user.id,
      email: user.email,
      role: "ADMIN",
    },
    errorResponse: null,
  };
}
