import { describe, expect, it } from "vitest";

import {
  calculateDryLiquidity,
  hasValidInventoryValue,
} from "./liquidity-indices";

describe("dry liquidity", () => {
  it("calculates the ratio when inventory is positive", () => {
    const data = {
      ATIVO_CIRCULANTE: 120,
      ESTOQUES: 20,
      PASSIVO_CIRCULANTE: 50,
    };

    expect(hasValidInventoryValue(data)).toBe(true);
    expect(calculateDryLiquidity(data)).toBe(2);
  });

  it.each([
    ["absent", undefined],
    ["null", null],
    ["zero", 0],
    ["negative", -10],
  ])("does not calculate when inventory is %s", (_label, inventory) => {
    const data = {
      ATIVO_CIRCULANTE: 100,
      ESTOQUES: inventory,
      PASSIVO_CIRCULANTE: 50,
    };

    expect(hasValidInventoryValue(data)).toBe(false);
    expect(calculateDryLiquidity(data)).toBeNull();
  });

  it("does not calculate when current liabilities are zero", () => {
    expect(calculateDryLiquidity({
      ATIVO_CIRCULANTE: 100,
      ESTOQUES: 10,
      PASSIVO_CIRCULANTE: 0,
    })).toBeNull();
  });
});
