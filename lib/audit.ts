import { AuditAction } from "@prisma/client";
import { prisma } from "./prisma";

export { AuditAction };

interface AuditParams {
  userId?: string | null;
  companyId?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Persiste um log de auditoria de forma fire-and-forget.
 * Erros são silenciados para não impactar o fluxo principal da requisição.
 */
export function writeAuditLog(params: AuditParams): void {
  const { userId, companyId, action, entity, entityId, metadata = {} } = params;

  prisma.auditLog
    .create({
      data: {
        userId: userId ?? null,
        companyId: companyId ?? null,
        action,
        entity,
        entityId: entityId ?? null,
        metadata,
      },
    })
    .catch((err) => {
      console.error("[audit] Falha ao gravar log de auditoria:", err);
    });
}
