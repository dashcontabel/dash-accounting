import { Prisma } from "@prisma/client";
import { z } from "zod";

import { tenantDisplayKey } from "@/lib/dashboard/tenant-identification";
import { prisma } from "@/lib/prisma";

export const TENANT_DISPLAY_SETTING_KEY = "dashboard.tenants.display";

export type TenantDisplayMode = "ALL" | "SELECTED";

export type TenantDisplaySettings = {
  mode: TenantDisplayMode;
  visibleTenantKeys: string[];
};

export const DEFAULT_TENANT_DISPLAY_SETTINGS: TenantDisplaySettings = {
  mode: "ALL",
  visibleTenantKeys: [],
};

const tenantDisplaySettingsSchema = z.object({
  mode: z.enum(["ALL", "SELECTED"]).default("ALL"),
  visibleTenantKeys: z.array(z.string().trim().min(1)).default([]),
});

function uniqueTenantKeys(keys: string[]) {
  return [...new Set(keys.map(tenantDisplayKey).filter(Boolean))].sort();
}

export function normalizeTenantDisplaySettings(value: unknown): TenantDisplaySettings {
  let parsedValue = value;

  if (typeof value === "string") {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      return DEFAULT_TENANT_DISPLAY_SETTINGS;
    }
  }

  const parsed = tenantDisplaySettingsSchema.safeParse(parsedValue);
  if (!parsed.success) return DEFAULT_TENANT_DISPLAY_SETTINGS;

  return {
    mode: parsed.data.mode,
    visibleTenantKeys: uniqueTenantKeys(parsed.data.visibleTenantKeys),
  };
}

export async function getTenantDisplaySettings(companyId: string): Promise<TenantDisplaySettings> {
  const setting = await prisma.companySetting.findUnique({
    where: {
      companyId_key: {
        companyId,
        key: TENANT_DISPLAY_SETTING_KEY,
      },
    },
    select: { value: true },
  });

  return normalizeTenantDisplaySettings(setting?.value ?? null);
}

export async function setTenantDisplaySettings(
  companyId: string,
  settings: TenantDisplaySettings,
): Promise<TenantDisplaySettings> {
  const normalized = normalizeTenantDisplaySettings(settings);

  await prisma.companySetting.upsert({
    where: {
      companyId_key: {
        companyId,
        key: TENANT_DISPLAY_SETTING_KEY,
      },
    },
    create: {
      companyId,
      key: TENANT_DISPLAY_SETTING_KEY,
      value: normalized as unknown as Prisma.InputJsonValue,
    },
    update: {
      value: normalized as unknown as Prisma.InputJsonValue,
    },
  });

  return normalized;
}

export function shouldDisplayTenant(tenantKey: string, settings: TenantDisplaySettings) {
  if (settings.mode === "ALL") return true;
  return settings.visibleTenantKeys.includes(tenantDisplayKey(tenantKey));
}
