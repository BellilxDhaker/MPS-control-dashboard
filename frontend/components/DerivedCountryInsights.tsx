"use client";

import { deriveCountryInsights, ResourceRiskRow } from "@/lib/derivedCountry";

const RISK_COLORS = {
  red: "#e11d48",
  orange: "#f97316",
  yellow: "#facc15",
  white: "#ffffff",
};

type DerivedCountryInsightsProps = {
  rows: ResourceRiskRow[];
};

function formatValue(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
}

export function DerivedCountryInsights({ rows }: DerivedCountryInsightsProps) {
  const insights = deriveCountryInsights(rows);

  return (
    <div className=" w-full overflow-hidden h-full">
      <div className="mb-4 flex-shrink-0">
        <h2 className="text-lg font-bold text-[#0b2a5b]">
          Derived Country Insights
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Country mapping is derived from Resource_on_Product codes.
        </p>
      </div>

      {insights.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-500 text-center">
            No country data available. Ensure Resource_on_Product contains
            country codes (e.g., PLANT_CYCODE).
          </p>
        </div>
      ) : (
        <div className="space-y-4 overflow-y-auto max-h-[500px] scrollbar-thin pr-2 flex-1">
          {insights.map((item) => (
            <div key={`${item.code}-${item.country}`}>
              <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
                <span className="font-semibold text-[#0b2a5b] truncate">
                  {item.country}
                </span>
                <span className="font-semibold text-[#0b2a5b] ml-2">
                  {formatValue(item.total)}
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="flex h-full">
                  <div
                    className="h-full"
                    style={{
                      width: `${(item.red / item.total) * 100}%`,
                      backgroundColor: RISK_COLORS.red,
                    }}
                  />
                  <div
                    className="h-full"
                    style={{
                      width: `${(item.orange / item.total) * 100}%`,
                      backgroundColor: RISK_COLORS.orange,
                    }}
                  />
                  <div
                    className="h-full"
                    style={{
                      width: `${(item.yellow / item.total) * 100}%`,
                      backgroundColor: RISK_COLORS.yellow,
                    }}
                  />
                  <div
                    className="h-full"
                    style={{
                      width: `${(item.white / item.total) * 100}%`,
                      backgroundColor: RISK_COLORS.white,
                    }}
                  />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: RISK_COLORS.red }}
                  />
                  Critical {formatValue(item.red)}
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: RISK_COLORS.orange }}
                  />
                  Medium {formatValue(item.orange)}
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: RISK_COLORS.yellow }}
                  />
                  Low {formatValue(item.yellow)}
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="inline-block h-2 w-2 rounded-full border border-slate-200"
                    style={{ backgroundColor: RISK_COLORS.white }}
                  />
                  Neutral {formatValue(item.white)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
