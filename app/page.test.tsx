import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  it("shows multi-company selector for ADMIN and saves active company on single selection", async () => {
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

      if (url === "/api/dashboard/field-codes") {
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue({ fieldCodes: {} }),
        });
      }

      // /api/dashboard/summary - empty companies
      return Promise.resolve({
        ok: true,
        json: vi.fn().mockResolvedValue({ companies: [] }),
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    // Trigger button shows the initially selected company name
    const triggerBtn = await screen.findByRole("button", { name: "Empresa 1" });
    expect(triggerBtn).toBeInTheDocument();

    // Open the company-selection modal
    fireEvent.click(triggerBtn);

    // Both companies now appear as checkboxes inside the modal
    const c1Checkbox = screen.getByRole("checkbox", { name: "Empresa 1" });
    expect(c1Checkbox).toBeChecked();
    fireEvent.click(c1Checkbox); // uncheck Empresa 1 → draft=[]

    const c2Checkbox = screen.getByRole("checkbox", { name: "Empresa 2" });
    fireEvent.click(c2Checkbox); // check Empresa 2  → draft=["c2"]

    // Confirm changes in the modal
    const confirmBtn = screen.getByRole("button", { name: "Confirmar" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/context/active-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      PRO_LABORES: 7500,
      SD_BANCARIO: 2136604.36,
      RENTABILIDADE: 16022.72,
      ALUGUEL_LIQUIDO: 0,
      RECEITAS_TOTAL: 130010.64,
      DESPESAS_TOTAL: 22621.16,
      RESULTADO: 107389.48,
    };

    const fetchMock = vi.fn().mockImplementation((url: string) => {
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
        if (url === "/api/dashboard/field-codes") {
          return Promise.resolve({
            ok: true,
            json: vi.fn().mockResolvedValue({
              fieldCodes: {
                FATURAMENTO: ["4.1.1"],
                IMPOSTOS: ["3.2.2.03"],
                DEMAIS_DESPESAS: ["3"],
              },
            }),
          });
        }
        if (url.startsWith("/api/dashboard/tenants")) {
          return Promise.resolve({
            ok: true,
            json: vi.fn().mockResolvedValue({ hasTenantData: false }),
          });
        }
        if (url.startsWith("/api/dashboard/cost-centers")) {
          return Promise.resolve({
            ok: true,
            json: vi.fn().mockResolvedValue({ hasCostCenters: false }),
          });
        }
        if (url.startsWith("/api/dashboard/bank-balances")) {
          return Promise.resolve({
            ok: true,
            json: vi.fn().mockResolvedValue({
              companies: [
                {
                  companyId: "c1",
                  companyName: "Empresa 1",
                  referenceMonth: "2024-01",
                  total: 2136604.36,
                  accounts: [
                    {
                      accountCode: "1.1.1.02.001",
                      accountName: "Banco do Brasil",
                      balance: 2136604.36,
                    },
                  ],
                },
              ],
            }),
          });
        }
        // /api/dashboard/summary — returns new multi-company format
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue({
            companies: [
              {
                companyId: "c1",
                companyName: "Empresa 1",
                summaries: [{ referenceMonth: "2024-01", dataJson: mockSummary }],
              },
            ],
          }),
        });
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    const financialSummary = await screen.findByRole("region", { name: "Resumo financeiro" });

    expect(financialSummary).toHaveClass("flex", "flex-col");
    expect(financialSummary).not.toHaveClass("xl:grid-cols-2");

    expect(
      within(financialSummary).getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(["Receitas", "Saldos Bancários por Conta", "Despesas", "Investimentos e Resultado"]);

    expect(within(financialSummary).queryByText("Diferença entre NFs")).not.toBeInTheDocument();
    expect(await within(financialSummary).findByText("Banco do Brasil")).toBeInTheDocument();
    const bankBalanceSection = within(financialSummary)
      .getByRole("heading", { name: "Saldos Bancários por Conta" })
      .closest("section");
    expect(bankBalanceSection).not.toBeNull();
    expect(within(bankBalanceSection!).getByLabelText("Saldos Bancários por Conta: total"))
      .toHaveTextContent("R$ 2.136.604,36");
    expect(bankBalanceSection?.querySelector('[data-division-divider="true"]'))
      .toHaveClass("h-0.5", "rounded-full", "bg-blue-400/75");
    expect(within(financialSummary).getByLabelText("Receitas: total"))
      .toHaveTextContent("R$ 130.010,64");
    expect(within(financialSummary).getByLabelText("Despesas: total"))
      .toHaveTextContent("R$ 22.621,16");
    expect(within(financialSummary).getByLabelText("Investimentos e Resultado: total"))
      .toHaveTextContent("R$ 107.389,48");
    expect(within(financialSummary).getByText("Pró-labores")).toBeInTheDocument();
    expect(within(financialSummary).getByText("Distribuição de Lucros")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Faturamento × Despesas × Resultado" })).toBeInTheDocument();

    const context = screen.getByLabelText("Contexto da visualização");
    expect(within(context).getByText("Referência")).toHaveClass("font-bold", "uppercase");
    expect(within(context).getByText("Jan/2024")).toHaveClass("text-base", "sm:text-lg");

    const interactiveCard = within(financialSummary).getByText("Faturamento").closest("article");
    const detailIndicator = interactiveCard?.querySelector('[data-detail-indicator="true"]');

    expect(detailIndicator).toHaveClass("bg-zinc-600", "motion-safe:animate-pulse");
    expect(interactiveCard).toHaveTextContent("Detalhamento disponível");

    for (const label of ["Faturamento", "Rend. Líquidos", "Demais Despesas", "Banco do Brasil"]) {
      const card = within(financialSummary).getByText(label).closest("article");
      const value = card?.querySelectorAll("p")[1];

      expect(card).toHaveClass("relative", "overflow-hidden", "shadow-sm");
      expect(value).toHaveClass("text-2xl", "sm:text-3xl");
      expect(value).toHaveClass("tracking-tight", "tabular-nums");
    }

    fireEvent.click(within(financialSummary).getByText("Demais Despesas").closest("article")!);
    await waitFor(() => {
      const detailUrl = fetchMock.mock.calls
        .map(([url]) => String(url))
        .find((url) => url.startsWith("/api/dashboard/transactions?"));

      expect(detailUrl).toContain("accountCode=3");
      expect(detailUrl).toContain("excludeDashboardField=IMPOSTOS");
      expect(detailUrl).toContain("excludeDashboardField=IOF_IRRF");
    });
  });

  it("highlights the consolidation context and lets the user remove a company by its tag", async () => {
    const mockSummary = {
      FATURAMENTO: 100,
      NFS_RECEBIDAS: 90,
      RENDIMENTO_BRUTO: 10,
      ALUGUEL: 0,
      LRA2_INVEST: 0, LRA3_INVEST: 0, B_VISTA_INVEST: 0, TRAPICHE_INVEST: 0,
      IMPOSTOS: 5,
      IOF_IRRF: 20,
      LRA2_DESP: 0, LRA3_DESP: 0, B_VISTA_DESP: 0, TRAPICHE_DESP: 0,
      CONDOMINIO: 0,
      DISTRIB_LUCROS: 0,
      DEMAIS_DESPESAS: 5,
      PRO_LABORES: 0,
      SD_BANCARIO: 1000,
      RENTABILIDADE: -10,
      ALUGUEL_LIQUIDO: 0,
      RECEITAS_TOTAL: 110,
      DESPESAS_TOTAL: 30,
      RESULTADO: 80,
    };

    const companies = [
      { id: "tag-c1", name: "Empresa Alfa", groupId: "g1" },
      { id: "tag-c2", name: "Empresa Beta", groupId: "g1" },
    ];

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/auth/me") {
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue({
            user: { id: "admin-tags", email: "tags@dashcontabil.com", role: "ADMIN", status: "ACTIVE" },
            allowedCompanies: companies,
            activeCompanyId: "tag-c1",
          }),
        });
      }
      if (url === "/api/context/active-company") {
        return Promise.resolve({ ok: true, json: vi.fn().mockResolvedValue({ success: true }) });
      }
      if (url === "/api/dashboard/field-codes") {
        return Promise.resolve({ ok: true, json: vi.fn().mockResolvedValue({ fieldCodes: {} }) });
      }
      if (url.startsWith("/api/dashboard/tenants")) {
        return Promise.resolve({ ok: true, json: vi.fn().mockResolvedValue({ hasTenantData: false }) });
      }
      if (url.startsWith("/api/dashboard/cost-centers")) {
        return Promise.resolve({ ok: true, json: vi.fn().mockResolvedValue({ hasCostCenters: false }) });
      }
      if (url.startsWith("/api/dashboard/bank-balances")) {
        const requestedIds = new URL(url, "http://localhost").searchParams.getAll("companyId");
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue({
            companies: companies
              .filter((company) => requestedIds.includes(company.id))
              .map((company) => ({
                companyId: company.id,
                companyName: company.name,
                referenceMonth: "2026-04",
                total: 1000,
                accounts: [{
                  accountCode: `1.1.1.${company.id}`,
                  accountName: `Conta ${company.name}`,
                  balance: 1000,
                }],
              })),
          }),
        });
      }
      if (url.startsWith("/api/dashboard/summary")) {
        const requestedIds = new URL(url, "http://localhost").searchParams.getAll("companyId");
        return Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue({
            companies: companies
              .filter((company) => requestedIds.includes(company.id))
              .map((company) => ({
                companyId: company.id,
                companyName: company.name,
                summaries: [{ referenceMonth: "2026-04", dataJson: mockSummary }],
              })),
          }),
        });
      }
      return Promise.resolve({ ok: true, json: vi.fn().mockResolvedValue({}) });
    });

    vi.stubGlobal("fetch", fetchMock);
    render(<Home />);

    fireEvent.click(await screen.findByRole("button", { name: "Empresa Alfa" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Empresa Beta" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("2 empresas")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Contexto da visualização")).getByText("Consolidado")).toBeInTheDocument();
    expect(await screen.findByLabelText("Saldos Bancários por Conta: total"))
      .toHaveTextContent("R$ 2.000,00");
    const negativeNetYieldCard = screen.getByText("Rend. Líquidos").closest("article");
    expect(negativeNetYieldCard).toHaveClass("border-red-200/80");
    const negativeNetYieldValue = negativeNetYieldCard?.querySelector("p[title]");
    expect(negativeNetYieldValue).toHaveClass("text-red-700");
    expect(negativeNetYieldValue).toHaveTextContent(/-R\$\s*20,00/);
    expect(negativeNetYieldCard?.querySelector('[data-kpi-icon="true"]'))
      .toHaveClass("text-red-600");
    expect(negativeNetYieldCard?.querySelector('[data-kpi-icon="true"] path'))
      .toHaveAttribute("d", "M13 17h8m0 0V9m0 8-8-8-4 4-6-6");

    const alphaTag = screen.getByRole("button", { name: "Remover Empresa Alfa da consolidação" });
    const betaTag = screen.getByRole("button", { name: "Remover Empresa Beta da consolidação" });
    expect(alphaTag).toBeInTheDocument();
    expect(betaTag).toBeInTheDocument();

    fireEvent.click(betaTag);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Remover Empresa Beta da consolidação" })).not.toBeInTheDocument();
      expect(screen.getByText("Referência")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/context/active-company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: "tag-c1" }),
    });
  });
});
