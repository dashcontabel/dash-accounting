import { useCallback, useEffect, useRef, useState } from "react";

import { consumeActionHint } from "./cache";
import type { CompanyData } from "./types";

// ── Types ────────────────────────────────────────────────────────────────────

export type DashNotification = {
  id: string;
  companyId: string;
  companyName: string;
  /** Human-readable description of what changed (e.g. "Novo balancete importado · Mar/2025"). */
  action: string;
  /** ISO string of when the change was detected by the client. */
  detectedAt: string;
  read: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatReferenceMonth(referenceMonth: string): string {
  const [year, month] = referenceMonth.split("-");
  const name = MONTH_NAMES[(parseInt(month ?? "0", 10) - 1)] ?? month;
  return `${name}/${year}`;
}

// ── localStorage persistence ─────────────────────────────────────────────────

const NOTIFICATIONS_KEY = "dash:notifications";
const MAX_STORED = 50;

function loadNotifications(): DashNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    // Migrate old notifications that don't have the `action` field
    return parsed.map((n) => ({
      id: String(n.id ?? ""),
      companyId: String(n.companyId ?? ""),
      companyName: String(n.companyName ?? ""),
      action: n.action ? String(n.action) : "Dados da empresa foram atualizados.",
      detectedAt: String(n.detectedAt ?? new Date().toISOString()),
      read: Boolean(n.read),
    }));
  } catch {
    return [];
  }
}

function saveNotifications(list: DashNotification[]): void {
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(list.slice(0, MAX_STORED)));
  } catch {
    // localStorage unavailable (private mode, quota exceeded) — safe to ignore
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Polls /api/dashboard/freshness every `pollInterval` ms and compares server
 * timestamps against the last known state.  When a change is detected it:
 *   - Adds the company to `staleCompanyIds` (drives DataFreshnessBadge)
 *   - Creates a notification entry (drives NotificationsBell)
 *
 * Known timestamps are seeded from `companiesData.lastUpdatedAt` whenever the
 * caller loads fresh data, so a forced re-fetch automatically resets the baseline.
 */
export function useDashboardFreshness({
  companyIds,
  companiesData,
  allCompanies,
  pollInterval = 30_000,
}: {
  /** All company IDs to monitor — not just selected ones. */
  companyIds: string[];
  companiesData: CompanyData[];
  /** Full list of accessible companies for name lookup. */
  allCompanies?: Array<{ id: string; name: string }>;
  pollInterval?: number;
}) {
  // Baseline: companyId → last known ISO timestamp (when data was loaded/refreshed)
  const knownTimestamps = useRef<Map<string, string>>(new Map());
  // Latest DONE ImportBatch per company (for action message inference)
  const knownLatestBatches = useRef<Map<string, { referenceMonth: string; createdAt: string } | null>>(new Map());

  // Keep refs so polling closures always read the latest values without restarting the interval.
  const companiesDataRef = useRef(companiesData);
  const allCompaniesRef = useRef(allCompanies ?? []);
  useEffect(() => { companiesDataRef.current = companiesData; });
  useEffect(() => { allCompaniesRef.current = allCompanies ?? []; });

  // When fresh data loads, advance the known timestamp baseline for those companies.
  useEffect(() => {
    for (const c of companiesData) {
      if (!c.lastUpdatedAt) continue;
      const current = knownTimestamps.current.get(c.companyId);
      // Only advance — never regress (partial reloads with older data shouldn't break detection)
      if (!current || c.lastUpdatedAt > current) {
        knownTimestamps.current.set(c.companyId, c.lastUpdatedAt);
      }
    }
  }, [companiesData]);

  const [staleCompanyIds, setStaleCompanyIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<DashNotification[]>(() =>
    typeof window !== "undefined" ? loadNotifications() : [],
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  // ── Notification management ───────────────────────────────────────────────

  const addNotifications = useCallback(
    (newStaleIds: string[], namesMap: Map<string, string>, actionsMap: Map<string, string>) => {
      setNotifications((prev) => {
        const updated = [...prev];
        for (const companyId of newStaleIds) {
          // Don't add a second unread notification if one already exists for this company
          const alreadyPending = updated.some((n) => n.companyId === companyId && !n.read);
          if (alreadyPending) continue;
          updated.unshift({
            id: `${companyId}-${Date.now()}`,
            companyId,
            companyName: namesMap.get(companyId) ?? companyId,
            action: actionsMap.get(companyId) ?? "Dados da empresa foram atualizados.",
            detectedAt: new Date().toISOString(),
            read: false,
          });
        }
        const trimmed = updated.slice(0, MAX_STORED);
        saveNotifications(trimmed);
        return trimmed;
      });
    },
    [],
  );

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      saveNotifications(updated);
      return updated;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      saveNotifications(updated);
      return updated;
    });
  }, []);

  // ── Stale management ─────────────────────────────────────────────────────

  /** Clear stale flags for all (or specific) companies after a successful sync. */
  const clearStale = useCallback((ids?: string[]) => {
    if (ids) {
      setStaleCompanyIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setStaleCompanyIds([]);
    }
  }, []);

  /**
   * Advance the baseline for a specific company to now.
   * Call this after the current user performs a recalculate — avoids a
   * false-positive stale detection on the next poll cycle.
   */
  const refreshBaseline = useCallback((companyId: string) => {
    knownTimestamps.current.set(companyId, new Date().toISOString());
    setStaleCompanyIds((prev) => prev.filter((id) => id !== companyId));
  }, []);

  // ── Polling ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (companyIds.length === 0) return;

    const poll = async () => {
      try {
        const params = new URLSearchParams();
        // Always use the latest companyIds via closure over the state — restart is acceptable
        for (const id of companyIds) params.append("companyId", id);
        const res = await fetch(`/api/dashboard/freshness?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;

        const data = (await res.json()) as {
          companies: Array<{
            companyId: string;
            updatedAt: string | null;
            latestBatch: { referenceMonth: string; createdAt: string } | null;
          }>;
        };

        const newStaleIds: string[] = [];
        const actionsMap = new Map<string, string>();

        for (const { companyId, updatedAt, latestBatch } of data.companies) {
          if (!updatedAt) continue;

          // Seed latestBatch baseline on first encounter (before any change comparison)
          if (!knownLatestBatches.current.has(companyId)) {
            knownLatestBatches.current.set(companyId, latestBatch);
          }

          const known = knownTimestamps.current.get(companyId);
          if (!known) {
            // First poll for this company — seed baseline without triggering stale
            knownTimestamps.current.set(companyId, updatedAt);
            continue;
          }

          if (updatedAt > known) {
            newStaleIds.push(companyId);

            // Build a descriptive action message ─────────────────────────────
            const knownBatch = knownLatestBatches.current.get(companyId);
            // Priority 1: explicit hint from the same browser (set by imports page)
            const hint = consumeActionHint(companyId);
            let action: string;

            if (hint) {
              const fmtMonth = hint.referenceMonth ? formatReferenceMonth(hint.referenceMonth) : null;
              if (hint.action === "import") {
                action = fmtMonth ? `Novo balancete importado · ${fmtMonth}` : "Novo balancete importado.";
              } else if (hint.action === "delete") {
                action = fmtMonth ? `Balancete de ${fmtMonth} excluído.` : "Balancete excluído.";
              } else {
                action = fmtMonth ? `Dados recalculados · ${fmtMonth}` : "Dados recalculados.";
              }
            } else if (latestBatch && (!knownBatch || latestBatch.createdAt > (knownBatch?.createdAt ?? ""))) {
              // A newer batch appeared → import
              action = `Novo balancete importado · ${formatReferenceMonth(latestBatch.referenceMonth)}`;
            } else if (!latestBatch && knownBatch) {
              // Had batches, now none → all were deleted
              action = `Balancete de ${formatReferenceMonth(knownBatch.referenceMonth)} excluído.`;
            } else if (latestBatch && knownBatch && latestBatch.createdAt < knownBatch.createdAt) {
              // Latest batch is OLDER than known → the newest one was deleted
              action = `Balancete de ${formatReferenceMonth(knownBatch.referenceMonth)} excluído.`;
            } else {
              // Same batch but updatedAt changed → recalculate
              const fmtMonth = latestBatch ? formatReferenceMonth(latestBatch.referenceMonth) : null;
              action = fmtMonth ? `Dados recalculados · ${fmtMonth}` : "Dados da empresa foram atualizados.";
            }

            actionsMap.set(companyId, action);
            // Advance latestBatch baseline so next poll builds the right delta
            knownLatestBatches.current.set(companyId, latestBatch);
          }
        }

        if (newStaleIds.length > 0) {
          setStaleCompanyIds((prev) => [...new Set([...prev, ...newStaleIds])]);
          // Build names map: prefer loaded company data, fall back to allCompanies list
          const namesMap = new Map<string, string>();
          for (const c of companiesDataRef.current) namesMap.set(c.companyId, c.companyName);
          for (const c of allCompaniesRef.current) { if (!namesMap.has(c.id)) namesMap.set(c.id, c.name); }
          addNotifications(newStaleIds, namesMap, actionsMap);
        }
      } catch {
        // Polling errors are non-critical — silently skip this cycle
      }
    };

    const timer = setInterval(() => void poll(), pollInterval);
    return () => clearInterval(timer);
  }, [companyIds, pollInterval, addNotifications]);

  return {
    staleCompanyIds,
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    clearStale,
    refreshBaseline,
  };
}
