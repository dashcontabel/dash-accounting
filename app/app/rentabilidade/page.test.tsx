import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RentabilidadePage from "./page";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const routerMock = { push: pushMock, refresh: refreshMock };

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/app/rentabilidade",
}));

describe("RentabilidadePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows mapped accounts followed by the company total", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url === "/api/auth/me") {
          return Promise.resolve({
            ok: true,
            json: vi.fn().mockResolvedValue({
              user: {
                id: "rent-user",
                email: "rentabilidade@dashcontabil.com",
                name: null,
                role: "CLIENT",
                status: "ACTIVE",
              },
              allowedCompanies: [{ id: "rent-c1", name: "Empresa Rentavel", groupId: "g1" }],
              activeCompanyId: "rent-c1",
            }),
          });
        }

        if (url.startsWith("/api/dashboard/summary")) {
          return Promise.resolve({
            ok: true,
            json: vi.fn().mockResolvedValue({
              companies: [
                {
                  companyId: "rent-c1",
                  companyName: "Empresa Rentavel",
                  lastUpdatedAt: null,
                  summaries: [
                    { referenceMonth: "2025-12", dataJson: { SD_BANCARIO: 1000 } },
                    {
                      referenceMonth: "2026-01",
                      dataJson: {
                        SD_BANCARIO: 985,
                        RENDIMENTO_BRUTO: 100,
                        IOF_IRRF: 115,
                        RENTABILIDADE: -15,
                      },
                    },
                  ],
                },
              ],
            }),
          });
        }

        if (url.startsWith("/api/dashboard/rentabilidade-accounts")) {
          return Promise.resolve({
            ok: true,
            json: vi.fn().mockResolvedValue({
              companies: [
                {
                  companyId: "rent-c1",
                  accounts: [
                    {
                      accountCode: "3.2.2.05.004",
                      accountName: "IRRF sobre rendimentos",
                      months: {
                        "2026-01": { grossYield: 0, taxWithheld: 115, netYield: -115 },
                      },
                    },
                    {
                      accountCode: "4.1.3.01",
                      accountName: "Rendimentos de aplicacoes",
                      months: {
                        "2026-01": { grossYield: 100, taxWithheld: 0, netYield: 100 },
                      },
                    },
                  ],
                },
              ],
            }),
          });
        }

        return Promise.resolve({ ok: true, json: vi.fn().mockResolvedValue({}) });
      }),
    );

    render(<RentabilidadePage />);

    expect(await screen.findByRole("columnheader", { name: "Conta contabil" })).toBeInTheDocument();
    expect(screen.getAllByText("Empresa Rentavel")).not.toHaveLength(0);
    expect(await screen.findByText("2 contas mapeadas")).toBeInTheDocument();

    const incomeRow = (await screen.findByText("4.1.3.01")).closest("tr");
    const taxRow = screen.getByText("3.2.2.05.004").closest("tr");
    expect(incomeRow).not.toBeNull();
    expect(taxRow).not.toBeNull();
    expect(within(incomeRow!).getByText("Rendimentos de aplicacoes")).toBeInTheDocument();
    expect(within(incomeRow!).getAllByText("R$ 100,00")).not.toHaveLength(0);
    expect(within(taxRow!).getAllByText("-R$ 115,00")).not.toHaveLength(0);
    expect(screen.getByText("Total da empresa")).toBeInTheDocument();
    expect(screen.queryByText("Total consolidado")).not.toBeInTheDocument();

    const netYieldCard = screen.getByText("Rentab. liquida").closest("article");
    expect(netYieldCard).toHaveAttribute("data-summary-tone", "red");
    expect(netYieldCard).toHaveClass("relative", "min-h-[8.25rem]", "sm:min-h-[9.5rem]", "overflow-hidden", "shadow-sm");
    expect(netYieldCard?.querySelector("p[title]")).toHaveTextContent(/-R\$\s*15,00/);
    expect(netYieldCard?.querySelector("p[title]")).toHaveClass("text-red-700", "tabular-nums");
    expect(netYieldCard?.querySelector('[data-summary-icon="true"]')).toHaveClass("text-red-600");
    expect(netYieldCard?.querySelector('[data-summary-icon="true"] path'))
      .toHaveAttribute("d", "M13 17h8m0 0V9m0 8-8-8-4 4-6-6");
    expect(within(netYieldCard!).getByText("Resultado liquido negativo")).toBeInTheDocument();

    for (const label of ["Rendimento bruto", "IOF / IRRF", "Saldo final"]) {
      expect(screen.getByText(label).closest("article"))
        .toHaveClass("relative", "min-h-[8.25rem]", "sm:min-h-[9.5rem]", "overflow-hidden", "shadow-sm");
    }

    expect(screen.getByRole("columnheader", { name: "Conta contabil" }))
      .toHaveClass("w-36", "sm:w-64");
    expect(within(incomeRow!).getByRole("rowheader"))
      .toHaveClass("w-36", "sm:w-64");
  });
});
