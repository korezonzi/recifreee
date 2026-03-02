"use client";

import { useCallback, useState } from "react";
import {
  Save,
  Check,
  X,
  ExternalLink,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { ReceiptRow, UserSettings } from "@/lib/types";

type SaveStatus = "idle" | "saving-sheets" | "saving-drive" | "done" | "error";

interface SaveButtonProps {
  receipts: ReceiptRow[];
  settings: UserSettings;
  onComplete: () => void;
}

export function SaveButton({
  receipts,
  settings,
  onComplete,
}: SaveButtonProps) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [sheetsUrl, setSheetsUrl] = useState<string>();
  const [driveResults, setDriveResults] = useState<
    { fileName: string; success: boolean }[]
  >([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  const duplicateCount = receipts.filter((r) => r.duplicateOf).length;

  const doSave = useCallback(async () => {
    if (receipts.length === 0) return;

    try {
      // Step 1: Save to Sheets
      setStatus("saving-sheets");
      const sheetsRes = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receipts: receipts.map((r) => ({
            ocr: r.ocr,
            paymentMethod: r.ocr.payment_method,
          })),
          year: settings.year,
        }),
      });

      if (!sheetsRes.ok) throw new Error("Sheets save failed");
      const sheetsData = await sheetsRes.json();
      setSheetsUrl(sheetsData.url);

      // Step 2: Upload to Drive
      setStatus("saving-drive");
      const items = await Promise.all(
        receipts.map(async (r) => {
          let imageBase64 = "";
          let mimeType = "image/jpeg";

          if (r.imageFile) {
            const buffer = await r.imageFile.arrayBuffer();
            imageBase64 = btoa(
              new Uint8Array(buffer).reduce(
                (data, byte) => data + String.fromCharCode(byte),
                "",
              ),
            );
            mimeType = r.imageFile.type || "image/jpeg";
          }

          return {
            ocr: r.ocr,
            fileName: r.fileName,
            imageBase64,
            mimeType,
            year: settings.year,
          };
        }),
      );

      const driveRes = await fetch("/api/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      if (!driveRes.ok) throw new Error("Drive upload failed");
      const driveData = await driveRes.json();
      setDriveResults(driveData.results);

      setStatus("done");
      toast.success("保存が完了しました");
    } catch (error) {
      console.error("Save error:", error);
      setStatus("error");
      toast.error("保存中にエラーが発生しました");
    }
  }, [receipts, settings]);

  const handleSave = useCallback(() => {
    if (duplicateCount > 0) {
      setShowDuplicateDialog(true);
    } else {
      doSave();
    }
  }, [duplicateCount, doSave]);

  const handleConfirmSave = useCallback(() => {
    setShowDuplicateDialog(false);
    doSave();
  }, [doSave]);

  if (status === "done") {
    return (
      <div className="space-y-3 rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-green-600">
          <Check className="h-4 w-4" />
          保存完了
        </div>
        {sheetsUrl && (
          <a
            href={sheetsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Google Sheetsを開く
          </a>
        )}
        {driveResults.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Drive: {driveResults.filter((r) => r.success).length}/
            {driveResults.length}件アップロード成功
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setStatus("idle");
            setSheetsUrl(undefined);
            setDriveResults([]);
            onComplete();
          }}
        >
          新しいレシートを処理
        </Button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="space-y-3 rounded-lg border border-destructive/20 bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
          <X className="h-4 w-4" />
          エラーが発生しました
        </div>
        {sheetsUrl && (
          <p className="text-sm text-muted-foreground">
            Sheetsへの保存は完了しています
          </p>
        )}
        <Button variant="outline" size="sm" onClick={doSave}>
          再試行
        </Button>
      </div>
    );
  }

  const isSaving = status === "saving-sheets" || status === "saving-drive";

  return (
    <>
      <Button
        className="w-full"
        size="lg"
        onClick={handleSave}
        disabled={isSaving || receipts.length === 0}
      >
        {isSaving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {status === "saving-sheets"
              ? "Sheetsに保存中..."
              : "Driveにアップロード中..."}
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            Sheets保存 & Drive整理（{receipts.length}件）
            {duplicateCount > 0 && (
              <span className="ml-1 text-orange-300">
                (重複{duplicateCount}件)
              </span>
            )}
          </>
        )}
      </Button>

      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              重複の可能性があります
            </DialogTitle>
            <DialogDescription>
              重複の可能性がある行が{duplicateCount}件あります。保存しますか？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDuplicateDialog(false)}
            >
              戻って確認する
            </Button>
            <Button onClick={handleConfirmSave}>保存する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
