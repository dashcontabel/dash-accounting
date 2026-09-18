import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CostCenterSection from "./cost-center-section";

describe("CostCenterSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the neutral animated indicator on cards with drill-down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          hasCostCenters: true,
          referenceMonth: "2026-07",
          companyId: "company-1",
          items: [
            {
              costCenter: "Condomínio",
              totalDebit: 19_156.17,
              totalCredit: 31_580.9,
              accountCount: 15,
            },
          ],
        }),
      }),
    );

    render(<CostCenterSection companyId="company-1" referenceMonth="2026-07" />);

    const card = (await screen.findByText("Condomínio")).closest("article");
    const indicator = card?.querySelector('[data-detail-indicator="true"]');
    const icon = indicator?.querySelector("svg");

    expect(card).not.toBeNull();
    expect(indicator).toHaveClass("bg-zinc-600", "motion-safe:animate-pulse");
    expect(indicator).toHaveClass("dark:bg-zinc-300", "dark:text-zinc-900");
    expect(icon).toHaveClass(
      "motion-safe:group-hover:-rotate-12",
      "motion-safe:group-hover:scale-125",
      "motion-reduce:transition-none",
    );
    expect(card).toHaveTextContent("Detalhamento disponível");
  });
});
