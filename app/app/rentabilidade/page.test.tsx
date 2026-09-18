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
                        SD_BANCARIO: 1085,
                        RENDIMENTO_BRUTO: 100,
                        IOF_IRRF: 15,
                        RENTABILIDADE: 85,
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
                        "2026-01": { grossYield: 0, taxWithheld: 15, netYield: -15 },
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
    expect(within(taxRow!).getAllByText("-R$ 15,00")).not.toHaveLength(0);
    expect(screen.getByText("Total da empresa")).toBeInTheDocument();
    expect(screen.queryByText("Total consolidado")).not.toBeInTheDocument();
  });
});
