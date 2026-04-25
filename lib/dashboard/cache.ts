/**
 * Cross-page dashboard cache utilities.
 *
 * The module-level Map (`companyDataCache`) survives client-side navigation in
 * Next.js App Router (the JS module is never unloaded during SPA navigation).
 * It is invalidated by event: import success, delete, or recalculate.
 *
 * `markCompanyStale` / `consumeStaleCompanyIds` use sessionStorage as a lightweight
 * signal bus so that the imports page can notify the dashboard page on the next
 * mount — even though they are completely separate React component trees.
 */

import type { CompanyData } from "./types";

// ── Module-level cache ───────────────────────────────────────────────────────

/**
 * Stores fetched CompanyData keyed by companyId.
 * Lives for the entire browser session (until hard refresh or tab close).
 * Only invalidated when data actually changes.
 */
export const companyDataCache = new Map<string, CompanyData>();

// ── Stale marker (sessionStorage signal bus) ────────────────────────────────

const STALE_KEY_PREFIX = "dash:stale:";

/**
 * Marks a company's dashboard data as stale.
 * Call this after a successful import, delete, or recalculate.
 * The dashboard will pick this up on the next mount and evict the cached entry.
 */
export function markCompanyStale(companyId: string): void {
  try {
    sessionStorage.setItem(`${STALE_KEY_PREFIX}${companyId}`, "1");
  } catch {
    // sessionStorage unavailable in SSR or restricted environments — safe to ignore
  }
}

/**
 * Reads and clears all stale company IDs from sessionStorage.
 * Returns the IDs that should be evicted from `companyDataCache`.
 */
export function consumeStaleCompanyIds(): string[] {
  try {
    const staleIds: string[] = [];
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(STALE_KEY_PREFIX)) {
        staleIds.push(key.slice(STALE_KEY_PREFIX.length));
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) sessionStorage.removeItem(key);
    return staleIds;
  } catch {
    return [];
  }
}

// ── Action hint (localStorage signal bus) ────────────────────────────────────

/** Metadata about what action caused a company's data to change. */
export type CompanyActionHint = {
  action: "import" | "delete" | "recalculate";
  referenceMonth: string;
};

const ACTION_HINT_KEY_PREFIX = "dash:action:";
const ACTION_HINT_TTL_MS = 10 * 60_000; // 10 minutes

/**
 * Stores an action hint in localStorage so the dashboard's freshness hook can
 * build a descriptive notification message when the same browser detects a change.
 * Unlike sessionStorage stale markers, localStorage is shared across tabs.
 */
export function setActionHint(companyId: string, hint: CompanyActionHint): void {
  try {
    localStorage.setItem(
      `${ACTION_HINT_KEY_PREFIX}${companyId}`,
      JSON.stringify({ ...hint, _ts: Date.now() }),
    );
  } catch {
    // localStorage unavailable — safe to ignore
  }
}

/**
 * Reads and removes the action hint for a company.
 * Returns null if no hint exists or it has expired (> 10 min old).
 */
export function consumeActionHint(companyId: string): CompanyActionHint | null {
  try {
    const raw = localStorage.getItem(`${ACTION_HINT_KEY_PREFIX}${companyId}`);
    if (!raw) return null;
    const stored = JSON.parse(raw) as CompanyActionHint & { _ts: number };
    localStorage.removeItem(`${ACTION_HINT_KEY_PREFIX}${companyId}`);
    if (Date.now() - stored._ts > ACTION_HINT_TTL_MS) return null;
    return { action: stored.action, referenceMonth: stored.referenceMonth };
  } catch {
    return null;
  }
}
