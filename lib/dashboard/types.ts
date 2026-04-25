import type { MonthlySummary } from "./periods";

export type CompanyData = {
  companyId: string;
  companyName: string;
  summaries: MonthlySummary[];
  /** ISO string of the most recent updatedAt across all monthly summaries for this company. */
  lastUpdatedAt: string | null;
};
