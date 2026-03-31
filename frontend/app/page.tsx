"use client";

import { useRouter } from "next/navigation";
import { FileUploader } from "@/components/FileUploader";
import { useDashboardStore } from "@/lib/store";
import { useState } from "react";

export default function GatekeeperPage() {
  const router = useRouter();
  const setUploadedData = useDashboardStore((state) => state.setUploadedData);
  const [error, setError] = useState<string | null>(null);

  const handleUploadSuccess = async (rowCount: number, columns: string[]) => {
    try {
      // Fetch metadata to get resources
      const metadataResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000"}/metadata`,
      );

      if (!metadataResponse.ok) {
        throw new Error("Failed to fetch metadata");
      }

      const metadata = await metadataResponse.json();

      // Store in Zustand and redirect
      setUploadedData({
        resources: metadata.resources,
        columns,
        rowCount,
      });

      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to initialize dashboard",
      );
    }
  };

  const handleUploadError = (message: string) => {
    setError(message);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-8">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-[0.4em] text-[color:var(--muted)]">
            Inventory Health Monitoring
          </span>
          <span className="title-serif text-3xl font-semibold">
            Gatekeeper: Upload Data
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 pb-16 pt-6 lg:flex-row">
        <div className="flex-1">
          <FileUploader
            onSuccess={handleUploadSuccess}
            onError={handleUploadError}
          />

          {error && (
            <div className="mt-6 rounded-[16px] border border-[color:var(--critical)]/40 bg-[color:var(--critical)]/5 p-4">
              <p className="text-sm font-medium text-[color:var(--critical)]">
                {error}
              </p>
            </div>
          )}
        </div>

        <aside className="lg:w-64">
          <div className="rounded-[28px] border border-black/10 bg-[color:var(--surface-strong)] p-6 text-white shadow-[0_16px_40px_rgba(10,20,28,0.3)]">
            <h2 className="title-serif text-lg font-semibold">What Next?</h2>
            <ul className="mt-4 space-y-3 text-sm text-white/80">
              <li>✓ Upload your supply chain CSV</li>
              <li>✓ Select resource</li>
              <li>✓ Adjust variance simulation</li>
              <li>✓ Analyze thresholds & alerts</li>
            </ul>
          </div>

          <div className="mt-6 rounded-[28px] border border-black/10 bg-white/40 p-6 backdrop-blur">
            <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">
              File Format
            </h3>
            <div className="mt-3 space-y-2 text-xs text-[color:var(--muted)]">
              <p className="font-medium">Required columns:</p>
              <ul className="list-inside list-disc space-y-1">
                <li>SOP1_Project</li>
                <li>Resource_on_Product</li>
                <li>DATE (YYYY.MM.DD HH:MM:SS)</li>
                <li>Projected_Stock_Pipeline_Days</li>
                <li>Lower_Bound_Inventory_Target_Pipeline_Days</li>
                <li>Threshold_Insufficient_Stock</li>
              </ul>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
