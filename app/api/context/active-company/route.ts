import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequest } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/company-access";
import { ACTIVE_COMPANY_COOKIE_NAME } from "@/lib/company-context";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  companyId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);
    if (!session?.sub) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const parsedBody = bodySchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        id: session.sub,
        status: "ACTIVE",
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    try {
      await assertCompanyAccess(user, parsedBody.data.companyId);
    } catch {
      return NextResponse.json(
        { error: "Empresa nao permitida." },
        { status: 403 },
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: ACTIVE_COMPANY_COOKIE_NAME,
      value: parsedBody.data.companyId,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel atualizar o contexto." },
      { status: 500 },
    );
  }
}
