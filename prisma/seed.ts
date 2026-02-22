import bcrypt from "bcryptjs";
import { PrismaClient, Role, UserStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must be set before seeding.",
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  let adminUserId = existingUser?.id;

  if (!adminUserId) {
    const passwordHash = await bcrypt.hash(password, 12);
    const adminUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
      select: { id: true },
    });

    adminUserId = adminUser.id;
    console.log(`Admin created with email ${email}.`);
  } else {
    console.log(`Admin with email ${email} already exists. Skipping creation.`);
  }

  const group = await prisma.group.upsert({
    where: { name: "Grupo Principal" },
    update: { isActive: true },
    create: {
      name: "Grupo Principal",
      isActive: true,
    },
    select: { id: true },
  });

  const company = await prisma.company.upsert({
    where: { document: "00000000000100" },
    update: { isActive: true, name: "Empresa Principal", groupId: group.id },
    create: {
      name: "Empresa Principal",
      document: "00000000000100",
      isActive: true,
      groupId: group.id,
    },
    select: { id: true },
  });

  await prisma.userCompany.upsert({
    where: {
      userId_companyId: {
        userId: adminUserId,
        companyId: company.id,
      },
    },
    update: {},
    create: {
      userId: adminUserId,
      companyId: company.id,
    },
  });

  console.log("Seeded default group, company, and admin company access.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
