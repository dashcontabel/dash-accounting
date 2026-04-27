import { prisma } from "./prisma";

const AUDIT_ENABLED_KEY = "audit_enabled";

// In-process cache to avoid a DB round-trip on every audit event.
// TTL: 30 seconds — changes propagate within half a minute.
let cache: { value: boolean; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

export async function getAuditEnabled(): Promise<boolean> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;

  try {
    const row = await prisma.systemConfig.findUnique({
      where: { key: AUDIT_ENABLED_KEY },
      select: { value: true },
    });
    const value = row ? row.value !== "false" : true;
    cache = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  } catch {
    // DB unreachable — default to enabled so we don't silently drop events
    return true;
  }
}

export async function setAuditEnabled(enabled: boolean): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { key: AUDIT_ENABLED_KEY },
    update: { value: String(enabled) },
    create: { key: AUDIT_ENABLED_KEY, value: String(enabled) },
  });
  // Invalidate cache immediately so the next check reflects the new value
  cache = null;
}
