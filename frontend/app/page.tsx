"use client";

import { useRouter } from "next/navigation";
import { FileUploader } from "@/components/FileUploader";
import { useDashboardStore } from "@/lib/store";
import { useState } from "react";

export default function UploadPage() {
  const router = useRouter();
  const setUploadedData = useDashboardStore((state) => state.setUploadedData);
  const [error, setError] = useState<string | null>(null);

  const handleUploadSuccess = async (
    rowCount: number,
    columns: string[],
    fileName: string,
  ) => {
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
        fileName,
        uploadedAt: new Date().toISOString(),
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
      {/* Clean Header */}
      <header className="border-b border-black/10 bg-[color:var(--surface)]">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-8">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-[0.4em] text-[color:var(--muted)]">
              Data Management
            </span>
            <h1 className="title-serif text-3xl font-semibold">Upload Data</h1>
          </div>
        </div>
      </header>

      {/* Main Content - Centered, No Sidebar */}
      <main className="mx-auto flex-1 flex items-center justify-center w-full max-w-4xl px-6 py-16">
        <div className="w-full">
          <FileUploader
            onSuccess={handleUploadSuccess}
            onError={handleUploadError}
            accept=".csv,.xlsx,.xls"
            title="Upload Your Data"
            description="Select a CSV or Excel file to analyze. Your data will be securely processed and stored for your session."
          />

          {error && (
            <div className="mt-6 rounded-[16px] border border-[color:var(--critical)]/40 bg-[color:var(--critical)]/5 p-4">
              <p className="text-sm font-medium text-[color:var(--critical)]">
                Error: {error}
              </p>
            </div>
          )}

          {/* Info Section Below Upload */}
          <div className="mt-12 space-y-6">
            <div className="rounded-[20px] border border-black/10 bg-white/40 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)] mb-4">
                About This Upload
              </h2>
              <ul className="space-y-3 text-sm text-[color:var(--foreground)]">
                <li className="flex gap-3">
                  <span className="text-[color:var(--accent)]">•</span>
                  <span>
                    Your data is processed in your current session only
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[color:var(--accent)]">•</span>
                  <span>
                    Supports CSV, Excel (.xlsx), and legacy Excel (.xls) formats
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[color:var(--accent)]">•</span>
                  <span>Maximum file size: 50 MB</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[color:var(--accent)]">•</span>
                  <span>After upload, access multiple analysis modules</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
