"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { UploadZone } from "@/components/upload-zone";
import { ReceiptTable } from "@/components/receipt-table";
import { SaveButton } from "@/components/save-button";
import { UsageBar } from "@/components/usage-bar";
import { CameraFab } from "@/components/camera-fab";
import { HistoryTab } from "@/components/history-tab";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  ReceiptRow,
  ReceiptOCRResult,
  UserSettings,
  OcrStatus,
  DuplicateInfo,
  FieldIssue,
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
  confidence: { date: "low", amount: "low", vendor: "low", category: "low" },
};

interface ExistingEntry {
  date: string;
  amount: string;
  vendor: string;
}

interface UsageInfo {
  month: string;
  count: number;
  plan: "free" | "pro";
  limit: number;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [existingEntries, setExistingEntries] = useState<
    ExistingEntry[] | null
  >(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [usageLimitReached, setUsageLimitReached] = useState(false);
  const existingEntriesFetched = useRef(false);
  const processingCount = useRef(0);
  const prevAllDoneRef = useRef(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setSettings(data))
      .catch(() => {});
  }, []);

  // Fetch usage data on mount
  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then((data: UsageInfo) => {
        setUsage(data);
        if (data.plan === "free" && data.count >= data.limit) {
          setUsageLimitReached(true);
        }
      })
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
      if (!existingEntries || !ocr.date || !ocr.amount || !ocr.vendor)
        return null;

      const match = existingEntries.find(
        (entry) =>
          entry.date === ocr.date &&
          entry.amount === String(ocr.amount) &&
          entry.vendor === ocr.vendor,
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
    [existingEntries],
  );

  // Process a single file OCR
  const processOcr = useCallback(
    async (id: string, file: File) => {
      // Mark as processing
      setReceipts((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, ocrStatus: "processing" as OcrStatus } : r,
        ),
      );

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/ocr", {
          method: "POST",
          body: formData,
        });

        if (res.status === 429) {
          // Usage limit reached
          setUsageLimitReached(true);
          const data = await res.json();
          setUsage((prev) =>
            prev ? { ...prev, count: data.count, limit: data.limit } : null,
          );
          toast.error("今月の処理上限に達しました");
          setReceipts((prev) =>
            prev.map((r) =>
              r.id === id ? { ...r, ocrStatus: "error" as OcrStatus } : r,
            ),
          );
          return;
        }

        if (!res.ok) throw new Error("OCR request failed");

        const data = await res.json();
        const result: ReceiptOCRResult = data.result;
        const fieldIssues: FieldIssue[] = data.fieldIssues || [];
        const duplicateOf = checkDuplicate(result);

        // Update usage count
        setUsage((prev) => (prev ? { ...prev, count: prev.count + 1 } : null));

        setReceipts((prev) => {
          // Check batch-internal duplicates (against other done receipts in same batch)
          let finalDuplicate = duplicateOf;
          if (
            !finalDuplicate &&
            result.date &&
            result.amount &&
            result.vendor
          ) {
            const batchMatch = prev.find(
              (other) =>
                other.id !== id &&
                other.ocrStatus === "done" &&
                other.ocr.date === result.date &&
                other.ocr.amount === result.amount &&
                other.ocr.vendor === result.vendor,
            );
            if (batchMatch) {
              finalDuplicate = {
                date: result.date,
                amount: result.amount,
                vendor: result.vendor,
              };
            }
          }

          return prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  ocr: result,
                  ocrStatus: "done" as OcrStatus,
                  duplicateOf: finalDuplicate,
                  fieldIssues,
                }
              : r,
          );
        });
      } catch (error) {
        console.error(`OCR error for ${file.name}:`, error);
        setReceipts((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, ocrStatus: "error" as OcrStatus } : r,
          ),
        );
      }
    },
    [checkDuplicate],
  );

  // OCR queue processor
  const processQueue = useCallback(() => {
    if (usageLimitReached) return;

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
          : r,
      );
    });
  }, [processOcr, usageLimitReached]);

  // Handle new files added
  const handleFilesAdded = useCallback(
    (files: File[]) => {
      if (usageLimitReached) {
        toast.error(
          "今月の処理上限に達しました。Proプランへのアップグレードをご検討ください。",
        );
        return;
      }

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
    [settings.year, fetchExistingEntries, processQueue, usageLimitReached],
  );

  // Retry OCR for a specific receipt
  const handleRetryOcr = useCallback(
    (id: string) => {
      setReceipts((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, ocrStatus: "pending" as OcrStatus } : r,
        ),
      );
      setTimeout(processQueue, 0);
    },
    [processQueue],
  );

  const handleUpdate = useCallback(
    (id: string, updates: Partial<ReceiptRow["ocr"]>) => {
      setReceipts((prev) => {
        const receipt = prev.find((r) => r.id === id);
        if (!receipt) return prev;

        // Record category learning when category is manually changed
        if (updates.category && receipt.ocr.vendor) {
          fetch("/api/categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              vendor: receipt.ocr.vendor,
              category: updates.category,
            }),
          }).catch(() => {});
        }

        return prev.map((r) =>
          r.id === id ? { ...r, ocr: { ...r.ocr, ...updates } } : r,
        );
      });
    },
    [],
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
      prev.map((r) => ({ ...r, selected: ids.includes(r.id) })),
    );
  }, []);

  const handleDismissDuplicate = useCallback((id: string) => {
    setReceipts((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, dismissedDuplicate: true, duplicateOf: null } : r,
      ),
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
  const allOcrDone =
    receipts.length > 0 &&
    receipts.every((r) => r.ocrStatus === "done" || r.ocrStatus === "error");

  // Confetti + toast when all OCR completes
  useEffect(() => {
    if (receipts.length === 0) {
      prevAllDoneRef.current = false;
      return;
    }
    if (allOcrDone && !prevAllDoneRef.current) {
      prevAllDoneRef.current = true;
      const doneCount = receipts.filter((r) => r.ocrStatus === "done").length;
      toast.success(`${doneCount}件のOCR処理が完了しました`);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      setTimeout(() => confetti.reset(), 500);
    }
  }, [receipts, allOcrDone]);

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
        <Tabs defaultValue="upload">
          <TabsList>
            <TabsTrigger value="upload">アップロード</TabsTrigger>
            <TabsTrigger value="history">処理履歴</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            <UploadZone
              onFilesAdded={handleFilesAdded}
              ocrStatuses={ocrStatuses}
              receipts={receipts}
            />

            {usage && (
              <UsageBar
                count={usage.count}
                limit={usage.limit}
                plan={usage.plan}
                limitReached={usageLimitReached}
              />
            )}

            <ReceiptTable
              receipts={receipts}
              settings={settings}
              onUpdate={handleUpdate}
              onRemove={handleRemove}
              onSelectionChange={handleSelectionChange}
              onRetryOcr={handleRetryOcr}
              onDismissDuplicate={handleDismissDuplicate}
            />

            {allOcrDone && (
              <SaveButton
                receipts={receipts}
                settings={settings}
                onComplete={handleComplete}
              />
            )}
          </TabsContent>

          <TabsContent value="history">
            <HistoryTab settings={settings} />
          </TabsContent>
        </Tabs>
      </main>

      <CameraFab onCapture={(file) => handleFilesAdded([file])} />
    </>
  );
}
