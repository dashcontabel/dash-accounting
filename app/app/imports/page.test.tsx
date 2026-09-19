import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ImportsPage from "./page";

const routerMock = { push: vi.fn(), refresh: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("@/app/components/app-shell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/app/components/confirm-toast", () => ({ confirmToast: vi.fn() }));
vi.mock("@/lib/dashboard/cache", () => ({ markCompanyStale: vi.fn(), setActionHint: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { loading: vi.fn(() => "upload-toast"), success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

function json(data: unknown) {
  return { ok: true, json: async () => data };
}

function batch(id: string, fileName: string) {
  return {
    id,
    fileName,
    referenceMonth: "2026-08",
    sourceType: "XLSX",
    status: "DONE",
    totalRows: 18,
    processedRows: 18,
    lastError: null,
    createdAt: "2026-09-19T12:00:00.000Z",
  };
}

describe("ImportsPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/auth/me") {
        return Promise.resolve(json({
          user: { id: "u1", role: "ADMIN", email: "admin@example.com" },
          allowedCompanies: [{ id: "c1", name: "Empresa A" }, { id: "c2", name: "Empresa B" }],
          activeCompanyId: "c1",
        }));
      }
      if (url === "/api/imports?companyId=c1") return Promise.resolve(json({ batches: [batch("a1", "Balancete A.xls")] }));
      if (url === "/api/imports?companyId=c2") return Promise.resolve(json({ batches: [batch("b1", "Balancete B.xls")] }));
      if (url === "/api/imports/xlsx") return Promise.resolve(json({ batchId: "a2", idempotent: false, summary: { SALDO: 100 } }));
      throw new Error(`Unexpected request: ${url}`);
    });
  });

  it("uses the file period by default and sends a manual period only when selected", async () => {
    render(<ImportsPage />);
    await screen.findByText("Balancete A.xls");

    const fileInput = screen.getByLabelText("Selecionar arquivo para importação");
    fireEvent.change(fileInput, { target: { files: [new File(["xls"], "Balancete.xls", { type: "application/vnd.ms-excel" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Importar arquivo" }));

    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url === "/api/imports/xlsx")).toHaveLength(1));
    const automaticBody = fetchMock.mock.calls.find(([url]) => url === "/api/imports/xlsx")![1].body as FormData;
    expect(automaticBody.get("companyId")).toBe("c1");
    expect(automaticBody.get("referenceMonth")).toBeNull();

    await waitFor(() => expect(screen.getByRole("button", { name: "Importar arquivo" })).toBeDisabled());
    fireEvent.click(screen.getByLabelText("Informar manualmente"));
    fireEvent.change(screen.getByLabelText("Mês de referência manual"), { target: { value: "2026-07" } });
    fireEvent.change(screen.getByLabelText("Selecionar arquivo para importação"), { target: { files: [new File(["xls"], "Julho.xls")] } });
    fireEvent.click(screen.getByRole("button", { name: "Importar arquivo" }));

    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url === "/api/imports/xlsx")).toHaveLength(2));
    const manualBody = fetchMock.mock.calls.filter(([url]) => url === "/api/imports/xlsx")[1]![1].body as FormData;
    expect(manualBody.get("referenceMonth")).toBe("2026-07");
  });

  it("reloads history for the selected company", async () => {
    render(<ImportsPage />);
    await screen.findByText("Balancete A.xls");

    fireEvent.change(screen.getByLabelText("Empresa"), { target: { value: "c2" } });

    expect(await screen.findByText("Balancete B.xls")).toBeInTheDocument();
    expect(screen.queryByText("Balancete A.xls")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/imports?companyId=c2", { cache: "no-store" });
  });

  it("keeps the selected file and shows a validation error next to the form", async () => {
    const regularFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string) => url === "/api/imports/xlsx"
      ? Promise.resolve({ ok: false, json: async () => ({ error: "Período do arquivo inválido." }) })
      : regularFetch(url));

    render(<ImportsPage />);
    await screen.findByText("Balancete A.xls");
    fireEvent.change(screen.getByLabelText("Selecionar arquivo para importação"), { target: { files: [new File(["xls"], "Balancete.xls")] } });
    fireEvent.click(screen.getByRole("button", { name: "Importar arquivo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Período do arquivo inválido.");
    expect(screen.getByLabelText("Selecionar arquivo para importação")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importar arquivo" })).toBeEnabled();
  });

  it("reports each imported competence from a multi-month Razão in batch mode", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/auth/me") return Promise.resolve(json({ user: { id: "u1", role: "ADMIN", email: "admin@example.com" }, allowedCompanies: [{ id: "c1", name: "Empresa A" }], activeCompanyId: "c1" }));
      if (url === "/api/imports?companyId=c1") return Promise.resolve(json({ batches: [] }));
      if (url === "/api/imports/xlsx") return Promise.resolve(json({ sourceType: "RAZAO", months: ["2026-07", "2026-08"], results: [
        { referenceMonth: "2026-07", batchId: "r1", idempotent: false },
        { referenceMonth: "2026-08", batchId: "r2", idempotent: false },
      ] }));
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<ImportsPage />);
    await screen.findByText("Nenhuma importação registrada");
    fireEvent.click(screen.getByRole("tab", { name: /Lote/ }));
    fireEvent.change(screen.getByLabelText("Selecionar arquivos para importação em lote"), { target: { files: [new File(["xls"], "Razão.xls")] } });
    fireEvent.click(screen.getByRole("button", { name: "Importar lote" }));

    expect(await screen.findByText(/2 competências importadas/)).toBeInTheDocument();
    expect(screen.getByText("Concluído")).toBeInTheDocument();
    const body = fetchMock.mock.calls.find(([url]) => url === "/api/imports/xlsx")![1].body as FormData;
    expect(body.get("referenceMonth")).toBeNull();
  });
});
