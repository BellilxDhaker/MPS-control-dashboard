"use client";

import { AlertCircle, AlertTriangle, CheckCircle } from "lucide-react";

type StatusBucket = "ok" | "warning" | "critical";

type AlertButtonProps = {
  status: StatusBucket;
  count: number;
};

export function AlertButton({ status, count }: AlertButtonProps) {
  const config = {
    ok: {
      label: "Healthy",
      icon: CheckCircle,
      bgColor: "bg-white/10",
      textColor: "text-[#1f8a70]",
    },
    warning: {
      label: "Warning",
      icon: AlertTriangle,
      bgColor: "bg-white/10",
      textColor: "text-[#f6b651]",
    },
    critical: {
      label: "Critical",
      icon: AlertCircle,
      bgColor: "bg-white/10",
      textColor: "text-[#e14b4b]",
    },
  };

  const { label, icon: Icon, bgColor, textColor } = config[status];

  return (
    <div className={`rounded-[16px] ${bgColor} p-4 text-center`}>
      <Icon className={`mx-auto h-5 w-5 ${textColor}`} />
      <p className="mt-2 text-xs text-white/60">{label}</p>
      <p className="text-2xl font-bold">{count}</p>
    </div>
  );
}
