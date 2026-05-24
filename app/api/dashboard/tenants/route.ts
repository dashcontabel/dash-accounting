import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequest } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/company-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Hardcoded list of canonical tenant names.
 * Matching is accent- and case-insensitive substring search.
 * Will be moved to DB config in a future iteration.
 */
const KNOWN_TENANTS = [
  "João",
  "Manoel",
  "José",
  "Maria",
  "Pedro",
  "Gustavo",
] as const;

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Returns the canonical tenant label if description mentions a known tenant; null otherwise. */
function matchTenant(description: string): string | null {
  const norm = normalize(description);
  for (const tenant of KNOWN_TENANTS) {
    if (norm.includes(normalize(tenant))) return tenant;
  }
  return null;
}

// Words that are never a valid surname in a description
const SKIP_SURNAME_WORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "em", "na", "no", "a", "o",
]);

/**
 * Extracts "FIRST LAST" from a raw description, finding the tenant first-name
 * word and taking the immediately following word as the surname.
 * Example: "VR REF A ADIANAMENTO PEDRO MAIA" + "Pedro" → "PEDRO MAIA"
 *
 * Skips the surname candidate when it:
 *   - contains a slash or hyphen (e.g. "JOÃO/EVELYN" split artifact)
 *   - is a preposition (de, da, do …)
 *   - matches another known tenant first name
 */
function extractDisplayName(description: string, canonicalFirst: string): string {
  const words = description.trim().split(/\s+/);
  const normFirst = normalize(canonicalFirst);
  const knownNorms = (KNOWN_TENANTS as readonly string[]).map(normalize);

  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    // Clean the matched word itself (handle "JOÃO/EVELYN" → "JOÃO")
    const cleanedFirst = word.split(/[\/\-]/)[0]!.trim();
    if (!normalize(cleanedFirst).includes(normFirst)) continue;

    // Evaluate the next word as a potential surname
    let surname = "";
    if (i + 1 < words.length) {
      const next = words[i + 1]!;
      const normNext = normalize(next);
      const isAlphaOnly = /^[\p{L}]+$/u.test(next);         // letters only (no /\-0-9)
      const isPrep = SKIP_SURNAME_WORDS.has(normNext);       // de, da, do …
      const isKnownFirst = knownNorms.some((k) => normNext.includes(k)); // João, Pedro …

      if (isAlphaOnly && !isPrep && !isKnownFirst) surname = next;
    }

    const parts = surname ? [cleanedFirst, surname] : [cleanedFirst];
    return parts.join(" ").toUpperCase();
  }
  return canonicalFirst.toUpperCase();
}

const querySchema = z.object({
  companyId: z.string().min(1),
  year: z.string().regex(/^\d{4}$/),
});

export type TenantItem = {
  /** Tenant name (from RazaoEntry.description) */
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
};

export type TenantSummaryResponse = {
  hasTenantData: boolean;
  year: string;
  companyId: string;
  /** Number of distinct months in the year that have any RazaoEntry data */
  totalMonths: number;
  /** All unique cost-center names found across tenant entries */
  costCenters: string[];
  items: TenantItem[];
};

/**
 * GET /api/dashboard/tenants
 *
 * Returns credit totals grouped by tenant (RazaoEntry.description) and cost
 * center for a company across the full selected year.
 *
 * Only entries with both description AND costCenter populated, and where
 * credit > 0, are considered. This captures receivable-side movements
 * (rents, condo fees, admin fees) that are typically tagged with a locatário
 * description and a cost-center such as "Condomínio" or "Placa - ADM".
 *
 * The annualForecast is extrapolated as: (totalCredit / totalMonths) × 12
 *
 * Query params:
 *   companyId – required
 *   year      – required, "YYYY"
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
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Parametros invalidos." }, { status: 400 });
  }

  const { companyId, year } = parsed.data;

  try {
    await assertCompanyAccess(user, companyId);

    // Quick check: does any entry exist with description + costCenter + credit > 0?
    const anyEntry = await prisma.razaoEntry.findFirst({
      where: {
        companyId,
        referenceMonth: { startsWith: year },
        description: { not: null },
        costCenter: { not: null },
        credit: { gt: 0 },
      },
      select: { id: true },
    });

    if (!anyEntry) {
      return NextResponse.json<TenantSummaryResponse>({
        hasTenantData: false,
        year,
        companyId,
        totalMonths: 0,
        costCenters: [],
        items: [],
      });
    }

    // Count distinct reference months to use for extrapolation
    const monthRows = await prisma.razaoEntry.findMany({
      where: { companyId, referenceMonth: { startsWith: year } },
      select: { referenceMonth: true },
      distinct: ["referenceMonth"],
    });
    const totalMonths = monthRows.length;

    // Group by description + costCenter, summing credits
    const grouped = await prisma.razaoEntry.groupBy({
      by: ["description", "costCenter"],
      where: {
        companyId,
        referenceMonth: { startsWith: year },
        description: { not: null },
        costCenter: { not: null },
        credit: { gt: 0 },
      },
      _sum: { credit: true },
    });

    // Aggregate per known tenant (merge all descriptions that match the same canonical name)
    const byTenant = new Map<string, Record<string, number>>();
    const tenantDisplayNames = new Map<string, string>(); // canonical key → "NOME SOBRENOME"
    for (const g of grouped) {
      if (!g.description || !g.costCenter) continue;
      const tenantKey = matchTenant(g.description);
      if (!tenantKey) continue; // skip entries that don't belong to any known tenant
      // Capture display name from the first description seen for this tenant
      if (!tenantDisplayNames.has(tenantKey)) {
        tenantDisplayNames.set(tenantKey, extractDisplayName(g.description, tenantKey));
      }
      if (!byTenant.has(tenantKey)) byTenant.set(tenantKey, {});
      const cc = byTenant.get(tenantKey)!;
      cc[g.costCenter] = (cc[g.costCenter] ?? 0) + Number(g._sum.credit ?? 0);
    }

    // Build items with forecast and balance
    // (also collect cost centers only from matched entries)
    const ccSet = new Set<string>();
    const items: TenantItem[] = [];
    for (const [tenantKey, byCostCenter] of byTenant) {
      const totalCredit = Object.values(byCostCenter).reduce((s, v) => s + v, 0);
      const annualForecast = totalMonths > 0 ? (totalCredit / totalMonths) * 12 : totalCredit;
      const balance = annualForecast - totalCredit;
      for (const cc of Object.keys(byCostCenter)) ccSet.add(cc);
      const description = tenantDisplayNames.get(tenantKey) ?? tenantKey.toUpperCase();
      items.push({ description, byCostCenter, totalCredit, annualForecast, balance });
    }

    const costCenters = [...ccSet].sort((a, b) => a.localeCompare(b, "pt-BR"));

    // Sort by totalCredit descending
    items.sort((a, b) => b.totalCredit - a.totalCredit);

    return NextResponse.json<TenantSummaryResponse>({
      hasTenantData: items.length > 0,
      year,
      companyId,
      totalMonths,
      costCenters,
      items,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Forbidden") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    console.error("[tenants] erro:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
