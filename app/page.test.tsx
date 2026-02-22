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

      return Promise.resolve({
        ok: false,
        json: vi.fn().mockResolvedValue({}),
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    expect(await screen.findByText("Logado como admin@dashcontabil.com.")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Definir como empresa padrao"));
    const select = screen.getByLabelText("Empresa ativa");
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
    expect(screen.getByText("Empresa padrao atualizada.")).toBeInTheDocument();
  });

  it("shows mocked dashboard data for CLIENT with single default company", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
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
      }),
    );

    render(<Home />);

    expect(await screen.findByText("Saldo")).toBeInTheDocument();
    expect(screen.getByText("Demonstrativo (Tabela)")).toBeInTheDocument();
  });
});
