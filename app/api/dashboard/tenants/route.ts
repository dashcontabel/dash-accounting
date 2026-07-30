import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequest } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/company-access";
import {
  matchTenant,
  normalizeTenantKey,
  resolveTenantFromDescription,
  tenantDisplayKey,
} from "@/lib/dashboard/tenant-identification";
import {
  buildTenantPaymentSummary,
  resolveTenantPaymentStatus,
  type TenantPaymentMonthStatus,
  type TenantPaymentStatus,
} from "@/lib/dashboard/tenant-payments";
import { prisma } from "@/lib/prisma";
import {
  getTenantDisplaySettings,
  shouldDisplayTenant,
} from "@/lib/settings/company-settings";

export const runtime = "nodejs";

const querySchema = z.object({
  companyId: z.string().min(1),
  year: z.string().regex(/^\d{4}$/),
  includeHidden: z.boolean().default(false),
});

export type TenantItem = {
  /** Stable key used by tenant display parametrization */
  key: string;
  /** Tenant name (from RazaoEntry.description or tenant receivable account) */
  description: string;
  /** Credit total per cost center name */
  byCostCenter: Record<string, number>;
  /** Sum of all credits for this tenant in the year */
  totalCredit: number;
  /**
   * Extrapolated annual forecast:
   * (totalCredit / totalMonths) * 12
   * Only meaningful when totalMonths < 12.
   */
  annualForecast: number;
  /** annualForecast - totalCredit (positive = still to receive) */
  balance: number;
  /** Monthly receivable provision/payment status, when the Razao has tenant A/R accounts */
  payment?: {
    provisioned: number;
    paid: number;
    openBalance: number;
    status: TenantPaymentStatus;
    monthly: TenantPaymentMonthStatus[];
  };
};

export type TenantSummaryResponse = {
  hasTenantData: boolean;
  hasTenantPaymentData: boolean;
  year: string;
  companyId: string;
  /** Number of distinct months in the year that have any RazaoEntry data */
  totalMonths: number;
  /** All unique cost-center names found across visible tenant entries */
  costCenters: string[];
  /** Cost centers with visible tenant payment statuses */
  paymentCostCenters: string[];
  /** Competencies with visible tenant payment statuses */
  paymentCompetencies: string[];
  items: TenantItem[];
};

type RawTenantEntry = {
  referenceMonth: string;
  entryDate: Date;
  accountCode: string;
  accountName: string;
  costCenter: string | null;
  lot: string | null;
  description: string | null;
  debit: unknown;
  credit: unknown;
};

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function summarizePayment(monthly: TenantPaymentMonthStatus[]) {
  const provisioned = roundMoney(monthly.reduce((sum, item) => sum + item.provisioned, 0));
  const paid = roundMoney(monthly.reduce((sum, item) => sum + item.paid, 0));
  const openBalance = roundMoney(monthly.reduce((sum, item) => sum + item.openBalance, 0));

  return {
    provisioned,
    paid,
    openBalance,
    status: resolveTenantPaymentStatus(provisioned, paid),
    monthly,
  };
}

function itemInternalKey(item: Pick<TenantItem, "description" | "key">) {
  return matchTenant(item.description) ?? item.key;
}

function collectCostCenters(items: TenantItem[]) {
  const costCenters = new Set<string>();

  for (const item of items) {
    for (const costCenter of Object.keys(item.byCostCenter)) {
      costCenters.add(costCenter);
    }
    for (const month of item.payment?.monthly ?? []) {
      if (month.costCenter) costCenters.add(month.costCenter);
    }
  }

  return [...costCenters].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function collectPaymentCostCenters(items: TenantItem[]) {
  const costCenters = new Set<string>();

  for (const item of items) {
    for (const month of item.payment?.monthly ?? []) {
      if (month.costCenter) costCenters.add(month.costCenter);
    }
  }

  return [...costCenters].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function collectPaymentCompetencies(items: TenantItem[]) {
  const competencies = new Set<string>();

  for (const item of items) {
    for (const month of item.payment?.monthly ?? []) {
      competencies.add(month.referenceMonth);
    }
  }

  return [...competencies].sort();
}

/**
 * GET /api/dashboard/tenants
 *
 * Returns tenant cards for a company/year. By default the response respects
 * the per-company display parametrization. Admins can pass includeHidden=true
 * so the settings screen can list every detected tenant.
 */
export async function GET(request: NextRequest) {
  const session = await getUserFromRequest(request);
  if (!session?.sub) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const user = await prisma.user.findFirst({
    where: { id: session.sub, status: "ACTIVE" },
    select: { id: true, role: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const parsed = querySchema.safeParse({
    companyId: request.nextUrl.searchParams.get("companyId") ?? "",
    year: request.nextUrl.searchParams.get("year") ?? "",
    includeHidden: request.nextUrl.searchParams.get("includeHidden") === "true",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Parametros invalidos." }, { status: 400 });
  }

  const { companyId, year, includeHidden } = parsed.data;

  try {
    await assertCompanyAccess(user, companyId);

    const entries = await prisma.razaoEntry.findMany({
      where: {
        companyId,
        referenceMonth: { startsWith: year },
      },
      select: {
        referenceMonth: true,
        entryDate: true,
        accountCode: true,
        accountName: true,
        costCenter: true,
        lot: true,
        description: true,
        debit: true,
        credit: true,
      },
    });

    if (entries.length === 0) {
      return NextResponse.json<TenantSummaryResponse>({
        hasTenantData: false,
        hasTenantPaymentData: false,
        year,
        companyId,
        totalMonths: 0,
        costCenters: [],
        paymentCostCenters: [],
        paymentCompetencies: [],
        items: [],
      });
    }

    const totalMonths = new Set(entries.map((entry) => entry.referenceMonth)).size;
    const byTenant = new Map<string, Record<string, number>>();
    const tenantDisplayNames = new Map<string, string>();

    for (const entry of entries) {
      if (!entry.description || !entry.costCenter || Number(entry.credit) <= 0) continue;
      const tenant = resolveTenantFromDescription(entry.description);
      if (!tenant) continue;

      if (!tenantDisplayNames.has(tenant.key)) {
        tenantDisplayNames.set(tenant.key, tenant.displayName);
      }

      const cc = byTenant.get(tenant.key) ?? {};
      cc[entry.costCenter] = (cc[entry.costCenter] ?? 0) + Number(entry.credit);
      byTenant.set(tenant.key, cc);
    }

    const items: TenantItem[] = [];
    for (const [tenantKey, byCostCenter] of byTenant) {
      const totalCredit = Object.values(byCostCenter).reduce((sum, value) => sum + value, 0);
      const annualForecast = totalMonths > 0 ? (totalCredit / totalMonths) * 12 : totalCredit;
      const balance = annualForecast - totalCredit;
      const description = tenantDisplayNames.get(tenantKey) ?? tenantKey.toUpperCase();

      items.push({
        key: tenantDisplayKey(description),
        description,
        byCostCenter,
        totalCredit,
        annualForecast,
        balance,
      });
    }

    const paymentSummary = buildTenantPaymentSummary(entries as RawTenantEntry[]);
    const paymentByTenant = new Map<string, TenantPaymentMonthStatus[]>();
    const paymentDisplayNames = new Map<string, string>();

    for (const paymentItem of paymentSummary.items) {
      const tenantKey = matchTenant(paymentItem.tenantName) ?? paymentItem.tenantKey;
      const current = paymentByTenant.get(tenantKey) ?? [];
      current.push(paymentItem);
      paymentByTenant.set(tenantKey, current);

      if (!paymentDisplayNames.has(tenantKey)) {
        paymentDisplayNames.set(tenantKey, paymentItem.tenantName.toUpperCase());
      }
    }

    for (const [tenantKey, monthly] of paymentByTenant) {
      const description = paymentDisplayNames.get(tenantKey) ?? tenantKey.toUpperCase();
      const paymentDisplayKey = tenantDisplayKey(description);
      const payment = summarizePayment(monthly);
      const item = items.find((candidate) => {
        return (
          itemInternalKey(candidate) === tenantKey ||
          candidate.key === paymentDisplayKey ||
          normalizeTenantKey(candidate.description) === normalizeTenantKey(tenantKey)
        );
      });

      if (item) {
        item.key = paymentDisplayKey;
        item.description = description;
        item.payment = payment;
        continue;
      }

      items.push({
        key: paymentDisplayKey,
        description,
        byCostCenter: {},
        totalCredit: payment.paid,
        annualForecast: payment.provisioned,
        balance: payment.openBalance,
        payment,
      });
    }

    items.sort((a, b) => {
      const totalA = a.payment?.paid ?? a.totalCredit;
      const totalB = b.payment?.paid ?? b.totalCredit;
      return totalB - totalA;
    });

    const settings = await getTenantDisplaySettings(companyId);
    const canIncludeHidden = includeHidden && user.role === "ADMIN";
    const visibleItems = canIncludeHidden
      ? items
      : items.filter((item) => shouldDisplayTenant(item.key, settings));

    return NextResponse.json<TenantSummaryResponse>({
      hasTenantData: visibleItems.length > 0,
      hasTenantPaymentData: visibleItems.some((item) => Boolean(item.payment)),
      year,
      companyId,
      totalMonths,
      costCenters: collectCostCenters(visibleItems),
      paymentCostCenters: collectPaymentCostCenters(visibleItems),
      paymentCompetencies: collectPaymentCompetencies(visibleItems),
      items: visibleItems,
    });
  } catch (err) {
    if (err instanceof Error && (err.message === "Forbidden" || err.message === "COMPANY_ACCESS_DENIED")) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    console.error("[tenants] erro:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
