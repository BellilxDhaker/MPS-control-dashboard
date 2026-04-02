import { create } from "zustand";
import { persist } from "zustand/middleware";

type DataPoint = {
  technical_week: string;
  projected_stock: number;
  lower_bound: number;
  critical_threshold: number;
  is_current: boolean;
};

type UploadedData = {
  resources: string[];
  columns: string[];
  rowCount: number;
  fileName?: string;
  uploadedAt?: string;
};

type DashboardStore = {
  uploadedData: UploadedData | null;
  selectedResource: string | null;
  variance: number;
  dashboardData: DataPoint[] | null;
  currentModule: string | null; // Track which module is being viewed

  // Actions
  setUploadedData: (data: UploadedData) => void;
  setSelectedResource: (resource: string | null) => void;
  setVariance: (variance: number) => void;
  setDashboardData: (data: DataPoint[] | null) => void;
  setCurrentModule: (module: string | null) => void;
  clearAll: () => void;
};

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set) => ({
      uploadedData: null,
      selectedResource: null,
      variance: 100,
      dashboardData: null,
      currentModule: null,

      setUploadedData: (data) =>
        set({
          uploadedData: data,
          selectedResource: null,
          currentModule: null,
        }),

      setSelectedResource: (resource) => set({ selectedResource: resource }),

      setVariance: (variance) =>
        set({ variance: Math.max(0, Math.min(100, variance)) }),

      setDashboardData: (data) => set({ dashboardData: data }),

      setCurrentModule: (module) => set({ currentModule: module }),

      clearAll: () =>
        set({
          uploadedData: null,
          selectedResource: null,
          variance: 100,
          dashboardData: null,
          currentModule: null,
        }),
    }),
    {
      name: "dashboard-store",
    },
  ),
);
