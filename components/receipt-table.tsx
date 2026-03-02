"use client";

import { useCallback, useRef, useState } from "react";
import {
  Trash2,
  Loader2,
  Clock,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Camera,
  XCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  ReceiptRow,
  Confidence,
  UserSettings,
  FieldIssue,
} from "@/lib/types";

interface ReceiptTableProps {
  receipts: ReceiptRow[];
  settings: UserSettings;
  onUpdate: (id: string, updates: Partial<ReceiptRow["ocr"]>) => void;
  onRemove: (id: string) => void;
  onSelectionChange: (ids: string[]) => void;
  onRetryOcr?: (id: string) => void;
  onDismissDuplicate?: (id: string) => void;
}

function confidenceBg(
  value: string | number | null | undefined,
  confidence?: Confidence,
): string {
  if (value == null || value === "") return "bg-red-50 dark:bg-red-950/30";
  if (confidence === "low") return "bg-yellow-50 dark:bg-yellow-950/30";
  if (confidence === "medium") return "bg-orange-50 dark:bg-orange-950/30";
  return "";
}

function getFieldIssue(
  issues: FieldIssue[] | undefined,
  field: string,
): FieldIssue | undefined {
  return issues?.find((i) => i.field === field);
}

function FieldGuidance({ issue }: { issue: FieldIssue | undefined }) {
  if (!issue) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="ml-1 text-orange-500 hover:text-orange-700">
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 text-sm" side="top">
        {issue.guidance}
      </PopoverContent>
    </Popover>
  );
}

function OcrStatusBadge({
  status,
  onRetry,
}: {
  status: ReceiptRow["ocrStatus"];
  onRetry?: () => void;
}) {
  if (status === "pending")
    return (
      <Badge variant="secondary" className="gap-1 text-xs">
        <Clock className="h-3 w-3" />
        待機中
      </Badge>
    );
  if (status === "processing")
    return (
      <Badge
        variant="secondary"
        className="gap-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        OCR中
      </Badge>
    );
  if (status === "error")
    return (
      <div className="flex items-center gap-1">
        <Badge variant="destructive" className="gap-1 text-xs">
          <AlertCircle className="h-3 w-3" />
          エラー
        </Badge>
        {onRetry && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onRetry}
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  // done
  return (
    <Badge
      variant="secondary"
      className="gap-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
    >
      <CheckCircle2 className="h-3 w-3" />
      完了
    </Badge>
  );
}

function DuplicateWarning({
  receipt,
  onDismiss,
}: {
  receipt: ReceiptRow;
  onDismiss?: () => void;
}) {
  if (!receipt.duplicateOf) return null;
  return (
    <div
      className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400"
      title={`重複の可能性: ${receipt.duplicateOf.date} / ${receipt.duplicateOf.vendor} / ¥${receipt.duplicateOf.amount.toLocaleString()}`}
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">重複の可能性あり</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-1 hover:text-orange-800 dark:hover:text-orange-200"
          title="重複を無視"
        >
          <XCircle className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function AllFieldsFailedBanner({
  issues,
  onRetakePhoto,
}: {
  issues?: FieldIssue[];
  onRetakePhoto?: () => void;
}) {
  if (!issues || issues.length < 3) return null;
  const isBlurry = issues.every((i) => i.guidance.includes("不鮮明"));
  if (!isBlurry) return null;

  return (
    <div className="flex items-center gap-2 rounded bg-red-50 dark:bg-red-950/30 px-2 py-1 text-xs text-red-600 dark:text-red-400">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      <span>画像が不鮮明です</span>
      {onRetakePhoto && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 text-xs"
          onClick={onRetakePhoto}
        >
          <Camera className="h-3 w-3" />
          再撮影
        </Button>
      )}
    </div>
  );
}

function ConfidenceLabel({ level }: { level?: Confidence }) {
  if (!level) return null;
  const colors = {
    high: "text-green-600 dark:text-green-400",
    medium: "text-orange-600 dark:text-orange-400",
    low: "text-red-600 dark:text-red-400",
  };
  const labels = { high: "高", medium: "中", low: "低" };
  return <span className={cn("text-xs", colors[level])}>{labels[level]}</span>;
}

function ReceiptDetailDialog({
  receipt,
  open,
  onOpenChange,
}: {
  receipt: ReceiptRow | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!receipt) return null;
  const r = receipt;
  const fields = [
    { label: "日付", value: r.ocr.date, confidence: r.ocr.confidence.date },
    {
      label: "取引先",
      value: r.ocr.vendor,
      confidence: r.ocr.confidence.vendor,
    },
    {
      label: "金額(税込)",
      value: r.ocr.amount != null ? `¥${r.ocr.amount.toLocaleString()}` : null,
      confidence: r.ocr.confidence.amount,
    },
    {
      label: "税額",
      value:
        r.ocr.tax_amount != null
          ? `¥${r.ocr.tax_amount.toLocaleString()}`
          : null,
    },
    {
      label: "勘定科目",
      value: r.ocr.category,
      confidence: r.ocr.confidence.category,
    },
    { label: "決済口座", value: r.ocr.payment_method },
    { label: "品目・備考", value: r.ocr.description },
    { label: "レシート番号", value: r.ocr.receipt_number },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{r.fileName}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col sm:flex-row gap-4">
          {r.imageUrl && (
            <div className="sm:w-1/2 shrink-0">
              <img
                src={r.imageUrl}
                alt={r.fileName}
                className="w-full max-h-[70vh] object-contain rounded border"
              />
            </div>
          )}
          <div className="flex-1 space-y-2">
            {fields.map(({ label, value, confidence }) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-2 border-b py-1.5 last:border-0"
              >
                <span className="text-xs text-muted-foreground shrink-0">
                  {label}
                </span>
                <div className="flex items-center gap-1.5 text-sm font-medium text-right">
                  <span>
                    {value || <span className="text-muted-foreground">-</span>}
                  </span>
                  {confidence && <ConfidenceLabel level={confidence} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Keyboard navigation handler
function handleCellKeyDown(
  e: React.KeyboardEvent<HTMLInputElement | HTMLElement>,
) {
  const target = e.currentTarget;
  const row = target.getAttribute("data-row");
  const col = target.getAttribute("data-col");

  if (e.key === "Enter" && row != null && col != null) {
    e.preventDefault();
    const nextRow = parseInt(row) + 1;
    const nextEl = document.querySelector<HTMLElement>(
      `[data-row="${nextRow}"][data-col="${col}"]`,
    );
    nextEl?.focus();
  } else if (e.key === "Escape") {
    (target as HTMLElement).blur();
  }
}

export function ReceiptTable({
  receipts,
  settings,
  onUpdate,
  onRemove,
  onSelectionChange,
  onRetryOcr,
  onDismissDuplicate,
}: ReceiptTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);
  const retakeInputRef = useRef<HTMLInputElement>(null);
  const [retakeTargetId, setRetakeTargetId] = useState<string | null>(null);

  const doneReceipts = receipts.filter(
    (r) => r.ocrStatus === "done" || r.ocrStatus === "error",
  );
  const allSelected =
    doneReceipts.length > 0 && doneReceipts.every((r) => selectedIds.has(r.id));

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
      onSelectionChange([]);
    } else {
      const all = new Set(doneReceipts.map((r) => r.id));
      setSelectedIds(all);
      onSelectionChange(Array.from(all));
    }
  }, [allSelected, doneReceipts, onSelectionChange]);

  const toggleOne = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onSelectionChange(Array.from(next));
        return next;
      });
    },
    [onSelectionChange],
  );

  const selectedCount = selectedIds.size;

  // Bulk edit
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkPayment, setBulkPayment] = useState("");

  const applyBulk = useCallback(() => {
    for (const id of selectedIds) {
      const updates: Partial<ReceiptRow["ocr"]> = {};
      if (bulkCategory) updates.category = bulkCategory;
      if (bulkPayment) updates.payment_method = bulkPayment;
      if (Object.keys(updates).length > 0) onUpdate(id, updates);
    }
    setBulkCategory("");
    setBulkPayment("");
  }, [selectedIds, bulkCategory, bulkPayment, onUpdate]);

  if (receipts.length === 0) return null;

  const isRowDisabled = (r: ReceiptRow) =>
    r.ocrStatus === "pending" || r.ocrStatus === "processing";

  return (
    <div className="space-y-3">
      {/* Hidden file input for re-capture */}
      <input
        ref={retakeInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          // Re-capture not fully wired since it replaces the image
          // For now just focus on showing the guidance
          e.target.value = "";
        }}
      />

      {/* Bulk edit bar */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-accent/50 p-3">
          <span className="text-sm font-medium">{selectedCount}件を選択中</span>
          <Select value={bulkCategory} onValueChange={setBulkCategory}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="勘定科目" />
            </SelectTrigger>
            <SelectContent>
              {settings.categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={bulkPayment} onValueChange={setBulkPayment}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="決済口座" />
            </SelectTrigger>
            <SelectContent>
              {settings.paymentMethods.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="secondary"
            onClick={applyBulk}
            disabled={!bulkCategory && !bulkPayment}
          >
            一括適用
          </Button>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-10 p-2">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </th>
              <th className="w-14 p-2">画像</th>
              <th className="p-2 text-left">状態</th>
              <th className="p-2 text-left">日付</th>
              <th className="p-2 text-left">取引先</th>
              <th className="p-2 text-right">金額(税込)</th>
              <th className="p-2 text-left">勘定科目</th>
              <th className="p-2 text-left">決済口座</th>
              <th className="p-2 text-left">備考</th>
              <th className="w-10 p-2" />
            </tr>
          </thead>
          <tbody>
            {receipts.map((r, rowIdx) => {
              const disabled = isRowDisabled(r);
              const dateIssue = getFieldIssue(r.fieldIssues, "date");
              const amountIssue = getFieldIssue(r.fieldIssues, "amount");
              const vendorIssue = getFieldIssue(r.fieldIssues, "vendor");
              return (
                <tr
                  key={r.id}
                  className={cn(
                    "border-b last:border-0 hover:bg-muted/30",
                    r.duplicateOf &&
                      "border-l-4 border-l-orange-400 bg-orange-50/50 dark:bg-orange-950/20",
                    disabled && "opacity-60",
                  )}
                >
                  <td className="p-2 text-center">
                    <Checkbox
                      checked={selectedIds.has(r.id)}
                      onCheckedChange={() => toggleOne(r.id)}
                      disabled={disabled}
                    />
                  </td>
                  <td className="p-2">
                    {r.imageUrl ? (
                      <img
                        src={r.imageUrl}
                        alt=""
                        className="h-10 w-10 rounded object-cover cursor-pointer hover:ring-2 hover:ring-primary/50 transition-shadow"
                        onClick={() => setSelectedDetailId(r.id)}
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                        -
                      </div>
                    )}
                  </td>
                  <td className="p-2">
                    <div className="space-y-1">
                      <OcrStatusBadge
                        status={r.ocrStatus}
                        onRetry={
                          onRetryOcr ? () => onRetryOcr(r.id) : undefined
                        }
                      />
                      <DuplicateWarning
                        receipt={r}
                        onDismiss={
                          onDismissDuplicate
                            ? () => onDismissDuplicate(r.id)
                            : undefined
                        }
                      />
                      <AllFieldsFailedBanner issues={r.fieldIssues} />
                    </div>
                  </td>
                  <td
                    className={cn(
                      "p-2",
                      !disabled &&
                        confidenceBg(r.ocr.date, r.ocr.confidence.date),
                    )}
                  >
                    <div className="flex items-center">
                      <Input
                        type="date"
                        value={r.ocr.date || ""}
                        onChange={(e) =>
                          onUpdate(r.id, { date: e.target.value || null })
                        }
                        className="h-8 w-36 text-xs"
                        disabled={disabled}
                        data-row={rowIdx}
                        data-col={0}
                        onKeyDown={handleCellKeyDown}
                      />
                      <FieldGuidance issue={dateIssue} />
                    </div>
                  </td>
                  <td
                    className={cn(
                      "p-2",
                      !disabled &&
                        confidenceBg(r.ocr.vendor, r.ocr.confidence.vendor),
                    )}
                  >
                    <div className="flex items-center">
                      <Input
                        value={r.ocr.vendor || ""}
                        onChange={(e) =>
                          onUpdate(r.id, { vendor: e.target.value || null })
                        }
                        className="h-8 text-xs"
                        placeholder="取引先名"
                        disabled={disabled}
                        data-row={rowIdx}
                        data-col={1}
                        onKeyDown={handleCellKeyDown}
                      />
                      <FieldGuidance issue={vendorIssue} />
                    </div>
                  </td>
                  <td
                    className={cn(
                      "p-2",
                      !disabled &&
                        confidenceBg(r.ocr.amount, r.ocr.confidence.amount),
                    )}
                  >
                    <div className="flex items-center">
                      <Input
                        type="number"
                        value={r.ocr.amount ?? ""}
                        onChange={(e) =>
                          onUpdate(r.id, {
                            amount: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                        className="h-8 w-24 text-right text-xs"
                        placeholder="0"
                        disabled={disabled}
                        data-row={rowIdx}
                        data-col={2}
                        onKeyDown={handleCellKeyDown}
                      />
                      <FieldGuidance issue={amountIssue} />
                    </div>
                  </td>
                  <td
                    className={cn(
                      "p-2",
                      !disabled &&
                        confidenceBg(r.ocr.category, r.ocr.confidence.category),
                    )}
                  >
                    <Select
                      value={r.ocr.category || ""}
                      onValueChange={(v) => onUpdate(r.id, { category: v })}
                      disabled={disabled}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="選択..." />
                      </SelectTrigger>
                      <SelectContent>
                        {settings.categories.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Select
                      value={r.ocr.payment_method || ""}
                      onValueChange={(v) =>
                        onUpdate(r.id, { payment_method: v })
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="選択..." />
                      </SelectTrigger>
                      <SelectContent>
                        {settings.paymentMethods.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Input
                      value={r.ocr.description || ""}
                      onChange={(e) =>
                        onUpdate(r.id, { description: e.target.value || null })
                      }
                      className="h-8 text-xs"
                      placeholder="品目・内容"
                      disabled={disabled}
                      data-row={rowIdx}
                      data-col={3}
                      onKeyDown={handleCellKeyDown}
                    />
                  </td>
                  <td className="p-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => onRemove(r.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Receipt detail dialog */}
      <ReceiptDetailDialog
        receipt={receipts.find((r) => r.id === selectedDetailId)}
        open={selectedDetailId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedDetailId(null);
        }}
      />

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {receipts.map((r, rowIdx) => {
          const disabled = isRowDisabled(r);
          const dateIssue = getFieldIssue(r.fieldIssues, "date");
          const amountIssue = getFieldIssue(r.fieldIssues, "amount");
          const vendorIssue = getFieldIssue(r.fieldIssues, "vendor");
          return (
            <div
              key={r.id}
              className={cn(
                "rounded-lg border bg-card p-3 space-y-3",
                r.duplicateOf &&
                  "border-orange-400 bg-orange-50/50 dark:bg-orange-950/20",
              )}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedIds.has(r.id)}
                  onCheckedChange={() => toggleOne(r.id)}
                  className="mt-1"
                  disabled={disabled}
                />
                {r.imageUrl && (
                  <img
                    src={r.imageUrl}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded object-cover cursor-pointer hover:ring-2 hover:ring-primary/50 transition-shadow"
                    onClick={() => setSelectedDetailId(r.id)}
                  />
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <OcrStatusBadge
                        status={r.ocrStatus}
                        onRetry={
                          onRetryOcr ? () => onRetryOcr(r.id) : undefined
                        }
                      />
                      <DuplicateWarning
                        receipt={r}
                        onDismiss={
                          onDismissDuplicate
                            ? () => onDismissDuplicate(r.id)
                            : undefined
                        }
                      />
                      <AllFieldsFailedBanner issues={r.fieldIssues} />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-destructive"
                      onClick={() => onRemove(r.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {!disabled && (
                    <>
                      <div className="flex items-center">
                        <Input
                          type="date"
                          value={r.ocr.date || ""}
                          onChange={(e) =>
                            onUpdate(r.id, { date: e.target.value || null })
                          }
                          className={cn(
                            "h-8 text-xs",
                            confidenceBg(r.ocr.date, r.ocr.confidence.date),
                          )}
                          data-row={rowIdx}
                          data-col={0}
                          onKeyDown={handleCellKeyDown}
                        />
                        <FieldGuidance issue={dateIssue} />
                      </div>
                      <div className="flex items-center">
                        <Input
                          value={r.ocr.vendor || ""}
                          onChange={(e) =>
                            onUpdate(r.id, { vendor: e.target.value || null })
                          }
                          className={cn(
                            "h-8 text-xs",
                            confidenceBg(r.ocr.vendor, r.ocr.confidence.vendor),
                          )}
                          placeholder="取引先名"
                          data-row={rowIdx}
                          data-col={1}
                          onKeyDown={handleCellKeyDown}
                        />
                        <FieldGuidance issue={vendorIssue} />
                      </div>
                    </>
                  )}
                </div>
              </div>
              {!disabled && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">
                      金額(税込)
                    </label>
                    <div className="flex items-center">
                      <Input
                        type="number"
                        value={r.ocr.amount ?? ""}
                        onChange={(e) =>
                          onUpdate(r.id, {
                            amount: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                        className={cn(
                          "h-8 text-xs",
                          confidenceBg(r.ocr.amount, r.ocr.confidence.amount),
                        )}
                        placeholder="0"
                        data-row={rowIdx}
                        data-col={2}
                        onKeyDown={handleCellKeyDown}
                      />
                      <FieldGuidance issue={amountIssue} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      勘定科目
                    </label>
                    <Select
                      value={r.ocr.category || ""}
                      onValueChange={(v) => onUpdate(r.id, { category: v })}
                    >
                      <SelectTrigger
                        className={cn(
                          "h-8 text-xs",
                          confidenceBg(
                            r.ocr.category,
                            r.ocr.confidence.category,
                          ),
                        )}
                      >
                        <SelectValue placeholder="選択..." />
                      </SelectTrigger>
                      <SelectContent>
                        {settings.categories.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      決済口座
                    </label>
                    <Select
                      value={r.ocr.payment_method || ""}
                      onValueChange={(v) =>
                        onUpdate(r.id, { payment_method: v })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="選択..." />
                      </SelectTrigger>
                      <SelectContent>
                        {settings.paymentMethods.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      備考
                    </label>
                    <Input
                      value={r.ocr.description || ""}
                      onChange={(e) =>
                        onUpdate(r.id, { description: e.target.value || null })
                      }
                      className="h-8 text-xs"
                      placeholder="品目・内容"
                      data-row={rowIdx}
                      data-col={3}
                      onKeyDown={handleCellKeyDown}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
