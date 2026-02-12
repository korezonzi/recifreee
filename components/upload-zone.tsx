"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, Camera, FolderOpen, X, ImageIcon, Loader2, Clock, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OcrStatus } from "@/lib/types";

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "application/pdf",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IMAGE_DIMENSION = 2048;

interface PreviewFile {
  id: string;
  file: File;
  previewUrl: string;
}

interface UploadZoneProps {
  onFilesAdded: (files: File[]) => void;
  ocrStatuses: Map<string, OcrStatus>;
}

function StatusBadge({ status }: { status?: OcrStatus }) {
  if (!status || status === "done") return null;
  if (status === "pending")
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
        <Clock className="h-4 w-4 text-white" />
      </div>
    );
  if (status === "processing")
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
        <Loader2 className="h-4 w-4 animate-spin text-white" />
      </div>
    );
  if (status === "error")
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-red-500/40">
        <AlertCircle className="h-4 w-4 text-white" />
      </div>
    );
  return null;
}

export function UploadZone({
  onFilesAdded,
  ocrStatuses,
}: UploadZoneProps) {
  const [previews, setPreviews] = useState<PreviewFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => {
      if (!ACCEPTED_TYPES.includes(f.type) && !f.name.match(/\.heic$/i)) return false;
      if (f.size > MAX_FILE_SIZE) return false;
      return true;
    });

    const newPreviews: PreviewFile[] = [];
    for (const file of files) {
      const id = crypto.randomUUID();
      let previewUrl = "";

      if (file.type.startsWith("image/")) {
        try {
          previewUrl = await resizeAndPreview(file);
        } catch {
          previewUrl = "";
        }
      }

      newPreviews.push({ id, file, previewUrl });
    }

    setPreviews((prev) => [...prev, ...newPreviews]);

    // Auto-fire OCR immediately
    if (files.length > 0) {
      onFilesAdded(files);
    }
  }, [onFilesAdded]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const removePreview = useCallback((id: string) => {
    setPreviews((prev) => {
      const removed = prev.find((p) => p.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    previews.forEach((p) => {
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
    });
    setPreviews([]);
  }, [previews]);

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "relative rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        )}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-full bg-primary/10 p-3">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-medium">
              ドラッグ&ドロップ または ファイルを選択
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              JPEG, PNG, HEIC, PDF（最大10MB/枚）- 選択後すぐにOCR開始
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="mr-1.5 h-4 w-4" />
              ファイル選択
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => folderInputRef.current?.click()}
            >
              <FolderOpen className="mr-1.5 h-4 w-4" />
              フォルダ選択
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="sm:hidden"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="mr-1.5 h-4 w-4" />
              カメラ
            </Button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,.heic,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) processFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={folderInputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,.heic,application/pdf"
          multiple
          // @ts-expect-error webkitdirectory is not in standard types
          webkitdirectory=""
          className="hidden"
          onChange={(e) => {
            if (e.target.files) processFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) processFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Preview grid */}
      {previews.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {previews.length}枚の画像
            </p>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              すべてクリア
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {previews.map((p) => (
              <div key={p.id} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
                {p.previewUrl ? (
                  <img
                    src={p.previewUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    {p.file.name.split(".").pop()?.toUpperCase()}
                  </div>
                )}
                <StatusBadge status={ocrStatuses.get(p.file.name)} />
                <button
                  onClick={() => removePreview(p.id)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

async function resizeAndPreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let { width, height } = img;

      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        const ratio = Math.min(
          MAX_IMAGE_DIMENSION / width,
          MAX_IMAGE_DIMENSION / height
        );
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}
