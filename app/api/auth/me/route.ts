import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import { ACTIVE_COMPANY_COOKIE_NAME } from "@/lib/company-context";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromRequest(request);

    if (!session?.sub) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    const user = await prisma.user.findFirst({
      where: {
        id: session.sub,
        status: "ACTIVE",
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    const allowedCompanies =
      user.role === "ADMIN"
        ? await prisma.company.findMany({
            where: {
              isActive: true,
              group: { isActive: true },
            },
            select: {
              id: true,
              name: true,
              groupId: true,
            },
            orderBy: { name: "asc" },
          })
        : (
            await prisma.userCompany.findMany({
              where: {
                userId: user.id,
                company: {
                  isActive: true,
                  group: { isActive: true },
                },
              },
              select: {
                company: {
                  select: {
                    id: true,
                    name: true,
                    groupId: true,
                  },
                },
              },
              orderBy: { company: { name: "asc" } },
            })
          ).map((item) => item.company);

    const cookieCompanyId =
      request.cookies.get(ACTIVE_COMPANY_COOKIE_NAME)?.value ?? null;
    const hasAccessToCookieCompany =
      cookieCompanyId !== null &&
      allowedCompanies.some((company) => company.id === cookieCompanyId);

    const activeCompanyId = hasAccessToCookieCompany
      ? cookieCompanyId
      : allowedCompanies.length === 1
        ? allowedCompanies[0].id
        : null;

    return NextResponse.json({
      user,
      allowedCompanies,
      activeCompanyId,
    });
  } catch {
    return NextResponse.json(
      { error: "Nao foi possivel carregar a sessao." },
      { status: 500 },
    );
  }
}
