import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog, AuditAction } from "@/lib/audit";

const patchSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  sublabel: z.string().max(200).nullable().optional(),
  rowType: z.enum(["SECTION", "SUBTOTAL", "ASSET"]).optional(),
  sectionId: z.string().min(1).nullable().optional(),
  newSectionName: z.string().trim().min(1).max(120).nullable().optional(),
  economico: z.number().nullable().optional(),
  financeiro: z.number().nullable().optional(),
  sortOrder: z.number().int().optional(),
  referenceMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

const TOTAL_LABEL_NORMALIZED = "total do patrimonio";

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

async function resolveSectionId(input: {
  tx: Pick<typeof prisma, "patrimonioAsset">;
  assetId: string;
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

  if (input.sectionId === input.assetId) {
    throw new Error("SECTION_INVALID");
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
  if (!section) throw new Error("SECTION_INVALID");
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

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { admin, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;
  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
    }

    if (parsed.data.label && isTotalLabel(parsed.data.label)) {
      return NextResponse.json({ error: "Total do patrimonio e calculado automaticamente." }, { status: 400 });
    }

    const asset = await prisma.$transaction(async (tx) => {
      const current = await tx.patrimonioAsset.findUnique({
        where: { id },
        select: { id: true, groupId: true, referenceMonth: true, rowType: true },
      });

      if (!current) {
        throw new Error("ASSET_NOT_FOUND");
      }

      const nextRowType = parsed.data.rowType ?? current.rowType;
      if (nextRowType === "TOTAL") {
        throw new Error("TOTAL_NOT_ALLOWED");
      }

      const nextReferenceMonth = parsed.data.referenceMonth ?? current.referenceMonth;
      let nextSectionId = parsed.data.sectionId;
      if (nextRowType === "SECTION" || nextRowType === "SUBTOTAL") {
        nextSectionId = null;
      } else if (
        parsed.data.sectionId !== undefined ||
        parsed.data.newSectionName ||
        current.rowType === "SECTION" ||
        current.rowType === "SUBTOTAL"
      ) {
        nextSectionId = await resolveSectionId({
          tx,
          assetId: id,
          groupId: current.groupId,
          referenceMonth: nextReferenceMonth,
          sectionId: parsed.data.sectionId,
          newSectionName: parsed.data.newSectionName,
        });
      }

      const data = { ...parsed.data };
      delete data.newSectionName;
      return tx.patrimonioAsset.update({
        where: { id },
        data: {
          ...data,
          rowType: nextRowType,
          sectionId: nextSectionId,
          economico: nextRowType === "SECTION" ? null : data.economico,
          financeiro: nextRowType === "SECTION" ? null : data.financeiro,
        },
      });
    });

    writeAuditLog({
      userId: admin!.id,
      action: AuditAction.PATRIMONIO_UPDATE,
      entity: "PatrimonioAsset",
      entityId: id,
      metadata: parsed.data as Record<string, unknown>,
    });

    return NextResponse.json({ asset });
  } catch (error) {
    const mapped = sectionErrorResponse(error);
    if (mapped) return mapped;
    if (error instanceof Error && error.message === "TOTAL_NOT_ALLOWED") {
      return NextResponse.json({ error: "Total do patrimonio e calculado automaticamente." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "ASSET_NOT_FOUND") {
      return NextResponse.json({ error: "Ativo nao encontrado." }, { status: 404 });
    }
    return NextResponse.json({ error: "Nao foi possivel atualizar ativo." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { admin, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;
  const { id } = await context.params;

  try {
    const asset = await prisma.patrimonioAsset.findUnique({
      where: { id },
      select: { rowType: true },
    });
    if (!asset) return NextResponse.json({ error: "Ativo nao encontrado." }, { status: 404 });

    if (asset.rowType === "SECTION" || asset.rowType === "SUBTOTAL") {
      const linkedItems = await prisma.patrimonioAsset.count({ where: { sectionId: id } });
      if (linkedItems > 0) {
        return NextResponse.json(
          { error: "Nao e possivel remover uma secao com ativos vinculados." },
          { status: 409 },
        );
      }
    }

    await prisma.patrimonioAsset.delete({ where: { id } });

    writeAuditLog({
      userId: admin!.id,
      action: AuditAction.PATRIMONIO_DELETE,
      entity: "PatrimonioAsset",
      entityId: id,
      metadata: {},
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Nao foi possivel remover ativo." }, { status: 500 });
  }
}
