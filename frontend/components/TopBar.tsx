"use client";

import { AlertButton } from "./StatusIndicators";

type TopBarProps = {
  variance: number;
  onVarianceChange: (variance: number) => void;
  alertSummary: {
    ok: number;
    warning: number;
    critical: number;
  };
  isLoading: boolean;
};

export function TopBar({
  variance,
  onVarianceChange,
  alertSummary,
  isLoading,
}: TopBarProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
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
              Adjust supply/demand impact on projected stock (10–500%).
            </p>
          </div>

          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={variance}
            onChange={(e) => onVarianceChange(Number(e.target.value))}
            className="h-2 w-full cursor-pointer rounded-full bg-black/10 accent-[color:var(--accent)]"
            disabled={isLoading}
          />

          <div className="flex justify-between text-xs text-[color:var(--muted)]">
            <span>0% Worst Case</span>
            <span>50% Safe</span>
            <span>100% Optimistic</span>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-black/10 bg-[color:var(--surface-strong)] p-6 text-white shadow-[0_16px_40px_rgba(10,20,28,0.3)]">
        <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70">
          Alert Summary
        </h3>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <AlertButton status="ok" count={alertSummary.ok} />
          <AlertButton status="warning" count={alertSummary.warning} />
          <AlertButton status="critical" count={alertSummary.critical} />
        </div>
      </div>
    </div>
  );
}
