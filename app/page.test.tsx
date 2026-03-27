import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Home from "./page";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const routerMock = { push: pushMock, refresh: refreshMock };

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/",
}));

describe("Home dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows company selector for ADMIN and saves active company", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/auth/me") {
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue({
            user: {
              id: "admin-id",
              email: "admin@dashcontabil.com",
              role: "ADMIN",
              status: "ACTIVE",
            },
            allowedCompanies: [
              { id: "c1", name: "Empresa 1", groupId: "g1" },
              { id: "c2", name: "Empresa 2", groupId: "g1" },
            ],
            activeCompanyId: "c1",
          }),
        });
      }

      if (url === "/api/context/active-company") {
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue({ success: true }),
        });
      }

      // /api/dashboard/summary - empty summaries
      return Promise.resolve({
        ok: true,
        json: vi.fn().mockResolvedValue({ summaries: [] }),
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    expect(await screen.findAllByText("admin@dashcontabil.com")).not.toHaveLength(0);
    const select = screen.getByLabelText("Empresa");
    fireEvent.change(select, { target: { value: "c2" } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/context/active-company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ companyId: "c2" }),
      });
    });
    expect(screen.getByText("Empresa padrão atualizada.")).toBeInTheDocument();
  });

  it("shows dashboard sections for CLIENT with single default company when data is available", async () => {
    const mockSummary = {
      FATURAMENTO: 114987.92,
      NFS_RECEBIDAS: 104041.76,
      RENDIMENTO_BRUTO: 16022.72,
      ALUGUEL: 0,
      LRA2_INVEST: 0, LRA3_INVEST: 0, B_VISTA_INVEST: 0, TRAPICHE_INVEST: 0,
      IMPOSTOS: 10946.16,
      IOF_IRRF: 0,
      LRA2_DESP: 0, LRA3_DESP: 0, B_VISTA_DESP: 0, TRAPICHE_DESP: 0,
      CONDOMINIO: 0,
      DISTRIB_LUCROS: 55000,
      DEMAIS_DESPESAS: 11675,
      SD_BANCARIO: 2136604.36,
      RENTABILIDADE: 16022.72,
      ALUGUEL_LIQUIDO: 0,
      RECEITAS_TOTAL: 130010.64,
      DESPESAS_TOTAL: 22621.16,
      RESULTADO: 107389.48,
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url === "/api/auth/me") {
          return Promise.resolve({
            ok: true,
            json: vi.fn().mockResolvedValue({
              user: {
                id: "client-id",
                email: "client@dashcontabil.com",
                role: "CLIENT",
                status: "ACTIVE",
              },
              allowedCompanies: [{ id: "c1", name: "Empresa 1", groupId: "g1" }],
              activeCompanyId: null,
            }),
          });
        }
        if (url === "/api/context/active-company") {
          return Promise.resolve({ ok: true, json: vi.fn().mockResolvedValue({}) });
        }
        // /api/dashboard/summary
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue({
            summaries: [{ referenceMonth: "2024-01", dataJson: mockSummary }],
          }),
        });
      }),
    );

    render(<Home />);

    expect(await screen.findAllByText("Receitas")).not.toHaveLength(0);
    expect(screen.getAllByText("Despesas")).not.toHaveLength(0);
    expect(screen.getByText("Saldos Bancários")).toBeInTheDocument();
  });
});
