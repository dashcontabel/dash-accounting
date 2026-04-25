import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  consumeActionHint,
  consumeStaleCompanyIds,
  markCompanyStale,
  setActionHint,
} from "./cache";

// ── helpers ───────────────────────────────────────────────────────────────────

function localStorageMock() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((k: string) => store[k] ?? null),
    setItem: vi.fn((k: string, v: string) => { store[k] = v; }),
    removeItem: vi.fn((k: string) => { delete store[k]; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
    clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k]; }),
    _store: store,
  };
}

function sessionStorageMock() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((k: string) => store[k] ?? null),
    setItem: vi.fn((k: string, v: string) => { store[k] = v; }),
    removeItem: vi.fn((k: string) => { delete store[k]; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
    clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k]; }),
    _store: store,
  };
}

// ── Action hint ───────────────────────────────────────────────────────────────

describe("setActionHint / consumeActionHint", () => {
  let ls: ReturnType<typeof localStorageMock>;

  beforeEach(() => {
    ls = localStorageMock();
    Object.defineProperty(globalThis, "localStorage", { value: ls, writable: true, configurable: true });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("stores and retrieves an import hint", () => {
    setActionHint("c1", { action: "import", referenceMonth: "2026-03" });
    const hint = consumeActionHint("c1");
    expect(hint).toEqual({ action: "import", referenceMonth: "2026-03" });
  });

  it("stores and retrieves a delete hint", () => {
    setActionHint("c2", { action: "delete", referenceMonth: "2026-01" });
    const hint = consumeActionHint("c2");
    expect(hint).toEqual({ action: "delete", referenceMonth: "2026-01" });
  });

  it("stores and retrieves a recalculate hint", () => {
    setActionHint("c3", { action: "recalculate", referenceMonth: "2025-12" });
    const hint = consumeActionHint("c3");
    expect(hint).toEqual({ action: "recalculate", referenceMonth: "2025-12" });
  });

  it("removes the hint after consuming it (consume-once semantics)", () => {
    setActionHint("c1", { action: "import", referenceMonth: "2026-03" });
    consumeActionHint("c1");
    const second = consumeActionHint("c1");
    expect(second).toBeNull();
  });

  it("returns null when no hint exists", () => {
    expect(consumeActionHint("unknown-company")).toBeNull();
  });

  it("returns null when hint has expired (> 10 minutes old)", () => {
    vi.setSystemTime(new Date("2026-04-25T10:00:00Z"));
    setActionHint("c1", { action: "import", referenceMonth: "2026-03" });
    // Advance past the 10-minute TTL
    vi.advanceTimersByTime(11 * 60 * 1000);
    const hint = consumeActionHint("c1");
    expect(hint).toBeNull();
  });

  it("returns the hint when consumed within the TTL window", () => {
    vi.setSystemTime(new Date("2026-04-25T10:00:00Z"));
    setActionHint("c1", { action: "import", referenceMonth: "2026-03" });
    vi.advanceTimersByTime(9 * 60 * 1000); // 9 minutes — still valid
    const hint = consumeActionHint("c1");
    expect(hint).not.toBeNull();
    expect(hint?.action).toBe("import");
  });

  it("does not throw when localStorage is unavailable", () => {
    ls.setItem.mockImplementation(() => { throw new Error("quota exceeded"); });
    expect(() => setActionHint("c1", { action: "import", referenceMonth: "2026-01" })).not.toThrow();
  });

  it("returns null without throwing when localStorage.getItem throws", () => {
    ls.getItem.mockImplementation(() => { throw new Error("access denied"); });
    expect(() => consumeActionHint("c1")).not.toThrow();
    expect(consumeActionHint("c1")).toBeNull();
  });
});

// ── Stale markers ─────────────────────────────────────────────────────────────

describe("markCompanyStale / consumeStaleCompanyIds", () => {
  let ss: ReturnType<typeof sessionStorageMock>;

  beforeEach(() => {
    ss = sessionStorageMock();
    Object.defineProperty(globalThis, "sessionStorage", { value: ss, writable: true, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("marks a company as stale and returns its ID on consume", () => {
    markCompanyStale("c1");
    const ids = consumeStaleCompanyIds();
    expect(ids).toContain("c1");
  });

  it("clears stale markers after consuming", () => {
    markCompanyStale("c1");
    consumeStaleCompanyIds();
    const ids = consumeStaleCompanyIds();
    expect(ids).toHaveLength(0);
  });

  it("returns multiple stale IDs when several companies are marked", () => {
    markCompanyStale("c1");
    markCompanyStale("c2");
    markCompanyStale("c3");
    const ids = consumeStaleCompanyIds();
    expect(ids).toHaveLength(3);
    expect(ids).toEqual(expect.arrayContaining(["c1", "c2", "c3"]));
  });

  it("returns empty array when nothing is stale", () => {
    expect(consumeStaleCompanyIds()).toHaveLength(0);
  });

  it("does not throw when sessionStorage is unavailable", () => {
    ss.setItem.mockImplementation(() => { throw new Error("unavailable"); });
    expect(() => markCompanyStale("c1")).not.toThrow();
  });
});
