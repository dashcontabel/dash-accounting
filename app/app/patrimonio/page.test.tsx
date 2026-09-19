import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PatrimonioPage from "./page";

const routerMock = { push: vi.fn(), refresh: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/app/patrimonio",
}));

describe("PatrimonioPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (url === "/api/auth/me") {
        return Promise.resolve({ json: async () => ({ user: { id: "u1", role: "CLIENT", email: "cliente@example.com" } }) });
      }
      if (url === "/api/groups") {
        return Promise.resolve({ json: async () => ({ groups: [{ id: "g1", name: "Grupo", isActive: true }] }) });
      }
      if (url.startsWith("/api/patrimonio/months")) {
        return Promise.resolve({ json: async () => ({ months: ["2026-08"] }) });
      }
      if (url.startsWith("/api/patrimonio?")) {
        return Promise.resolve({ json: async () => ({ assets: [
          { id: "s1", groupId: "g1", sectionId: null, referenceMonth: "2026-08", label: "Patrimônio Produzido", sublabel: null, rowType: "SECTION", economico: null, financeiro: null, sortOrder: 0 },
          { id: "a1", groupId: "g1", sectionId: "s1", referenceMonth: "2026-08", label: "APLICAÇÕES BANCO DO BRASIL", sublabel: null, rowType: "ASSET", economico: null, financeiro: "2694740.19", sortOrder: 1 },
          { id: "t1", groupId: "g1", sectionId: null, referenceMonth: "2026-08", label: "Total do Patrimônio", sublabel: null, rowType: "TOTAL", economico: null, financeiro: "2694740.19", sortOrder: 2 },
        ] }) });
      }
      throw new Error(`Unexpected request: ${url}`);
    }));
  });

  it("shows observable KPIs and gives mobile asset values their own space", async () => {
    render(<PatrimonioPage />);

    const mobileAsset = (await screen.findAllByText("APLICAÇÕES BANCO DO BRASIL"))[0]!.closest("div.rounded-2xl");
    const producedCard = screen.getAllByText("Patrimônio Produzido")[0]!.closest("article");
    expect(producedCard).toHaveClass("relative", "overflow-hidden", "shadow-sm");
    expect(producedCard).toHaveAttribute("data-summary-tone", "emerald");

    expect(mobileAsset).not.toBeNull();
    const values = mobileAsset!.querySelector<HTMLElement>("div.grid");
    expect(values).toHaveClass("grid-cols-2", "sm:grid-cols-3");
    expect(within(values!).getByText("Total").parentElement)
      .toHaveClass("col-span-2", "sm:col-span-1");
    expect(within(values!).getAllByText(/R\$\s*2\.694\.740,19/)).toHaveLength(2);
  });
});
