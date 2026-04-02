"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useDashboardStore } from "@/lib/store";

export default function DashboardHub() {
  const router = useRouter();
  const uploadedData = useDashboardStore((state) => state.uploadedData);

  useEffect(() => {
    // If no data is uploaded, redirect to upload page
    if (!uploadedData) {
      router.push("/");
      return;
    }

    // Otherwise, redirect to the default module (Projected Stock 1)
    router.push("/dashboard/projected-stock-1");
  }, [uploadedData, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-sm text-[color:var(--muted)]">Loading...</p>
      </div>
    </div>
  );
}
