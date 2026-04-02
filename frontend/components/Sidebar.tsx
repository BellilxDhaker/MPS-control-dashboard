"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useDashboardStore } from "@/lib/store";

type Module = {
  id: string;
  name: string;
  description: string;
  path: string;
};

const AVAILABLE_MODULES: Module[] = [
  {
    id: "projected-stock-1",
    name: "Projected Stock 1",
    description: "Analyze projected inventory levels",
    path: "/dashboard/projected-stock-1",
  },
  // Future modules can be added here
  // {
  //   id: "demand-forecast",
  //   name: "Demand Forecast",
  //   description: "Forecast future demand patterns",
  //   path: "/dashboard/demand-forecast",
  // },
];

type SidebarProps = {
  currentModule?: string;
};

export function Sidebar({ currentModule = "projected-stock-1" }: SidebarProps) {
  const router = useRouter();
  const { clearAll, uploadedData } = useDashboardStore();

  const handleNewFile = () => {
    clearAll();
    router.push("/");
  };

  return (
    <aside className="w-full lg:w-72 flex flex-col space-y-6">
      {/* Navigation Header */}
      <div className="rounded-[28px] border border-black/10 bg-[color:var(--surface)] p-6 shadow-[0_16px_40px_rgba(25,32,40,0.08)]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">
            Modules
          </h2>
          <button
            onClick={handleNewFile}
            className="rounded-full p-2 hover:bg-black/5 transition"
            title="Upload new file"
          >
            <LogOut className="h-4 w-4 text-[color:var(--muted)]" />
          </button>
        </div>

        {/* Active File Info */}
        {uploadedData && (
          <div className="mb-6 pb-6 border-b border-black/10">
            <p className="text-xs text-[color:var(--muted)] mb-2">
              Current File
            </p>
            <p className="text-sm font-medium text-[color:var(--foreground)] truncate">
              {uploadedData.fileName || "Uploaded Data"}
            </p>
            <p className="text-xs text-[color:var(--muted)] mt-2">
              {uploadedData.rowCount} rows • {uploadedData.columns.length}{" "}
              columns
            </p>
          </div>
        )}

        {/* Module Navigation */}
        <nav className="space-y-2">
          {AVAILABLE_MODULES.map((module) => {
            const isActive = currentModule === module.id;
            return (
              <button
                key={module.id}
                onClick={() => router.push(module.path)}
                className={`w-full text-left rounded-[12px] px-4 py-3 transition ${
                  isActive
                    ? "bg-[color:var(--accent)] text-white"
                    : "bg-white/40 text-[color:var(--foreground)] hover:bg-white/60"
                }`}
              >
                <p className="text-sm font-medium">{module.name}</p>
                {!isActive && (
                  <p className="text-xs text-[color:var(--muted)] mt-1">
                    {module.description}
                  </p>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Session Info */}
      <div className="rounded-[28px] border border-black/10 bg-white/40 p-6 backdrop-blur">
        <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)] mb-3">
          Session
        </h3>
        {uploadedData && (
          <div className="space-y-2 text-xs text-[color:var(--foreground)]">
            <div className="flex justify-between">
              <span className="text-[color:var(--muted)]">Resources</span>
              <span className="font-medium">
                {uploadedData.resources.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[color:var(--muted)]">Columns</span>
              <span className="font-medium">{uploadedData.columns.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[color:var(--muted)]">Rows</span>
              <span className="font-medium">{uploadedData.rowCount}</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
