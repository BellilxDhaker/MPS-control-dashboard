"use client";

import { useCallback, useMemo, useState } from "react";
import { Upload, AlertCircle, CheckCircle } from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

type FileUploaderProps = {
  onSuccess: (rowCount: number, columns: string[]) => void;
  onError: (message: string) => void;
};

export function FileUploader({ onSuccess, onError }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const fileLabel = useMemo(() => {
    if (!file) return "No file selected";
    return `${file.name} (${Math.round(file.size / 1024)} KB)`;
  }, [file]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const csvFile = files[0];
        if (csvFile.name.endsWith(".csv")) {
          setFile(csvFile);
        } else {
          onError("Please drop a .csv file");
        }
      }
    },
    [onError],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || uploading) return;
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          payload?.detail || `Upload failed with status ${response.status}`,
        );
      }

      const data = await response.json();
      onSuccess(data.rows, data.columns);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Upload failed");
      setUploading(false);
    }
  };

  return (
    <div className="w-full rounded-[28px] border border-black/10 bg-[color:var(--surface)] p-8 shadow-[0_16px_40px_rgba(25,32,40,0.08)]">
      <div className="space-y-6">
        <div>
          <h2 className="title-serif text-2xl font-semibold">
            Upload CSV Data
          </h2>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            Drop your supply chain data file here or click to browse.
          </p>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="rounded-[20px] border-2 border-dashed border-[color:var(--accent)]/40 bg-[color:var(--accent-soft)]/20 p-8 text-center transition hover:border-[color:var(--accent)]/60 hover:bg-[color:var(--accent-soft)]/30"
        >
          <label
            htmlFor="csv-input"
            className="flex flex-col items-center gap-3 cursor-pointer"
          >
            <Upload className="h-10 w-10 text-[color:var(--accent)]" />
            <div>
              <p className="text-sm font-medium text-[color:var(--foreground)]">
                {fileLabel}
              </p>
              {!file && (
                <p className="mt-1 text-xs text-[color:var(--muted)]">
                  Drag files here, or click to select
                </p>
              )}
            </div>
          </label>
          <input
            id="csv-input"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleChange}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--accent)] px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition disabled:cursor-not-allowed disabled:opacity-60 hover:translate-y-[-1px] hover:shadow-lg"
          >
            {uploading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Processing...
              </>
            ) : (
              "Upload & Start"
            )}
          </button>
        </div>

        <div className="rounded-[16px] border border-black/10 bg-white/40 p-4 text-xs text-[color:var(--muted)] space-y-2">
          <div className="flex gap-2">
            <CheckCircle className="h-4 w-4 flex-shrink-0 text-[color:var(--ok)]" />
            <span>
              Requires: SOP1_Project, Resource_on_Product, TechnicalWeek
            </span>
          </div>
          <div className="flex gap-2">
            <CheckCircle className="h-4 w-4 flex-shrink-0 text-[color:var(--ok)]" />
            <span>
              Stock columns: Projected_Stock_Pipeline_Days,
              Lower_Bound_Inventory_Target_Pipeline_Days,
              Threshold_Insufficient_Stock
            </span>
          </div>
          <div className="flex gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-[color:var(--warning)]" />
            <span>Max file size: 10 MB</span>
          </div>
        </div>
      </div>
    </div>
  );
}
