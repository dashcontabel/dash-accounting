import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin-guard";
import { getUserFromRequest } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";
import { writeAuditLog, AuditAction } from "@/lib/audit";

const createSchema = z.object({
  groupId: z.string().min(1),
  referenceMonth: z.string().regex(/^\d{4}-\d{2}$/),
  label: z.string().min(1).max(200),
  sublabel: z.string().max(200).nullable().optional(),
  rowType: z.enum(["SECTION", "ASSET"]).default("ASSET"),
  sectionId: z.string().min(1).nullable().optional(),
  newSectionName: z.string().trim().min(1).max(120).nullable().optional(),
  economico: z.number().nullable().optional(),
  financeiro: z.number().nullable().optional(),
  sortOrder: z.number().int().default(0),
});

const TOTAL_LABEL = "Total do Patrimonio";
const TOTAL_LABEL_NORMALIZED = "total do patrimonio";

async function getAllowedGroupIds(userId: string, role: string): Promise<string[] | null> {
  if (role === "ADMIN") return null; // null = all groups
  const rows = await prisma.userCompany.findMany({
    where: { userId, company: { isActive: true, group: { isActive: true } } },
    select: { company: { select: { groupId: true } } },
  });
  return [...new Set(rows.map((r) => r.company.groupId))];
}

function normalizeLabel(label: string) {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isTotalLabel(label: string) {
  return normalizeLabel(label) === TOTAL_LABEL_NORMALIZED;
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

type PatrimonioRow = {
  id: string;
  groupId: string;
  sectionId: string | null;
  referenceMonth: string;
  label: string;
  sublabel: string | null;
  rowType: "SECTION" | "ASSET" | "SUBTOTAL" | "TOTAL";
  economico: unknown;
  financeiro: unknown;
  sortOrder: number;
  createdAt: Date;
};

function buildDisplayRows(rows: PatrimonioRow[]) {
  const persistedRows = rows.filter((row) => row.rowType !== "TOTAL");
  const sortedRows = [...persistedRows].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const sections = sortedRows.filter((row) => row.rowType === "SECTION" || row.rowType === "SUBTOTAL");
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  let currentSectionId: string | null = null;
  let fallbackSection: PatrimonioRow | null = null;
  const bySection = new Map<string, PatrimonioRow[]>();
  const withoutSection: PatrimonioRow[] = [];

  for (const section of sections) {
    bySection.set(section.id, []);
  }

  for (const row of sortedRows) {
    if (row.rowType === "SECTION" || row.rowType === "SUBTOTAL") {
      currentSectionId = row.id;
      continue;
    }

    const explicitSectionId = row.sectionId && sectionById.has(row.sectionId) ? row.sectionId : null;
    const inferredSectionId = explicitSectionId ?? currentSectionId;
    if (inferredSectionId && bySection.has(inferredSectionId)) {
      bySection.get(inferredSectionId)!.push({ ...row, sectionId: inferredSectionId });
    } else {
      withoutSection.push(row);
    }
  }

  if (withoutSection.length > 0) {
    fallbackSection = {
      id: "__unsectioned__",
      groupId: withoutSection[0]!.groupId,
      sectionId: null,
      referenceMonth: withoutSection[0]!.referenceMonth,
      label: "Sem secao",
      sublabel: null,
      rowType: "SECTION",
      economico: null,
      financeiro: null,
      sortOrder: -1,
      createdAt: new Date(0),
    };
  }

  const displayRows: PatrimonioRow[] = [];
  if (fallbackSection) {
    displayRows.push(fallbackSection, ...withoutSection);
  }
  for (const section of sections) {
    const items = bySection.get(section.id) ?? [];
    displayRows.push(section);
    displayRows.push(...items);
  }

  const rowsWithSubtotals = displayRows.reduce<{ rows: PatrimonioRow[]; current: { economico: number; financeiro: number } }>(
    (acc, row) => {
      if (row.rowType === "SECTION") {
        acc.current = { economico: 0, financeiro: 0 };
        acc.rows.push(row);
        return acc;
      }

      if (row.rowType === "SUBTOTAL") {
        acc.rows.push({
          ...row,
          economico: acc.current.economico,
          financeiro: acc.current.financeiro,
        });
        acc.current = { economico: 0, financeiro: 0 };
        return acc;
      }

      if (row.rowType === "ASSET") {
        acc.current.economico += toNumber(row.economico) ?? 0;
        acc.current.financeiro += toNumber(row.financeiro) ?? 0;
      }

      acc.rows.push(row);
      return acc;
    },
    { rows: [], current: { economico: 0, financeiro: 0 } },
  ).rows;

  const totals = rowsWithSubtotals
    .filter((row) => row.rowType === "ASSET")
    .reduce(
      (acc, row) => {
        acc.economico += toNumber(row.economico) ?? 0;
        acc.financeiro += toNumber(row.financeiro) ?? 0;
        return acc;
      },
      { economico: 0, financeiro: 0 },
    );

  if (rowsWithSubtotals.length > 0) {
    const first = rowsWithSubtotals[0]!;
    rowsWithSubtotals.push({
      id: "__total__",
      groupId: first.groupId,
      sectionId: null,
      referenceMonth: first.referenceMonth,
      label: TOTAL_LABEL,
      sublabel: null,
      rowType: "TOTAL",
      economico: totals.economico,
      financeiro: totals.financeiro,
      sortOrder: Number.MAX_SAFE_INTEGER,
      createdAt: new Date(0),
    });
  }

  return rowsWithSubtotals;
}

async function resolveSectionId(input: {
  tx: Pick<typeof prisma, "patrimonioAsset">;
  groupId: string;
  referenceMonth: string;
  sectionId?: string | null;
  newSectionName?: string | null;
}) {
  const newSectionName = input.newSectionName?.trim();
  if (newSectionName) {
    if (isTotalLabel(newSectionName)) {
      throw new Error("TOTAL_SECTION_NOT_ALLOWED");
    }

    const existing = await input.tx.patrimonioAsset.findFirst({
      where: {
        groupId: input.groupId,
        referenceMonth: input.referenceMonth,
        rowType: { in: ["SECTION", "SUBTOTAL"] },
        label: { equals: newSectionName, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (existing) return existing.id;

    const lastSection = await input.tx.patrimonioAsset.findFirst({
      where: { groupId: input.groupId, referenceMonth: input.referenceMonth, rowType: { in: ["SECTION", "SUBTOTAL"] } },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const created = await input.tx.patrimonioAsset.create({
      data: {
        groupId: input.groupId,
        referenceMonth: input.referenceMonth,
        label: newSectionName,
        rowType: "SECTION",
        sortOrder: (lastSection?.sortOrder ?? -100) + 100,
      },
      select: { id: true },
    });
    return created.id;
  }

  if (!input.sectionId) {
    throw new Error("SECTION_REQUIRED");
  }

  const section = await input.tx.patrimonioAsset.findFirst({
    where: {
      id: input.sectionId,
      groupId: input.groupId,
      referenceMonth: input.referenceMonth,
      rowType: { in: ["SECTION", "SUBTOTAL"] },
    },
    select: { id: true },
  });

  if (!section) {
    throw new Error("SECTION_INVALID");
  }

  return section.id;
}

function sectionErrorResponse(error: unknown) {
  if (!(error instanceof Error)) return null;
  if (error.message === "SECTION_REQUIRED") {
    return NextResponse.json({ error: "Secao do patrimonio obrigatoria." }, { status: 400 });
  }
  if (error.message === "SECTION_INVALID") {
    return NextResponse.json({ error: "Secao do patrimonio invalida." }, { status: 400 });
  }
  if (error.message === "TOTAL_SECTION_NOT_ALLOWED") {
    return NextResponse.json({ error: "Total do patrimonio e calculado automaticamente." }, { status: 400 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const session = await getUserFromRequest(request);
  if (!session?.sub) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const user = await prisma.user.findFirst({
    where: { id: session.sub, status: "ACTIVE" },
    select: { id: true, role: true },
  });
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId") ?? undefined;
  const month = searchParams.get("month") ?? undefined;

  const allowedGroupIds = await getAllowedGroupIds(user.id, user.role);

  // CLIENT: verify requested group is accessible
  if (allowedGroupIds !== null && groupId && !allowedGroupIds.includes(groupId)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const where: Record<string, unknown> = {};
  if (groupId) {
    where.groupId = groupId;
  } else if (allowedGroupIds !== null) {
    where.groupId = { in: allowedGroupIds };
  }
  if (month) where.referenceMonth = month;

  try {
    const assets = await prisma.patrimonioAsset.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        groupId: true,
        sectionId: true,
        referenceMonth: true,
        label: true,
        sublabel: true,
        rowType: true,
        economico: true,
        financeiro: true,
        sortOrder: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ assets: buildDisplayRows(assets as PatrimonioRow[]) });
  } catch {
    return NextResponse.json({ error: "Nao foi possivel carregar ativos." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { admin, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
    }

    const group = await prisma.group.findUnique({ where: { id: parsed.data.groupId }, select: { id: true } });
    if (!group) return NextResponse.json({ error: "Grupo invalido." }, { status: 400 });

    if (isTotalLabel(parsed.data.label)) {
      return NextResponse.json({ error: "Total do patrimonio e calculado automaticamente." }, { status: 400 });
    }

    const asset = await prisma.$transaction(async (tx) => {
      if (parsed.data.rowType === "SECTION") {
        return tx.patrimonioAsset.create({
          data: {
            groupId: parsed.data.groupId,
            referenceMonth: parsed.data.referenceMonth,
            label: parsed.data.label,
            sublabel: parsed.data.sublabel ?? null,
            rowType: "SECTION",
            economico: null,
            financeiro: null,
            sortOrder: parsed.data.sortOrder,
          },
        });
      }

      const sectionId = await resolveSectionId({
        tx,
        groupId: parsed.data.groupId,
        referenceMonth: parsed.data.referenceMonth,
        sectionId: parsed.data.sectionId,
        newSectionName: parsed.data.newSectionName,
      });

      return tx.patrimonioAsset.create({
        data: {
          groupId: parsed.data.groupId,
          sectionId,
          referenceMonth: parsed.data.referenceMonth,
          label: parsed.data.label,
          sublabel: parsed.data.sublabel ?? null,
          rowType: "ASSET",
          economico: parsed.data.economico ?? null,
          financeiro: parsed.data.financeiro ?? null,
          sortOrder: parsed.data.sortOrder,
        },
      });
    });

    writeAuditLog({
      userId: admin!.id,
      action: AuditAction.PATRIMONIO_CREATE,
      entity: "PatrimonioAsset",
      entityId: asset.id,
      metadata: { groupId: asset.groupId, referenceMonth: asset.referenceMonth, label: asset.label },
    });

    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    const mapped = sectionErrorResponse(error);
    if (mapped) return mapped;
    return NextResponse.json({ error: "Nao foi possivel criar ativo." }, { status: 500 });
  }
}
