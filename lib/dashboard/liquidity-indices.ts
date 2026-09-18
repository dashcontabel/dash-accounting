export type LiquidityData = Record<string, number | null | undefined>;

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Liquidez Seca somente e aplicavel quando existe um valor de estoque positivo.
 * Estoque ausente, nulo, zero ou negativo nao pode ser tratado como zero, pois
 * isso faria o indicador repetir indevidamente a Liquidez Corrente.
 */
export function hasValidInventoryValue(data: LiquidityData): boolean {
  const inventory = data.ESTOQUES;
  return isFiniteNumber(inventory) && inventory > 0;
}

export function calculateDryLiquidity(data: LiquidityData): number | null {
  const currentAssets = data.ATIVO_CIRCULANTE;
  const currentLiabilities = data.PASSIVO_CIRCULANTE;
  const inventory = data.ESTOQUES;

  if (
    !isFiniteNumber(currentAssets)
    || !isFiniteNumber(currentLiabilities)
    || currentLiabilities === 0
    || !isFiniteNumber(inventory)
    || inventory <= 0
  ) {
    return null;
  }

  return (currentAssets - inventory) / currentLiabilities;
}
