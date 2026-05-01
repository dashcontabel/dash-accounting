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

  // ── Demo Razão data (sample transactions for Jan/2026) ───────────────────
  // Only seed when there is no existing RazaoEntry data for this company,
  // so running the seed twice is safe.
  const existingRazaoCount = await prisma.razaoEntry.count({
    where: { companyId: company.id },
  });

  if (existingRazaoCount === 0) {
    const demoChecksum = "seed-razao-demo-2026-01";
    const razaoBatch = await prisma.importBatch.upsert({
      where: { companyId_referenceMonth_checksum: { companyId: company.id, referenceMonth: "2026-01", checksum: demoChecksum } },
      update: {},
      create: {
        companyId: company.id,
        referenceMonth: "2026-01",
        sourceType: "RAZAO",
        status: "DONE",
        checksum: demoChecksum,
        fileName: "seed-razao-jan2026.xlsx",
        createdByUserId: adminUserId,
        totalRows: 6,
        processedRows: 6,
        totalsJson: { totalEntries: 6, totalAccounts: 2 },
      },
      select: { id: true },
    });

    // Seed two LedgerEntry rows (aggregate) so existing recalculation logic works
    await prisma.ledgerEntry.createMany({
      skipDuplicates: true,
      data: [
        {
          importBatchId: razaoBatch.id,
          companyId: company.id,
          referenceMonth: "2026-01",
          accountCode: "1.1.1.02.001",
          accountName: "BANCO DO BRASIL",
          debit: 68624.00,
          credit: 68624.00,
          balance: 0.00,
          rawJson: { saldo_anterior: 0 },
        },
        {
          importBatchId: razaoBatch.id,
          companyId: company.id,
          referenceMonth: "2026-01",
          accountCode: "1.1.1.03.002",
          accountName: "BB RENDE FACIL",
          debit: 12294.32,
          credit: 8882.47,
          balance: -2386.62,
          rawJson: { saldo_anterior: -5798.48 },
        },
      ],
    });

    // Seed individual RazaoEntry rows (transactions)
    await prisma.razaoEntry.createMany({
      data: [
        {
          importBatchId: razaoBatch.id,
          companyId: company.id,
          referenceMonth: "2026-01",
          entryDate: new Date("2026-01-04"),
          accountCode: "1.1.1.02.001",
          accountName: "BANCO DO BRASIL",
          lot: "986",
          counterpartCode: "605",
          counterpartName: "BB RENDE FACIL",
          description: "VR REF A RESGATE DE APLIC",
          debit: 7500.00,
          credit: 0,
          balance: 7500.00,
        },
        {
          importBatchId: razaoBatch.id,
          companyId: company.id,
          referenceMonth: "2026-01",
          entryDate: new Date("2026-01-04"),
          accountCode: "1.1.1.02.001",
          accountName: "BANCO DO BRASIL",
          lot: "985",
          counterpartCode: "567",
          counterpartName: "ASSES. E CONSULTORIA EM ENGEN",
          description: "VR REF A SERVICOS PRESTADOS",
          debit: 0,
          credit: 7500.00,
          balance: 0.00,
        },
        {
          importBatchId: razaoBatch.id,
          companyId: company.id,
          referenceMonth: "2026-01",
          entryDate: new Date("2026-01-08"),
          accountCode: "1.1.1.02.001",
          accountName: "BANCO DO BRASIL",
          lot: "987",
          counterpartCode: "605",
          counterpartName: "BB RENDE FACIL",
          description: "VR REF A RESGATE DE APLIC",
          debit: 5000.00,
          credit: 0,
          balance: 5000.00,
        },
        {
          importBatchId: razaoBatch.id,
          companyId: company.id,
          referenceMonth: "2026-01",
          entryDate: new Date("2026-01-21"),
          accountCode: "1.1.1.02.001",
          accountName: "BANCO DO BRASIL",
          lot: "1000",
          counterpartCode: "605",
          counterpartName: "BB RENDE FACIL",
          description: "VR REF A RESGATE DE APLIC",
          debit: 55080.00,
          credit: 0,
          balance: 55171.40,
        },
        {
          importBatchId: razaoBatch.id,
          companyId: company.id,
          referenceMonth: "2026-01",
          entryDate: new Date("2026-01-04"),
          accountCode: "1.1.1.03.002",
          accountName: "BB RENDE FACIL",
          lot: "986",
          counterpartCode: "101",
          counterpartName: "BANCO DO BRASIL",
          description: "VR REF A RESGATE DE APLIC BB",
          debit: 0,
          credit: 7500.00,
          balance: -13298.48,
        },
        {
          importBatchId: razaoBatch.id,
          companyId: company.id,
          referenceMonth: "2026-01",
          entryDate: new Date("2026-01-08"),
          accountCode: "1.1.1.03.002",
          accountName: "BB RENDE FACIL",
          lot: "987",
          counterpartCode: "101",
          counterpartName: "BANCO DO BRASIL",
          description: "VR REF A RESGATE DE APLIC BB",
          debit: 0,
          credit: 5000.00,
          balance: -18298.48,
        },
      ],
    });

    console.log(`Seeded demo Razao data (batch ${razaoBatch.id}).`);
  } else {
    console.log("Demo Razao data already present. Skipping.");
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
