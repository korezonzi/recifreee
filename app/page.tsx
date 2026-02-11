"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { UploadZone } from "@/components/upload-zone";
import { ReceiptTable } from "@/components/receipt-table";
import { SaveButton } from "@/components/save-button";
import { toast } from "sonner";
import type { ReceiptRow, ReceiptOCRResult, UserSettings } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setSettings(data))
      .catch(() => {});
  }, []);

  const handleFilesReady = useCallback(async (files: File[]) => {
    setIsProcessing(true);
    setProgress({ current: 0, total: files.length });

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));

      const res = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("OCR request failed");
      }

      const data = await res.json();
      const results: ReceiptOCRResult[] = data.results;

      const newReceipts: ReceiptRow[] = results.map((ocr, i) => ({
        id: crypto.randomUUID(),
        imageFile: files[i],
        imageUrl: files[i].type.startsWith("image/")
          ? URL.createObjectURL(files[i])
          : undefined,
        fileName: files[i].name,
        ocr,
        selected: false,
      }));

      setReceipts((prev) => [...prev, ...newReceipts]);
      setProgress({ current: files.length, total: files.length });
      toast.success(`${results.length}枚のOCR処理が完了しました`);
    } catch (error) {
      console.error("OCR error:", error);
      toast.error("OCR処理に失敗しました");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleUpdate = useCallback(
    (id: string, updates: Partial<ReceiptRow["ocr"]>) => {
      setReceipts((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, ocr: { ...r.ocr, ...updates } } : r
        )
      );
    },
    []
  );

  const handleRemove = useCallback((id: string) => {
    setReceipts((prev) => {
      const removed = prev.find((r) => r.id === id);
      if (removed?.imageUrl) URL.revokeObjectURL(removed.imageUrl);
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  const handleSelectionChange = useCallback((ids: string[]) => {
    setReceipts((prev) =>
      prev.map((r) => ({ ...r, selected: ids.includes(r.id) }))
    );
  }, []);

  const handleComplete = useCallback(() => {
    receipts.forEach((r) => {
      if (r.imageUrl) URL.revokeObjectURL(r.imageUrl);
    });
    setReceipts([]);
  }, [receipts]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status !== "authenticated") return null;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <UploadZone
          onFilesReady={handleFilesReady}
          isProcessing={isProcessing}
          progress={progress}
        />

        <ReceiptTable
          receipts={receipts}
          settings={settings}
          onUpdate={handleUpdate}
          onRemove={handleRemove}
          onSelectionChange={handleSelectionChange}
        />

        {receipts.length > 0 && !isProcessing && (
          <SaveButton
            receipts={receipts}
            settings={settings}
            onComplete={handleComplete}
          />
        )}
      </main>
    </>
  );
}
