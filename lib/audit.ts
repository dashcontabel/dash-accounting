import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getAuditEnabled } from "./system-config";

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
 * A gravação é pulada quando a auditoria estiver desativada no SystemConfig.
 */
export function writeAuditLog(params: AuditParams): void {
  const { userId, companyId, action, entity, entityId, metadata = {} } = params;

  void (async () => {
    if (!(await getAuditEnabled())) return;

    await prisma.auditLog
      .create({
        data: {
          userId: userId ?? null,
          companyId: companyId ?? null,
          action,
          entity,
          entityId: entityId ?? null,
          metadata: metadata as Prisma.InputJsonValue,
        },
      })
      .catch((err) => {
        console.error("[audit] Falha ao gravar log de auditoria:", err);
      });
  })();
}
