"use client";

import { useCallback, useMemo, useState } from "react";
import { Upload, FileText } from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

type FileUploaderProps = {
  onSuccess: (rowCount: number, columns: string[], fileName: string) => void;
  onError: (message: string) => void;
  accept?: string; // e.g., ".csv,.xlsx"
  title?: string;
  description?: string;
};

type UploadResponse = {
  rows: number;
  columns: string[];
  preview?: Record<string, unknown>[];
};

export function FileUploader({
  onSuccess,
  onError,
  accept = ".csv,.xlsx,.xls",
  title = "Upload Data File",
  description = "Drop your data file here or click to browse.",
}: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<Record<string, unknown>[] | null>(
    null,
  );

  const fileLabel = useMemo(() => {
    if (!file) return "No file selected";
    return `${file.name} (${Math.round(file.size / 1024)} KB)`;
  }, [file]);

  const validateFile = useCallback(
    (file: File): boolean => {
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (!extension) return false;

      const isValidExtension = accept
        .split(",")
        .map((ext) => ext.trim().replace(".", "").toLowerCase())
        .includes(extension);

      if (!isValidExtension) {
        onError(`Invalid file type. Accepted formats: ${accept}`);
        return false;
      }

      const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
      if (file.size > MAX_FILE_SIZE) {
        onError("File size exceeds 50MB limit");
        return false;
      }

      return true;
    },
    [accept, onError],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const droppedFile = files[0];
        if (validateFile(droppedFile)) {
          setFile(droppedFile);
          setPreview(null);
        }
      }
    },
    [validateFile],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
        setPreview(null);
      }
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

      const data: UploadResponse = await response.json();

      // Set preview from response if available
      if (data.preview) {
        setPreview(data.preview);
      }

      onSuccess(data.rows, data.columns, file.name);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Upload failed");
      setUploading(false);
    }
  };

  return (
    <div className="w-full rounded-[28px] border border-black/10 bg-[color:var(--surface)] p-8 shadow-[0_16px_40px_rgba(25,32,40,0.08)]">
      <div className="space-y-6">
        <div>
          <h2 className="title-serif text-2xl font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            {description}
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
            htmlFor="file-input"
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
            id="file-input"
            type="file"
            accept={accept}
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
              "Upload & Continue"
            )}
          </button>
        </div>

        {/* File Format Info */}
        <div className="rounded-[16px] border border-black/10 bg-white/40 p-4 text-xs text-[color:var(--muted)] space-y-2">
          <div className="flex gap-2">
            <FileText className="h-4 w-4 flex-shrink-0 text-[color:var(--ok)]" />
            <span>
              Supported formats: {accept.replace(/\./g, "").toUpperCase()}
            </span>
          </div>
          <div className="flex gap-2">
            <FileText className="h-4 w-4 flex-shrink-0 text-[color:var(--ok)]" />
            <span>Maximum file size: 50 MB</span>
          </div>
        </div>

        {/* Preview Section */}
        {preview && preview.length > 0 && (
          <div className="rounded-[16px] border border-black/10 bg-white/40 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)] mb-3">
              Preview
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-black/10">
                    {Object.keys(preview[0]).map((key) => (
                      <th
                        key={key}
                        className="px-2 py-2 text-left text-[color:var(--muted)]"
                      >
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 3).map((row, idx) => (
                    <tr key={idx} className="border-b border-black/5">
                      {Object.values(row).map((value, colIdx) => (
                        <td
                          key={colIdx}
                          className="px-2 py-2 text-[color:var(--foreground)]"
                        >
                          {String(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-[color:var(--muted)]">
                Showing first {Math.min(3, preview.length)} rows of{" "}
                {preview.length} total
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
