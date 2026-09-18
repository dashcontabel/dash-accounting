import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { companyDataCache } from "@/lib/dashboard/cache";
import IndicesPage from "./page";

const pushMock = vi.fn();
const routerMock = { push: pushMock };

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/app/indices",
}));

describe("IndicesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    companyDataCache.clear();
  });

  it("keeps dry liquidity neutral when inventory is zero", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (url === "/api/auth/me") {
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue({
            user: {
              id: "indices-client",
              email: "indices@dashcontabil.com",
              role: "CLIENT",
              status: "ACTIVE",
            },
            allowedCompanies: [
              { id: "indices-company", name: "Empresa Índices", groupId: "g1" },
            ],
            activeCompanyId: "indices-company",
          }),
        });
      }

      if (url.startsWith("/api/dashboard/summary")) {
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue({
            companies: [
              {
                companyId: "indices-company",
                companyName: "Empresa Índices",
                lastUpdatedAt: "2026-07-31T00:00:00.000Z",
                summaries: [
                  {
                    referenceMonth: "2026-07",
                    dataJson: {
                      ATIVO_CIRCULANTE: 100,
                      PASSIVO_CIRCULANTE: 50,
                      ESTOQUES: 0,
                    },
                  },
                ],
              },
            ],
          }),
        });
      }

      return Promise.resolve({ ok: true, json: vi.fn().mockResolvedValue({}) });
    }));

    render(<IndicesPage />);

    const dryLiquidityLabel = (await screen.findAllByText("Liquidez Seca")).find(
      (element) => element.closest("article"),
    );
    expect(dryLiquidityLabel).toBeDefined();
    const dryLiquidityCard = dryLiquidityLabel!.closest("article");
    expect(dryLiquidityCard).not.toBeNull();
    await waitFor(() => {
      expect(dryLiquidityCard).toHaveClass("bg-zinc-50", "border-zinc-200");
      expect(within(dryLiquidityCard!).getByText("—")).toBeInTheDocument();
      expect(within(dryLiquidityCard!).getByText(/estoque ausente, zerado ou negativo/i)).toBeInTheDocument();
    });

    const currentLiquidityLabel = screen.getAllByText("Liquidez Corrente").find(
      (element) => element.closest("article"),
    );
    expect(currentLiquidityLabel).toBeDefined();
    const currentLiquidityCard = currentLiquidityLabel!.closest("article");
    await waitFor(() => {
      expect(within(currentLiquidityCard!).getByText("2,00")).toBeInTheDocument();
    });
  });
});
