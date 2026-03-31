"use client";

import { AlertCircle, AlertTriangle } from "lucide-react";

type DataPoint = {
  technical_week: string;
  projected_stock: number;
  lower_bound: number;
  critical_threshold: number;
  is_current: boolean;
};

type AlertTableProps = {
  data: DataPoint[] | null;
};

type AlertStatus = "warning" | "critical";

interface Alert {
  week: string;
  status: AlertStatus;
  projectedStock: number;
  threshold: number;
}

export function AlertTable({ data }: AlertTableProps) {
  const alerts: Alert[] = (data || [])
    .filter((point) => point.projected_stock < point.lower_bound)
    .map((point) => ({
      week: point.technical_week,
      status:
        point.projected_stock < point.critical_threshold
          ? "critical"
          : "warning",
      projectedStock: point.projected_stock,
      threshold: point.critical_threshold,
    }));

  if (alerts.length === 0) {
    return (
      <div className="rounded-[28px] border border-black/10 bg-[color:var(--surface)] p-6 shadow-[0_16px_40px_rgba(25,32,40,0.08)]">
        <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">
          Alert Feed
        </h3>
        <div className="mt-4 flex flex-col items-center gap-2 py-8">
          <div className="h-12 w-12 rounded-full bg-[color:var(--ok)]/10 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-[color:var(--ok)]" />
          </div>
          <p className="text-sm font-medium text-[color:var(--muted)]">
            No active alerts
          </p>
          <p className="text-xs text-[color:var(--muted)]">
            Stock levels are within safe thresholds.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-black/10 bg-[color:var(--surface)] p-6 shadow-[0_16px_40px_rgba(25,32,40,0.08)]">
      <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">
        Alert Feed ({alerts.length})
      </h3>

      <div className="mt-4 space-y-2">
        {alerts.slice(0, 10).map((alert, index) => (
          <div
            key={`${alert.week}-${index}`}
            className={`flex items-center gap-3 rounded-[12px] border px-4 py-3 ${
              alert.status === "critical"
                ? "border-[color:var(--critical)]/40 bg-[color:var(--critical)]/5"
                : "border-[color:var(--warning)]/40 bg-[color:var(--warning)]/5"
            }`}
          >
            {alert.status === "critical" ? (
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-[color:var(--critical)]" />
            ) : (
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-[color:var(--warning)]" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-[color:var(--foreground)]">
                {alert.week}
              </p>
              <p className="text-xs text-[color:var(--muted)]">
                Stock: {alert.projectedStock.toFixed(1)} days
              </p>
            </div>
            <span
              className={`flex-shrink-0 text-xs font-semibold uppercase tracking-[0.1em] ${
                alert.status === "critical"
                  ? "text-[color:var(--critical)]"
                  : "text-[color:var(--warning)]"
              }`}
            >
              {alert.status}
            </span>
          </div>
        ))}
      </div>

      {alerts.length > 10 && (
        <p className="mt-4 text-xs text-[color:var(--muted)]">
          Showing 10 of {alerts.length} alerts
        </p>
      )}
    </div>
  );
}
