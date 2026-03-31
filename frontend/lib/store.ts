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
};

type DashboardStore = {
  uploadedData: UploadedData | null;
  selectedResource: string | null;
  variance: number;
  dashboardData: DataPoint[] | null;

  // Actions
  setUploadedData: (data: UploadedData) => void;
  setSelectedResource: (resource: string | null) => void;
  setVariance: (variance: number) => void;
  setDashboardData: (data: DataPoint[] | null) => void;
  clearAll: () => void;
};

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set) => ({
      uploadedData: null,
      selectedResource: null,
      variance: 100,
      dashboardData: null,

      setUploadedData: (data) =>
        set({
          uploadedData: data,
          selectedResource: null,
        }),

      setSelectedResource: (resource) => set({ selectedResource: resource }),

      setVariance: (variance) =>
        set({ variance: Math.max(0, Math.min(100, variance)) }),

      setDashboardData: (data) => set({ dashboardData: data }),

      clearAll: () =>
        set({
          uploadedData: null,
          selectedResource: null,
          variance: 100,
          dashboardData: null,
        }),
    }),
    {
      name: "dashboard-store",
    },
  ),
);
