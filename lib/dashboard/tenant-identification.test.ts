import { describe, expect, it } from "vitest";

import {
  matchTenant,
  resolveTenantFromDescription,
  tenantDisplayKey,
} from "./tenant-identification";

describe("tenant identification", () => {
  it("infers tenant names from rent descriptions without keeping competency suffixes", () => {
    expect(resolveTenantFromDescription("CONDOMINIO AGIL ARQUITETURA 01/2026")).toEqual({
      key: "inferred:agilarquitetura",
      displayName: "AGIL ARQUITETURA",
    });
  });

  it("keeps known tenant aliases canonical", () => {
    expect(matchTenant("VR REF A ALUGUEL EVELYN / IVSON")).toBe("Evelyn/Ivson");
  });

  it("normalizes display keys for persisted parametrization", () => {
    expect(tenantDisplayKey("THAIS PSICÓLOGA")).toBe("thaispsicologa");
  });
});
