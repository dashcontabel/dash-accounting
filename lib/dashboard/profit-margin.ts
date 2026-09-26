export type ProfitMarginData = Record<string, number | null | undefined>;

function finiteOrZero(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Margem de lucro do dashboard: resultado dividido pelas receitas consideradas
 * no periodo. Campos de receita ausentes nao entram na soma e uma base de
 * receitas zerada deixa o indicador indisponivel.
 */
export function calculateProfitMargin(data: ProfitMarginData): number | null {
  const result = data.RESULTADO;

  if (typeof result !== "number" || !Number.isFinite(result)) {
    return null;
  }

  const revenue =
    finiteOrZero(data.FATURAMENTO)
    + finiteOrZero(data.RENDIMENTO_BRUTO)
    + finiteOrZero(data.ALUGUEL);

  if (revenue === 0) return null;

  const margin = result / revenue;
  return Number.isFinite(margin) ? margin : null;
}
