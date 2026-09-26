type CompanyLabelSource = {
  name: string;
};

const DEFAULT_LABELS = {
  billing: "Faturamento",
  receivedInvoices: "NFs Recebidas",
} as const;

const PLACA_LABELS = {
  billing: "Previsão",
  receivedInvoices: "Recebido",
} as const;

function normalizeCompanyName(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}

export function getRevenueCardLabels(companies: CompanyLabelSource[]) {
  if (companies.length !== 1) return DEFAULT_LABELS;

  const companyName = normalizeCompanyName(companies[0]?.name ?? "");
  const isPlaca = companyName === "PLACA" || companyName.startsWith("PLACA ");

  return isPlaca ? PLACA_LABELS : DEFAULT_LABELS;
}
