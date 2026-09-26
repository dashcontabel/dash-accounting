import { describe, expect, it } from "vitest";

import { calculateProfitMargin } from "./profit-margin";

describe("profit margin", () => {
  it("divides the result by the available revenue fields", () => {
    expect(calculateProfitMargin({
      FATURAMENTO: 100,
      RENDIMENTO_BRUTO: 20,
      ALUGUEL: 10,
      RESULTADO: 50,
    })).toBeCloseTo(50 / 130);
  });

  it("ignores revenue fields that are not available", () => {
    expect(calculateProfitMargin({
      FATURAMENTO: 75,
      RESULTADO: 50,
    })).toBeCloseTo(50 / 75);
  });

  it.each([null, undefined, Number.NaN])(
    "does not calculate when result is %s",
    (result) => {
      expect(calculateProfitMargin({
        FATURAMENTO: 100,
        RESULTADO: result,
      })).toBeNull();
    },
  );

  it("returns zero percent when the result is zero", () => {
    expect(calculateProfitMargin({
      FATURAMENTO: 100,
      RESULTADO: 0,
    })).toBe(0);
  });

  it("does not calculate when the revenue base is zero", () => {
    expect(calculateProfitMargin({
      FATURAMENTO: 0,
      RENDIMENTO_BRUTO: 0,
      ALUGUEL: 0,
      RESULTADO: 50,
    })).toBeNull();
  });

  it("preserves the sign when the result is negative", () => {
    expect(calculateProfitMargin({
      FATURAMENTO: 100,
      RESULTADO: -50,
    })).toBe(-0.5);
  });

  it("does not expose an infinite percentage", () => {
    expect(calculateProfitMargin({
      FATURAMENTO: Number.MIN_VALUE,
      RESULTADO: Number.MAX_VALUE,
    })).toBeNull();
  });
});
