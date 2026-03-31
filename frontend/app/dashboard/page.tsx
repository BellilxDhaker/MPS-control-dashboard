"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { useDashboardStore } from "@/lib/store";
import { SidebarFilters } from "@/components/SidebarFilters";
import { TopBar } from "@/components/TopBar";
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

export default function AnalyticsHub() {
  const router = useRouter();
  const {
    uploadedData,
    selectedResource,
    variance,
    dashboardData,
    setSelectedResource,
    setVariance,
    setDashboardData,
    clearAll,
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
        const response = await fetch(`${API_BASE}/data?${params.toString()}`);
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
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-[0.4em] text-[color:var(--muted)]">
              Projected Stock 1
            </span>
            <h1 className="title-serif text-2xl font-semibold">
              Analytics Hub
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-[color:var(--muted)]">
            <span>Rows: {uploadedData?.rowCount || 0}</span>
            <span className="text-black/20">•</span>
            <button
              onClick={() => {
                clearAll();
                router.push("/");
              }}
              className="flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-2 transition hover:bg-white/90"
            >
              <LogOut className="h-4 w-4" />
              New File
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex-1 w-full max-w-7xl px-6 py-8">
        {error && (
          <div className="mb-6 rounded-[16px] border border-[color:var(--critical)]/40 bg-[color:var(--critical)]/5 p-4">
            <p className="text-sm font-medium text-[color:var(--critical)]">
              {error}
            </p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Main Content Area */}
          <div className="space-y-6">
            {/* Top Bar with Variance and Alerts */}
            <TopBar
              variance={variance}
              onVarianceChange={setVariance}
              alertSummary={alertSummary}
              isLoading={loading}
            />

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

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Filters */}
            <SidebarFilters
              resources={uploadedData?.resources || []}
              selectedResource={selectedResource}
              onResourceChange={setSelectedResource}
            />

            {/* Info Panel */}
            <div className="rounded-[28px] border border-black/10 bg-white/40 p-6 backdrop-blur">
              <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">
                Current Selection
              </h3>
              <div className="mt-4 space-y-2 text-sm text-[color:var(--foreground)]">
                <div>
                  <p className="text-xs text-[color:var(--muted)]">Resource</p>
                  <p className="font-medium truncate">
                    {selectedResource || "All Resources"}
                  </p>
                </div>
                <div className="rounded-[8px] bg-black/5 p-2 text-xs">
                  Variance: <span className="font-bold">{variance}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
