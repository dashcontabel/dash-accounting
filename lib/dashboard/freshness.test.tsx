import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDashboardFreshness } from "./freshness";

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

function successResponse() {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({ companies: [] }),
  };
}

describe("useDashboardFreshness polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps one stable timer and polls only the selected company IDs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse());
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = renderHook(
      ({ companyIds }) => useDashboardFreshness({
        companyIds,
        companiesData: [],
        allCompanies: [],
        pollInterval: 30_000,
      }),
      { initialProps: { companyIds: ["selected-company"] } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    rerender({ companyIds: ["selected-company"] });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/dashboard/freshness?companyId=selected-company",
    );
  });

  it("pauses while hidden and polls immediately when the tab becomes visible", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    const fetchMock = vi.fn().mockResolvedValue(successResponse());
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useDashboardFreshness({
      companyIds: ["company-1"],
      companiesData: [],
      pollInterval: 30_000,
    }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      setVisibility("visible");
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      setVisibility("hidden");
      await vi.advanceTimersByTimeAsync(90_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not overlap polls when a request is still in flight", async () => {
    let resolveFirstRequest: ((value: ReturnType<typeof successResponse>) => void) | undefined;
    const firstRequest = new Promise<ReturnType<typeof successResponse>>((resolve) => {
      resolveFirstRequest = resolve;
    });
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => firstRequest)
      .mockResolvedValue(successResponse());
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useDashboardFreshness({
      companyIds: ["company-1"],
      companiesData: [],
      pollInterval: 30_000,
    }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirstRequest?.(successResponse());
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
