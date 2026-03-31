"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

type DataPoint = {
  technical_week: string;
  projected_stock: number;
  lower_bound: number;
  critical_threshold: number;
  is_current: boolean;
};

type ChartDataPoint = DataPoint & {
  week: string;
  projected: number;
  lower_bound: number;
  critical: number;
  color: string;
};

type MainChartProps = {
  data: DataPoint[];
  isLoading: boolean;
};

// Determine bar color based on stock level vs thresholds
function getBarColor(
  projected: number,
  lowerBound: number,
  critical: number,
): string {
  if (projected < critical) return "#e14b4b"; // Red: Critical
  if (projected < lowerBound) return "#f6b651"; // Yellow: Warning
  return "#1f8a70"; // Green: Healthy
}

// Format large numbers as millions (450000 -> 0.45M, 5600000 -> 5.6M)
function formatAsMillions(value: number): string {
  if (value >= 100000) {
    return (value / 1000000).toFixed(2) + "M";
  }
  return value.toFixed(1);
}

export function MainChart({ data, isLoading }: MainChartProps) {
  if (isLoading) {
    return (
      <div className="flex h-80 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[color:var(--accent)]/20 border-t-[color:var(--accent)]" />
          <p className="text-sm text-[color:var(--muted)]">Loading chart...</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center">
        <p className="text-sm text-[color:var(--muted)]">
          No data available. Upload a file and select filters to visualize.
        </p>
      </div>
    );
  }

  // Transform data and pre-calculate colors
  const chartData: ChartDataPoint[] = data.map((point) => ({
    ...point,
    week: point.technical_week,
    projected: point.projected_stock,
    lower_bound: point.lower_bound,
    critical: point.critical_threshold,
    color: getBarColor(
      point.projected_stock,
      point.lower_bound,
      point.critical_threshold,
    ),
  }));

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 12 }}
            stroke="#6b7280"
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="#6b7280"
            tickFormatter={(value) => {
              // Format Y-axis labels as millions (start from 100k)
              if (typeof value === "number" && value >= 100000) {
                return (value / 1000000).toFixed(2) + "M";
              }
              return typeof value === "number" ? value.toFixed(0) : "";
            }}
            label={{
              value: "Pipeline Days",
              angle: -90,
              position: "insideLeft",
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
            }}
            formatter={(value, name) => {
              // Format projected stock as millions, others as decimals
              if (name === "projected") {
                return [formatAsMillions(value as number), "Projected Stock"];
              }
              return [
                typeof value === "number" ? value.toFixed(2) : value,
                name,
              ];
            }}
            labelFormatter={(label) => `Week: ${label}`}
          />
          <Legend
            wrapperStyle={{ paddingTop: "20px" }}
            formatter={(value) => {
              if (value === "projected") return "Projected Stock (Bars)";
              if (value === "lower_bound") return "Safety Target (Blue Line)";
              if (value === "critical") return "Critical Floor (Dashed Red)";
              return value;
            }}
          />

          {/* Bars with individual colors based on status */}
          <Bar
            dataKey="projected"
            fill="#1f8a70"
            radius={[8, 8, 0, 0]}
            name="projected"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>

          {/* Safety Target Line (Blue) */}
          <Line
            type="monotone"
            dataKey="lower_bound"
            stroke="#0b5a78"
            strokeWidth={2}
            name="lower_bound"
            dot={false}
          />

          {/* Critical Floor Line (Red Dashed) */}
          <Line
            type="monotone"
            dataKey="critical"
            stroke="#e14b4b"
            strokeWidth={2}
            strokeDasharray="5 5"
            name="critical"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-6 rounded-[16px] border border-black/10 bg-white/40 p-4 text-xs text-[color:var(--muted)]">
        <p className="font-medium text-sm mb-3">Color Legend</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <div
              className="h-3 w-6 rounded flex-shrink-0 mt-0.5"
              style={{ backgroundColor: "#1f8a70" }}
            />
            <div>
              <p className="font-medium text-[color:var(--text)]">
                Healthy (Green)
              </p>
              <p className="text-xs text-[color:var(--muted)]">
                Stock above Safety Target
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div
              className="h-3 w-6 rounded flex-shrink-0 mt-0.5"
              style={{ backgroundColor: "#f6b651" }}
            />
            <div>
              <p className="font-medium text-[color:var(--text)]">
                Warning (Yellow)
              </p>
              <p className="text-xs text-[color:var(--muted)]">
                Between Safety Target & Critical Floor
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div
              className="h-3 w-6 rounded flex-shrink-0 mt-0.5"
              style={{ backgroundColor: "#e14b4b" }}
            />
            <div>
              <p className="font-medium text-[color:var(--text)]">
                Critical (Red)
              </p>
              <p className="text-xs text-[color:var(--muted)]">
                Below Critical Floor - Action Required
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
