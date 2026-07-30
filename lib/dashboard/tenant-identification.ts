const KNOWN_TENANTS = [
  "Barbara",
  "Magna (Reuse)",
  "Daniela",
  "Silvia",
  "Evelyn/Ivson",
  "Gabriel",
  "Thais",
  "Pedro",
  "Cleyde/Carlos",
] as const;

const TENANT_ALIASES: Record<string, string[]> = {
  "Magna (Reuse)": ["Magna", "Magna Reuse", "Magna (Reuse)"],
  "Evelyn/Ivson": ["Evelyn/Ivson", "Evelyn / Ivson", "Evelyn", "Ivson"],
  "Cleyde/Carlos": ["Cleyde/Carlos", "Cleyde / Carlos", "Cleyde", "Carlos"],
};

const SKIP_SURNAME_WORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "na",
  "no",
  "a",
  "o",
]);

export function normalizeTenantText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function normalizeTenantKey(value: string) {
  return normalizeTenantText(value).replace(/[^a-z0-9]/g, "");
}

export function matchTenant(description: string): string | null {
  const norm = normalizeTenantText(description);
  const looseNorm = normalizeTenantKey(description);

  for (const tenant of KNOWN_TENANTS) {
    const aliases = TENANT_ALIASES[tenant] ?? [tenant];
    for (const alias of aliases) {
      const aliasNorm = normalizeTenantText(alias);
      const aliasLoose = normalizeTenantKey(alias);
      if (norm.includes(aliasNorm) || looseNorm.includes(aliasLoose)) {
        return tenant;
      }
    }
  }

  return null;
}

function extractDisplayName(description: string, canonicalFirst: string): string {
  if (canonicalFirst.includes("/") || canonicalFirst.includes("(")) {
    return canonicalFirst;
  }

  const words = description.trim().split(/\s+/);
  const normFirst = normalizeTenantText(canonicalFirst);
  const knownNorms = (KNOWN_TENANTS as readonly string[]).map(normalizeTenantText);

  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    const cleanedFirst = word.split(/[\/-]/)[0]!.trim();
    if (!normalizeTenantText(cleanedFirst).includes(normFirst)) continue;

    let surname = "";
    if (i + 1 < words.length) {
      const next = words[i + 1]!;
      const normNext = normalizeTenantText(next);
      const isAlphaOnly = /^[\p{L}]+$/u.test(next);
      const isPrep = SKIP_SURNAME_WORDS.has(normNext);
      const isKnownFirst = knownNorms.some((known) => normNext.includes(known));

      if (isAlphaOnly && !isPrep && !isKnownFirst) surname = next;
    }

    const parts = surname ? [cleanedFirst, surname] : [cleanedFirst];
    return parts.join(" ").toUpperCase();
  }

  return canonicalFirst.toUpperCase();
}

function inferTenantFromRentDescription(description: string): string | null {
  const words = description.trim().split(/\s+/);
  const keywordIndex = words.findIndex((word) => {
    const normalized = normalizeTenantText(word);
    return (
      normalized === "aluguel" ||
      normalized === "aluguei" ||
      normalized === "condominio" ||
      normalized === "acordo"
    );
  });

  if (keywordIndex < 0 || keywordIndex + 1 >= words.length) return null;

  const tenantWords: string[] = [];
  for (const word of words.slice(keywordIndex + 1)) {
    const cleaned = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}\/-]+$/gu, "");
    const normalized = normalizeTenantText(cleaned);

    if (!cleaned || normalized === "adm") continue;
    if (/^\d{1,2}\/\d{4}$/.test(cleaned) || /^\d{4}$/.test(cleaned)) break;

    tenantWords.push(cleaned);
  }

  const tenantName = tenantWords
    .join(" ")
    .replace(/[^\p{L}\p{N}\s\/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return tenantName.length >= 2 ? tenantName.toUpperCase() : null;
}

export function resolveTenantFromDescription(description: string) {
  const knownTenant = matchTenant(description);
  if (knownTenant) {
    return {
      key: knownTenant,
      displayName: extractDisplayName(description, knownTenant),
    };
  }

  const inferredTenant = inferTenantFromRentDescription(description);
  if (!inferredTenant) return null;

  return {
    key: `inferred:${normalizeTenantKey(inferredTenant)}`,
    displayName: inferredTenant,
  };
}

export function tenantDisplayKey(value: string) {
  return normalizeTenantKey(value) || "locatariosemnome";
}
