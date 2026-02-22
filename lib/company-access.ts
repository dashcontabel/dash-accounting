import { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type AuthUser = {
  id: string;
  role: Role;
};

export async function getAllowedCompanyIds(user: AuthUser) {
  if (user.role === "ADMIN") {
    const companies = await prisma.company.findMany({
      where: {
        isActive: true,
        group: { isActive: true },
      },
      select: { id: true },
    });

    return companies.map((company) => company.id);
  }

  const userCompanies = await prisma.userCompany.findMany({
    where: {
      userId: user.id,
      company: {
        isActive: true,
        group: { isActive: true },
      },
    },
    select: { companyId: true },
  });

  return userCompanies.map((item) => item.companyId);
}

export async function assertCompanyAccess(user: AuthUser, companyId: string) {
  const allowedCompanyIds = await getAllowedCompanyIds(user);
  if (!allowedCompanyIds.includes(companyId)) {
    throw new Error("COMPANY_ACCESS_DENIED");
  }
}
