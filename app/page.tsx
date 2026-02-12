"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { UploadZone } from "@/components/upload-zone";
import { ReceiptTable } from "@/components/receipt-table";
import { SaveButton } from "@/components/save-button";
import { toast } from "sonner";
import type {
  ReceiptRow,
  ReceiptOCRResult,
  UserSettings,
  OcrStatus,
  DuplicateInfo,
} from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";

const MAX_CONCURRENT_OCR = 3;

const EMPTY_OCR: ReceiptOCRResult = {
  date: null,
  amount: null,
  tax_amount: null,
  vendor: null,
  category: null,
  description: null,
  payment_method: null,
  receipt_number: null,
  confidence: { date: "low", amount: "low", vendor: "low" },
};

interface ExistingEntry {
  date: string;
  amount: string;
  vendor: string;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [existingEntries, setExistingEntries] = useState<ExistingEntry[] | null>(null);
  const existingEntriesFetched = useRef(false);
  const processingCount = useRef(0);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setSettings(data))
      .catch(() => {});
  }, []);

  // Fetch existing entries for duplicate detection
  const fetchExistingEntries = useCallback(async (year: number) => {
    if (existingEntriesFetched.current) return;
    existingEntriesFetched.current = true;
    try {
      const res = await fetch(`/api/sheets?year=${year}`);
      if (res.ok) {
        const data = await res.json();
        setExistingEntries(data.rows);
      }
    } catch {
      // Silently fail - duplicate detection is non-critical
    }
  }, []);

  // Check for duplicates
  const checkDuplicate = useCallback(
    (ocr: ReceiptOCRResult): DuplicateInfo | null => {
      if (!existingEntries || !ocr.date || !ocr.amount || !ocr.vendor) return null;

      const match = existingEntries.find(
        (entry) =>
          entry.date === ocr.date &&
          entry.amount === String(ocr.amount) &&
          entry.vendor === ocr.vendor
      );

      if (match) {
        return {
          date: match.date,
          amount: Number(match.amount),
          vendor: match.vendor,
        };
      }
      return null;
    },
    [existingEntries]
  );

  // Process a single file OCR
  const processOcr = useCallback(
    async (id: string, file: File) => {
      // Mark as processing
      setReceipts((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ocrStatus: "processing" as OcrStatus } : r))
      );

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/ocr", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("OCR request failed");

        const data = await res.json();
        const result: ReceiptOCRResult = data.result;
        const duplicateOf = checkDuplicate(result);

        setReceipts((prev) =>
          prev.map((r) =>
            r.id === id
              ? { ...r, ocr: result, ocrStatus: "done" as OcrStatus, duplicateOf }
              : r
          )
        );
      } catch (error) {
        console.error(`OCR error for ${file.name}:`, error);
        setReceipts((prev) =>
          prev.map((r) => (r.id === id ? { ...r, ocrStatus: "error" as OcrStatus } : r))
        );
      }
    },
    [checkDuplicate]
  );

  // OCR queue processor
  const processQueue = useCallback(() => {
    setReceipts((prev) => {
      const pending = prev.filter((r) => r.ocrStatus === "pending");
      const slotsAvailable = MAX_CONCURRENT_OCR - processingCount.current;

      if (slotsAvailable <= 0 || pending.length === 0) return prev;

      const toProcess = pending.slice(0, slotsAvailable);

      for (const receipt of toProcess) {
        if (receipt.imageFile) {
          processingCount.current++;
          processOcr(receipt.id, receipt.imageFile).finally(() => {
            processingCount.current--;
            // Trigger next batch
            processQueue();
          });
        }
      }

      return prev.map((r) =>
        toProcess.some((p) => p.id === r.id)
          ? { ...r, ocrStatus: "processing" as OcrStatus }
          : r
      );
    });
  }, [processOcr]);

  // Handle new files added
  const handleFilesAdded = useCallback(
    (files: File[]) => {
      // Trigger fetching existing entries for duplicate detection
      fetchExistingEntries(settings.year);

      const newReceipts: ReceiptRow[] = files.map((file) => ({
        id: crypto.randomUUID(),
        imageFile: file,
        imageUrl: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined,
        fileName: file.name,
        ocr: EMPTY_OCR,
        ocrStatus: "pending" as OcrStatus,
        duplicateOf: null,
        selected: false,
      }));

      setReceipts((prev) => [...prev, ...newReceipts]);

      // Kick off queue processing after state update
      setTimeout(processQueue, 0);
    },
    [settings.year, fetchExistingEntries, processQueue]
  );

  // Retry OCR for a specific receipt
  const handleRetryOcr = useCallback(
    (id: string) => {
      setReceipts((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, ocrStatus: "pending" as OcrStatus } : r
        )
      );
      setTimeout(processQueue, 0);
    },
    [processQueue]
  );

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
    // Invalidate cache so next OCR batch re-fetches
    existingEntriesFetched.current = false;
    setExistingEntries(null);
  }, [receipts]);

  // OCR statuses map for UploadZone
  const ocrStatuses = useMemo(() => {
    const map = new Map<string, OcrStatus>();
    for (const r of receipts) {
      map.set(r.fileName, r.ocrStatus);
    }
    return map;
  }, [receipts]);

  // Only show save button when all OCR is done
  const allOcrDone = receipts.length > 0 && receipts.every(
    (r) => r.ocrStatus === "done" || r.ocrStatus === "error"
  );

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
          onFilesAdded={handleFilesAdded}
          ocrStatuses={ocrStatuses}
        />

        <ReceiptTable
          receipts={receipts}
          settings={settings}
          onUpdate={handleUpdate}
          onRemove={handleRemove}
          onSelectionChange={handleSelectionChange}
          onRetryOcr={handleRetryOcr}
        />

        {allOcrDone && (
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
