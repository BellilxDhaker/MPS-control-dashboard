"use client";

import { useMemo, useState, useEffect } from "react";
import { Search } from "lucide-react";
import { useDashboardStore } from "@/lib/store";
import { TimelineNavigation } from "@/components/TimelineNavigation";
import { DerivedCountryInsights } from "@/components/DerivedCountryInsights";
import { ResourceRiskRow, deriveCountryInsights } from "@/lib/derivedCountry";

const RISK_COLORS = {
  red: "#e11d48",
  orange: "#f97316",
  yellow: "#facc15",
  white: "#ffffff",
};

type RiskBuckets = {
  red: number;
  orange: number;
  yellow: number;
  white: number;
};

type WeeklyRisk = RiskBuckets & {
  week: string;
};

type BarGroup = RiskBuckets & {
  label: string;
};

function totalRisk(group: RiskBuckets): number {
  return group.red + group.orange + group.yellow + group.white;
}

function formatVolume(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(2)}M`;
  if (value >= 100) return `${(value / 100).toFixed(2)}M`;
  return `${value}K`;
}

function formatCount(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return `${value}K`;
}

function getHeatColor(value: number): string {
  if (value >= 15) return "rgba(225,29,72,0.18)";
  if (value >= 10) return "rgba(249,115,22,0.18)";
  if (value >= 6) return "rgba(250,204,21,0.2)";
  return "rgba(255,255,255,0.7)";
}

export default function InsufficientStockMonitoringPage() {
  const { selectedWeek, setSelectedWeek, uploadedData } = useDashboardStore();
  const [topCountry, setTopCountry] = useState(8);
  const [topCustomer, setTopCustomer] = useState(6);
  const [resourceSearch, setResourceSearch] = useState("");
  const [plantSearch, setPlantSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [sop1Search, setSop1Search] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [weeklyData, setWeeklyData] = useState<WeeklyRisk[]>([]);
  const [countriesData, setCountriesData] = useState<BarGroup[]>([]);
  const [plantsData, setPlantsData] = useState<BarGroup[]>([]);
  const [customersData, setCustomersData] = useState<BarGroup[]>([]);
  const [sop1Data, setSop1Data] = useState<BarGroup[]>([]);
  const [resourcesData, setResourcesData] = useState<ResourceRiskRow[]>([]);
  const [allTimelines, setAllTimelines] = useState<string[]>([]);

  const API_BASE =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    "http://localhost:8000";

  // Fetch backlog risk data
  useEffect(() => {
    const fetchBacklogData = async () => {
      if (!uploadedData) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/backlog-risk`, {
          credentials: "include",
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            response.status === 404
              ? "Backlog risk endpoint not found. Please ensure your backend is running."
              : response.status === 500
                ? "Server error. Please check your backend logs."
                : `HTTP ${response.status}: ${errorText || "Failed to fetch backlog risk data"}`,
          );
        }

        const data = await response.json();

        if (!data.countries || !Array.isArray(data.countries)) {
          throw new Error("Invalid data format received from API");
        }

        setWeeklyData(data.weeks || []);
        setCountriesData(data.countries || []);
        setPlantsData(data.plants || []);
        setCustomersData(data.customers || []);
        setSop1Data(data.sop1s || []);
        setResourcesData(
          data.resources?.map(
            (r: {
              resourceOnProduct: string;
              red: number;
              orange: number;
              yellow: number;
              white: number;
            }) => ({
              resourceOnProduct: r.resourceOnProduct,
              red: r.red,
              orange: r.orange,
              yellow: r.yellow,
              white: r.white,
            }),
          ) || [],
        );

        // Extract unique weeks from data
        const weeks = data.weeks?.map((w: { week: string }) => w.week) || [];
        setAllTimelines(weeks);

        // Initialize with first week if none selected
        if (weeks.length > 0 && !selectedWeek) {
          setSelectedWeek(weeks[0]);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An unknown error occurred";
        setError(errorMessage);
        console.error("Error fetching backlog data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBacklogData();
  }, [uploadedData, API_BASE, selectedWeek, setSelectedWeek]);

  const filteredResources = useMemo(() => {
    if (!resourceSearch.trim()) return resourcesData;
    const searchLower = resourceSearch.toLowerCase();
    return resourcesData.filter((row) =>
      row.resourceOnProduct.toLowerCase().includes(searchLower),
    );
  }, [resourceSearch, resourcesData]);

  // Derive countries from resources using the derivedCountry logic
  const derivedCountries = useMemo(() => {
    if (resourcesData.length === 0) return [];
    
    // Get derived country insights
    const insights = deriveCountryInsights(resourcesData);
    
    // Transform to BarGroup format for display
    return insights.map((insight) => ({
      label: insight.country,
      red: insight.red,
      orange: insight.orange,
      yellow: insight.yellow,
      white: insight.white,
    }));
  }, [resourcesData]);

  const sortedCountries = useMemo(() => {
    // Sort countries by total risk descending
    const sorted = [...derivedCountries].sort((a, b) => totalRisk(b) - totalRisk(a));
    return sorted.slice(0, topCountry);
  }, [topCountry, derivedCountries]);

  const sortedCustomers = useMemo(() => {
    return [...customersData]
      .sort((a, b) => totalRisk(b) - totalRisk(a))
      .slice(0, topCustomer);
  }, [topCustomer, customersData]);

  const filteredPlants = useMemo(() => {
    let filtered = plantsData;
    if (plantSearch.trim()) {
      const searchLower = plantSearch.toLowerCase();
      filtered = plantsData.filter((item) =>
        item.label.toLowerCase().includes(searchLower),
      );
    }
    // Sort by total risk descending
    return [...filtered].sort((a, b) => totalRisk(b) - totalRisk(a));
  }, [plantSearch, plantsData]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return sortedCustomers;
    const searchLower = customerSearch.toLowerCase();
    return sortedCustomers.filter((item) =>
      item.label.toLowerCase().includes(searchLower),
    );
  }, [customerSearch, sortedCustomers]);

  const filteredSop1 = useMemo(() => {
    let filtered = sop1Data;
    if (sop1Search.trim()) {
      const searchLower = sop1Search.toLowerCase();
      filtered = sop1Data.filter((item) =>
        item.label.toLowerCase().includes(searchLower),
      );
    }
    // Sort by total risk descending
    return [...filtered].sort((a, b) => totalRisk(b) - totalRisk(a));
  }, [sop1Search, sop1Data]);

  return (
    <div
      className="min-h-screen bg-[#f2f4f7] w-full overflow-x-hidden flex flex-col"
      style={{ fontFamily: "Inter, Segoe UI, system-ui, sans-serif" }}
    >
      <header className="border-b border-slate-200 bg-white w-full">
        <div className="w-full flex flex-col gap-4 px-6 py-6 lg:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
              Supply Chain Intelligence
            </p>
            <h1 className="text-2xl font-bold text-[#0b2a5b]">
              Insufficient Stock Monitoring
            </h1>
          </div>
        </div>
      </header>

      <main className="w-full max-w-full overflow-x-hidden px-6 py-8 lg:px-8 flex-1">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 animate-in fade-in">
            <p className="text-sm font-semibold text-red-800">
              Error Loading Data
            </p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <p className="text-xs text-red-600 mt-2">
              💡 Tip: Ensure your backend is running at {API_BASE} and the
              /backlog-risk endpoint is available.
            </p>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="text-slate-600">
              <div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full mx-auto mb-3"></div>
              Loading real data from your Excel file...
            </div>
          </div>
        )}

        {!loading && !error && allTimelines.length === 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
            <p className="text-sm text-amber-800">
              No data available. Please upload an Excel file first.
            </p>
          </div>
        )}

        {!loading && !error && allTimelines.length > 0 && (
          <>
            {/* Timeline Navigation - Top & Prominent */}
            <div className="mb-8">
              <TimelineNavigation
                weeks={allTimelines}
                selectedWeek={selectedWeek || allTimelines[0]}
                onWeekChange={setSelectedWeek}
                title="Timeline Navigation"
                description="Select a week to filter all dashboard data"
              />
            </div>

            <div className="grid gap-6 grid-cols-1 w-full">
              <section className="rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)] w-full">
                <div className="mb-4">
                  <h2 className="text-lg font-bold text-[#0b2a5b]">
                    Count of Backlog_Risk by Week
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Stacked weekly backlog exposure by risk level.
                  </p>
                </div>
                <div className="w-full overflow-x-auto scrollbar-thin">
                  <div className="flex items-end gap-2 pb-2 min-w-full">
                    {weeklyData.map((item) => {
                      const total = totalRisk(item);
                      return (
                        <div
                          key={item.week}
                          className="flex flex-col items-center flex-1"
                          style={{ minWidth: "60px" }}
                        >
                          <div className="flex h-56 w-full flex-col-reverse overflow-hidden rounded-xl bg-slate-100">
                            {["white", "yellow", "orange", "red"].map(
                              (risk) => {
                                const value = item[risk as keyof RiskBuckets];
                                const height = total
                                  ? (value / total) * 100
                                  : 0;
                                return (
                                  <div
                                    key={`${item.week}-${risk}`}
                                    className="flex items-center justify-center text-[11px] font-semibold"
                                    style={{
                                      height: `${height}%`,
                                      backgroundColor:
                                        RISK_COLORS[
                                          risk as keyof typeof RISK_COLORS
                                        ],
                                      color:
                                        risk === "white"
                                          ? "#475569"
                                          : "#0b2a5b",
                                    }}
                                  >
                                    {value ? formatVolume(value) : ""}
                                  </div>
                                );
                              },
                            )}
                          </div>
                          <span className="mt-3 text-xs font-semibold text-[#0b2a5b] text-center">
                            {item.week}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
              <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.08)] w-full">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold text-[#0b2a5b]">Legend:</span>
                  <span className="flex items-center gap-1">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: RISK_COLORS.red }}
                    />
                    Critical
                  </span>
                  <span className="flex items-center gap-1">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: RISK_COLORS.orange }}
                    />
                    Medium
                  </span>
                  <span className="flex items-center gap-1">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: RISK_COLORS.yellow }}
                    />
                    Low
                  </span>
                  <span className="flex items-center gap-1">
                    <span
                      className="h-2 w-2 rounded-full border border-slate-200"
                      style={{ backgroundColor: RISK_COLORS.white }}
                    />
                    Neutral
                  </span>
                </div>
              </div>

              <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 w-full">
                <section className="rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)] w-full overflow-hidden flex flex-col">
                  <h2 className="text-lg font-bold text-[#0b2a5b]">
                    Filters / Controls
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Adjust the top selections driving the charts.
                  </p>
                  <div className="mt-6 space-y-6">
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">
                        Top Country ({countriesData.length} available)
                      </label>
                      <div className="mt-2 flex items-center gap-3">
                        <input
                          type="number"
                          min={3}
                          max={countriesData.length}
                          value={topCountry}
                          onChange={(event) =>
                            setTopCountry(
                              Math.min(
                                countriesData.length,
                                Math.max(3, Number(event.target.value)),
                              ),
                            )
                          }
                          className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                        />
                        <input
                          type="range"
                          min={3}
                          max={countriesData.length}
                          value={topCountry}
                          onChange={(event) =>
                            setTopCountry(Number(event.target.value))
                          }
                          className="h-2 w-full cursor-pointer rounded-full bg-slate-200 accent-[#0b2a5b]"
                        />
                        <button
                          onClick={() => setTopCountry(countriesData.length)}
                          className="px-3 py-2 text-xs font-semibold bg-[#0b2a5b] text-white rounded-lg hover:bg-[#0a1f47] transition-colors whitespace-nowrap"
                        >
                          Show All
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">
                        Top Customer Account ({customersData.length} available)
                      </label>
                      <div className="mt-2 flex items-center gap-3">
                        <input
                          type="number"
                          min={3}
                          max={customersData.length}
                          value={topCustomer}
                          onChange={(event) =>
                            setTopCustomer(
                              Math.min(
                                customersData.length,
                                Math.max(3, Number(event.target.value)),
                              ),
                            )
                          }
                          className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                        />
                        <input
                          type="range"
                          min={3}
                          max={customersData.length}
                          value={topCustomer}
                          onChange={(event) =>
                            setTopCustomer(Number(event.target.value))
                          }
                          className="h-2 w-full cursor-pointer rounded-full bg-slate-200 accent-[#0b2a5b]"
                        />
                        <button
                          onClick={() => setTopCustomer(customersData.length)}
                          className="px-3 py-2 text-xs font-semibold bg-[#0b2a5b] text-white rounded-lg hover:bg-[#0a1f47] transition-colors whitespace-nowrap"
                        >
                          Show All
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)] lg:col-span-2 flex flex-col w-full overflow-hidden">
                  <div className="mb-4 flex items-center justify-between flex-shrink-0">
                    <div>
                      <h2 className="text-lg font-bold text-[#0b2a5b]">
                        Backlog Risk by Country
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Sorted by total backlog contribution.
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      Top {topCountry}
                    </span>
                  </div>
                  <div className="space-y-4 overflow-y-auto max-h-[500px] scrollbar-thin pr-2 w-full min-w-0 flex-1">
                    {sortedCountries.length > 0 ? (
                      sortedCountries.map((item) => {
                        const total = totalRisk(item);
                        return (
                          <div
                            key={item.label}
                            className="flex items-center gap-4"
                          >
                            <span className="w-24 text-xs font-semibold text-[#0b2a5b] truncate">
                              {item.label}
                            </span>
                            <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div
                                style={{
                                  width: `${(item.red / total) * 100}%`,
                                  backgroundColor: RISK_COLORS.red,
                                }}
                              />
                              <div
                                style={{
                                  width: `${(item.orange / total) * 100}%`,
                                  backgroundColor: RISK_COLORS.orange,
                                }}
                              />
                              <div
                                style={{
                                  width: `${(item.yellow / total) * 100}%`,
                                  backgroundColor: RISK_COLORS.yellow,
                                }}
                              />
                              <div
                                style={{
                                  width: `${(item.white / total) * 100}%`,
                                  backgroundColor: RISK_COLORS.white,
                                }}
                              />
                            </div>
                            <span className="w-14 text-right text-xs font-semibold text-slate-600">
                              {formatCount(total)}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-8">
                        No country data available
                      </p>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)] flex flex-col w-full overflow-hidden">
                  <h2 className="text-lg font-bold text-[#0b2a5b] flex-shrink-0">
                    Backlog Risk by Plant
                  </h2>
                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 flex-shrink-0">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by Plant name..."
                      value={plantSearch}
                      onChange={(e) => setPlantSearch(e.target.value)}
                      className="w-full bg-slate-50 text-sm text-slate-700 placeholder-slate-400 outline-none"
                    />
                  </div>
                  <div className="mt-4 space-y-4 overflow-y-auto max-h-[500px] scrollbar-thin pr-2 w-full min-w-0 flex-1">
                    {filteredPlants.length > 0 ? (
                      filteredPlants.map((item) => {
                        const total = totalRisk(item);
                        return (
                          <div
                            key={item.label}
                            className="flex items-center gap-4"
                          >
                            <span className="w-20 text-xs font-semibold text-[#0b2a5b] truncate">
                              {item.label}
                            </span>
                            <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div
                                style={{
                                  width: `${(item.red / total) * 100}%`,
                                  backgroundColor: RISK_COLORS.red,
                                }}
                              />
                              <div
                                style={{
                                  width: `${(item.orange / total) * 100}%`,
                                  backgroundColor: RISK_COLORS.orange,
                                }}
                              />
                              <div
                                style={{
                                  width: `${(item.yellow / total) * 100}%`,
                                  backgroundColor: RISK_COLORS.yellow,
                                }}
                              />
                              <div
                                style={{
                                  width: `${(item.white / total) * 100}%`,
                                  backgroundColor: RISK_COLORS.white,
                                }}
                              />
                            </div>
                            <span className="w-12 text-right text-xs font-semibold text-slate-600">
                              {formatCount(total)}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-8">
                        No plants found matching "{plantSearch}"
                      </p>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)] flex flex-col w-full overflow-hidden">
                  <div className="mb-4 flex items-center justify-between flex-shrink-0">
                    <h2 className="text-lg font-bold text-[#0b2a5b]">
                      Backlog Risk by Customer Account
                    </h2>
                    <span className="text-xs font-semibold text-slate-500">
                      Top {topCustomer}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 flex-shrink-0">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by Customer Account name..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="w-full bg-slate-50 text-sm text-slate-700 placeholder-slate-400 outline-none"
                    />
                  </div>
                  <div className="mt-4 space-y-4 overflow-y-auto max-h-[500px] scrollbar-thin pr-2 w-full min-w-0 flex-1">
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map((item) => {
                        const total = totalRisk(item);
                        return (
                          <div
                            key={item.label}
                            className="flex items-center gap-4"
                          >
                            <span className="w-16 text-xs font-semibold text-[#0b2a5b] truncate">
                              {item.label}
                            </span>
                            <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div
                                style={{
                                  width: `${(item.red / total) * 100}%`,
                                  backgroundColor: RISK_COLORS.red,
                                }}
                              />
                              <div
                                style={{
                                  width: `${(item.orange / total) * 100}%`,
                                  backgroundColor: RISK_COLORS.orange,
                                }}
                              />
                              <div
                                style={{
                                  width: `${(item.yellow / total) * 100}%`,
                                  backgroundColor: RISK_COLORS.yellow,
                                }}
                              />
                              <div
                                style={{
                                  width: `${(item.white / total) * 100}%`,
                                  backgroundColor: RISK_COLORS.white,
                                }}
                              />
                            </div>
                            <span className="w-12 text-right text-xs font-semibold text-slate-600">
                              {formatCount(total)}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-8">
                        No customers found matching "{customerSearch}"
                      </p>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)] flex flex-col w-full overflow-hidden">
                  <h2 className="text-lg font-bold text-[#0b2a5b] flex-shrink-0">
                    Backlog Risk by S&OP1
                  </h2>
                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 flex-shrink-0">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by S&OP1 name..."
                      value={sop1Search}
                      onChange={(e) => setSop1Search(e.target.value)}
                      className="w-full bg-slate-50 text-sm text-slate-700 placeholder-slate-400 outline-none"
                    />
                  </div>
                  <div className="mt-4 space-y-4 overflow-y-auto max-h-[500px] scrollbar-thin pr-2 w-full min-w-0 flex-1">
                    {filteredSop1.length > 0 ? (
                      filteredSop1.map((item) => {
                        const total = totalRisk(item);
                        return (
                          <div
                            key={item.label}
                            className="flex items-center gap-4"
                          >
                            <span className="w-16 text-xs font-semibold text-[#0b2a5b] truncate">
                              {item.label}
                            </span>
                            <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div
                                style={{
                                  width: `${(item.red / total) * 100}%`,
                                  backgroundColor: RISK_COLORS.red,
                                }}
                              />
                              <div
                                style={{
                                  width: `${(item.orange / total) * 100}%`,
                                  backgroundColor: RISK_COLORS.orange,
                                }}
                              />
                              <div
                                style={{
                                  width: `${(item.yellow / total) * 100}%`,
                                  backgroundColor: RISK_COLORS.yellow,
                                }}
                              />
                              <div
                                style={{
                                  width: `${(item.white / total) * 100}%`,
                                  backgroundColor: RISK_COLORS.white,
                                }}
                              />
                            </div>
                            <span className="w-12 text-right text-xs font-semibold text-slate-600">
                              {formatCount(total)}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-8">
                        No S&OP1 data found matching "{sop1Search}"
                      </p>
                    )}
                  </div>
                </section>
              </div>

              <div className="grid gap-6 grid-cols-1 md:grid-cols-2 w-full items-stretch">
                {/* LEFT SECTION */}
                <section className="rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)] flex flex-col overflow-hidden h-full">
                  <h2 className="text-lg font-bold text-[#0b2a5b] flex-shrink-0">
                    Resource on Product Table
                  </h2>

                  <p className="mt-1 text-xs text-slate-500 flex-shrink-0">
                    Heatmap highlights high-risk resources. Total:{" "}
                    {filteredResources.length} of {resourcesData.length}{" "}
                    products
                  </p>

                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 flex-shrink-0">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by Resource_on_Product name..."
                      value={resourceSearch}
                      onChange={(e) => setResourceSearch(e.target.value)}
                      className="w-full bg-slate-50 text-sm text-slate-700 placeholder-slate-400 outline-none"
                    />
                  </div>

                  <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 w-full flex-1">
                    <div className="overflow-x-auto overflow-y-auto scrollbar-thin max-h-[400px] w-full">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-4 py-3 whitespace-nowrap">
                              Resource_on_Product
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap text-right">
                              Orange
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap text-right">
                              Red
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap text-right">
                              White
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap text-right">
                              Yellow
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {filteredResources.length > 0 ? (
                            filteredResources.map((row) => (
                              <tr
                                key={row.resourceOnProduct}
                                className="border-t hover:bg-slate-50"
                              >
                                <td className="px-4 py-3 font-semibold text-[#0b2a5b] whitespace-nowrap">
                                  {row.resourceOnProduct}
                                </td>

                                {(
                                  [
                                    { key: "orange", value: row.orange },
                                    { key: "red", value: row.red },
                                    { key: "white", value: row.white },
                                    { key: "yellow", value: row.yellow },
                                  ] as const
                                ).map((cell) => (
                                  <td
                                    key={cell.key}
                                    className="px-4 py-3 text-slate-600 text-right whitespace-nowrap"
                                    style={{
                                      backgroundColor: getHeatColor(cell.value),
                                    }}
                                  >
                                    {cell.value}
                                  </td>
                                ))}
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={5}
                                className="px-4 py-8 text-center text-slate-500"
                              >
                                No resources found matching "{resourceSearch}"
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                {/* RIGHT SECTION */}
                <section className="rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)] flex flex-col overflow-hidden h-full">
                  <DerivedCountryInsights rows={resourcesData} />
                </section>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
