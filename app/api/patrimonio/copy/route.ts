import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog, AuditAction } from "@/lib/audit";

const copySchema = z.object({
  groupId: z.string().min(1),
  sourceMonth: z.string().regex(/^\d{4}-\d{2}$/),
  targetMonth: z.string().regex(/^\d{4}-\d{2}$/),
});

export async function POST(request: NextRequest) {
  const { admin, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const parsed = copySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
    }

    const { groupId, sourceMonth, targetMonth } = parsed.data;
    if (sourceMonth === targetMonth) {
      return NextResponse.json({ error: "Competencia de destino deve ser diferente da origem." }, { status: 400 });
    }

    const group = await prisma.group.findFirst({
      where: { id: groupId, isActive: true },
      select: { id: true },
    });
    if (!group) return NextResponse.json({ error: "Grupo invalido." }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      const targetCount = await tx.patrimonioAsset.count({
        where: { groupId, referenceMonth: targetMonth },
      });
      if (targetCount > 0) {
        throw new Error("TARGET_ALREADY_EXISTS");
      }

      const sourceRows = await tx.patrimonioAsset.findMany({
        where: {
          groupId,
          referenceMonth: sourceMonth,
          rowType: { in: ["SECTION", "SUBTOTAL", "ASSET"] },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          sectionId: true,
          label: true,
          sublabel: true,
          rowType: true,
          economico: true,
          financeiro: true,
          sortOrder: true,
        },
      });

      if (sourceRows.length === 0) {
        throw new Error("SOURCE_EMPTY");
      }

      const idMap = new Map<string, string>();
      const sections = sourceRows.filter((row) => row.rowType === "SECTION" || row.rowType === "SUBTOTAL");
      const assets = sourceRows.filter((row) => row.rowType === "ASSET");

      for (const section of sections) {
        const created = await tx.patrimonioAsset.create({
          data: {
            groupId,
            referenceMonth: targetMonth,
            label: section.label,
            sublabel: section.sublabel,
            rowType: section.rowType === "SUBTOTAL" ? "SUBTOTAL" : "SECTION",
            economico: section.rowType === "SUBTOTAL" ? section.economico : null,
            financeiro: section.rowType === "SUBTOTAL" ? section.financeiro : null,
            sortOrder: section.sortOrder,
          },
          select: { id: true },
        });
        idMap.set(section.id, created.id);
      }

      let lastSectionId: string | null = null;
      for (const row of sourceRows) {
        if (row.rowType === "SECTION" || row.rowType === "SUBTOTAL") {
          lastSectionId = idMap.get(row.id) ?? null;
          continue;
        }
        if (row.rowType !== "ASSET") continue;

        const targetSectionId = row.sectionId ? idMap.get(row.sectionId) ?? null : lastSectionId;
        await tx.patrimonioAsset.create({
          data: {
            groupId,
            sectionId: targetSectionId,
            referenceMonth: targetMonth,
            label: row.label,
            sublabel: row.sublabel,
            rowType: "ASSET",
            economico: row.economico,
            financeiro: row.financeiro,
            sortOrder: row.sortOrder,
          },
        });
      }

      return {
        sectionsCopied: sections.length,
        assetsCopied: assets.length,
      };
    });

    writeAuditLog({
      userId: admin!.id,
      action: AuditAction.PATRIMONIO_CREATE,
      entity: "PatrimonioAsset",
      entityId: null,
      metadata: { groupId, sourceMonth, targetMonth, ...result },
    });

    return NextResponse.json({ copied: true, ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "TARGET_ALREADY_EXISTS") {
      return NextResponse.json(
        {
          error:
            "Ja existe patrimonio cadastrado para a competencia selecionada. Escolha outra competencia ou remova os dados existentes antes de copiar.",
        },
        { status: 409 },
      );
    }
    if (error instanceof Error && error.message === "SOURCE_EMPTY") {
      return NextResponse.json({ error: "Nao ha patrimonio cadastrado na competencia de origem." }, { status: 404 });
    }
    return NextResponse.json({ error: "Nao foi possivel copiar patrimonio." }, { status: 500 });
  }
}
