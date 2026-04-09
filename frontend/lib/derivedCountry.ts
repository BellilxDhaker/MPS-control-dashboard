export type RiskBuckets = {
  red: number;
  orange: number;
  yellow: number;
  white: number;
};

export type ResourceRiskRow = RiskBuckets & {
  resourceOnProduct: string;
};

export type CountryInsight = RiskBuckets & {
  code: string;
  country: string;
  total: number;
};

const COUNTRY_MAP: Record<string, string> = {
  // North Africa
  TN: "Tunisia",
  MA: "Morocco",
  EG: "Egypt",

  // Americas
  MX: "Mexico",
  PY: "Paraguay",
  BR: "Brazil",

  // Europe
  RO: "Romania",
  SK: "Slovakia",
  RS: "Serbia",
  UA: "Ukraine",
  PT: "Portugal",
  BG: "Bulgaria",

  // Asia
  CN: "China",
};

function extractCountryCode(resourceOnProduct: string): string {
  if (!resourceOnProduct) return "";

  // Pattern 1: Look for _XX pattern where XX is 2 uppercase letters
  const underscoreMatch = resourceOnProduct.match(/_([A-Z]{2})/);
  if (underscoreMatch) {
    const code = underscoreMatch[1];
    if (COUNTRY_MAP[code]) return code;
  }

  // Pattern 2: Try first part after underscore (PLANT_CYCODE or similar)
  const parts = resourceOnProduct.split("_");
  if (parts.length >= 2) {
    const candidate = parts[1].substring(0, 2).toUpperCase();
    if (COUNTRY_MAP[candidate]) return candidate;
  }

  // Pattern 3: Look for any 2-letter sequence that matches a known country code
  for (let i = 0; i < resourceOnProduct.length - 1; i++) {
    const candidate = resourceOnProduct.substring(i, i + 2).toUpperCase();
    if (COUNTRY_MAP[candidate]) return candidate;
  }

  // Pattern 4: Try common positions (chars at indices 0-1, last 2, etc.)
  const firstTwo = resourceOnProduct.substring(0, 2).toUpperCase();
  if (COUNTRY_MAP[firstTwo]) return firstTwo;

  const lastTwo = resourceOnProduct
    .substring(resourceOnProduct.length - 2)
    .toUpperCase();
  if (COUNTRY_MAP[lastTwo]) return lastTwo;

  return "";
}

export function deriveCountryInsights(
  rows: ResourceRiskRow[],
): CountryInsight[] {
  const totals = new Map<string, CountryInsight>();

  rows.forEach((row) => {
    const code = extractCountryCode(row.resourceOnProduct);

    // Skip if we couldn't extract a valid country code
    if (!code) return;

    const country = COUNTRY_MAP[code] || code;
    const existing = totals.get(code) || {
      code,
      country,
      red: 0,
      orange: 0,
      yellow: 0,
      white: 0,
      total: 0,
    };

    const red = existing.red + row.red;
    const orange = existing.orange + row.orange;
    const yellow = existing.yellow + row.yellow;
    const white = existing.white + row.white;
    const total = red + orange + yellow + white;

    totals.set(code, {
      code,
      country,
      red,
      orange,
      yellow,
      white,
      total,
    });
  });

  // Sort by total descending and filter out empty entries
  return Array.from(totals.values())
    .filter((insight) => insight.total > 0)
    .sort((a, b) => b.total - a.total);
}
