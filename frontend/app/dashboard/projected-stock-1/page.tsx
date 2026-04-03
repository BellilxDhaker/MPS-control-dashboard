"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDashboardStore } from "@/lib/store";
import { SidebarFilters } from "@/components/SidebarFilters";
import { MainChart } from "@/components/MainChart";
import { AlertTable } from "@/components/AlertTable";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

type DataPoint = {
  technical_week: string;
  projected_stock: number;
  lower_bound: number;
  critical_threshold: number;
  is_current: boolean;
};

type StatusBucket = "ok" | "warning" | "critical";

function getStatus(point: DataPoint): StatusBucket {
  if (point.projected_stock < point.critical_threshold) return "critical";
  if (point.projected_stock < point.lower_bound) return "warning";
  return "ok";
}

export default function ProjectedStock1() {
  const router = useRouter();
  const {
    uploadedData,
    selectedResource,
    variance,
    dashboardData,
    setSelectedResource,
    setVariance,
    setDashboardData,
  } = useDashboardStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch dashboard data whenever filters or variance change
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        variance: String(variance),
      });
      if (selectedResource) {
        params.set("resource", selectedResource);
      }

      try {
        const response = await fetch(`${API_BASE}/data?${params.toString()}`, {
          credentials: "include", // Required for CORS with credentials
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.detail || "Failed to fetch data");
        }
        const data = await response.json();
        setDashboardData(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedResource, variance, setDashboardData]);

  // Redirect to home if no data is loaded
  useEffect(() => {
    if (!uploadedData && !loading) {
      router.push("/");
    }
  }, [uploadedData, router, loading]);

  const alertSummary = {
    ok: dashboardData?.filter((p) => getStatus(p) === "ok").length || 0,
    warning:
      dashboardData?.filter((p) => getStatus(p) === "warning").length || 0,
    critical:
      dashboardData?.filter((p) => getStatus(p) === "critical").length || 0,
  };

  if (!uploadedData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-[color:var(--muted)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-black/10 bg-[color:var(--surface)]">
        <div className="flex w-full items-center justify-between px-6 py-6">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-[0.4em] text-[color:var(--muted)]">
              Analysis Module
            </span>
            <h1 className="title-serif text-2xl font-semibold">
              Projected Stock 1
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-[color:var(--muted)]">
            <span>Rows: {uploadedData?.rowCount || 0}</span>
            <span className="text-black/20">•</span>
            <span>{uploadedData?.fileName}</span>
          </div>
        </div>
      </header>

      {/* Main Content - Full Width */}
      <main className="flex-1 w-full px-6 py-8">
        {error && (
          <div className="mb-6 rounded-[16px] border border-[color:var(--critical)]/40 bg-[color:var(--critical)]/5 p-4">
            <p className="text-sm font-medium text-[color:var(--critical)]">
              {error}
            </p>
          </div>
        )}

        {/* Three-Column Control Bar */}
        <div className="grid gap-6 mb-6 lg:grid-cols-3">
          {/* Column 1: Filters */}
          <SidebarFilters
            resources={uploadedData?.resources || []}
            selectedResource={selectedResource}
            onResourceChange={setSelectedResource}
          />

          {/* Column 2: Variance Simulation */}
          <div className="rounded-[28px] border border-black/10 bg-[color:var(--surface)] p-6 shadow-[0_16px_40px_rgba(25,32,40,0.08)]">
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">
                    Variance Simulation
                  </h3>
                  <span className="text-lg font-bold text-[color:var(--foreground)]">
                    {variance}%
                  </span>
                </div>
                <p className="mt-2 text-xs text-[color:var(--muted)]">
                  Adjust supply/demand impact on projected stock (0–100%).
                </p>
              </div>

              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={variance}
                onChange={(e) => setVariance(Number(e.target.value))}
                className="h-2 w-full cursor-pointer rounded-full bg-black/10 accent-[color:var(--accent)]"
                disabled={loading}
              />

              <div className="flex justify-between text-xs text-[color:var(--muted)]">
                <span>0% Worst</span>
                <span>50% Safe</span>
                <span>100% Best</span>
              </div>
            </div>
          </div>

          {/* Column 3: Alert Summary */}
          <div className="rounded-[28px] border border-black/10 bg-[color:var(--surface-strong)] p-6 text-white shadow-[0_16px_40px_rgba(10,20,28,0.3)]">
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70 mb-4">
              Alert Summary
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {/* OK Status */}
              <div className="rounded-[12px] bg-[color:var(--ok)]/20 p-3 text-center">
                <div className="text-2xl font-bold text-[color:var(--ok)]">
                  {alertSummary.ok}
                </div>
                <div className="text-xs text-white/70 mt-1">Healthy</div>
              </div>
              {/* Warning Status */}
              <div className="rounded-[12px] bg-[color:var(--warning)]/20 p-3 text-center">
                <div className="text-2xl font-bold text-[color:var(--warning)]">
                  {alertSummary.warning}
                </div>
                <div className="text-xs text-white/70 mt-1">Warning</div>
              </div>
              {/* Critical Status */}
              <div className="rounded-[12px] bg-[color:var(--critical)]/20 p-3 text-center">
                <div className="text-2xl font-bold text-[color:var(--critical)]">
                  {alertSummary.critical}
                </div>
                <div className="text-xs text-white/70 mt-1">Critical</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area - Full Width */}
        <div className="space-y-6">
          {/* Chart */}
          <div className="rounded-[28px] border border-black/10 bg-[color:var(--surface)] p-6 shadow-[0_16px_40px_rgba(25,32,40,0.08)]">
            <div className="mb-4">
              <h2 className="title-serif text-xl font-semibold">
                Projected Stock vs Thresholds
              </h2>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                Bars show mean projected stock per week. Lines show safety and
                critical thresholds.
              </p>
            </div>
            <MainChart data={dashboardData || []} isLoading={loading} />
          </div>

          {/* Alert Table */}
          <AlertTable data={dashboardData} />
        </div>
      </main>
    </div>
  );
}
