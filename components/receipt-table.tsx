"use client";

import { useCallback, useState } from "react";
import { Trash2, Loader2, Clock, AlertCircle, AlertTriangle, RotateCcw, CheckCircle2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { ReceiptRow, Confidence, UserSettings } from "@/lib/types";

interface ReceiptTableProps {
  receipts: ReceiptRow[];
  settings: UserSettings;
  onUpdate: (id: string, updates: Partial<ReceiptRow["ocr"]>) => void;
  onRemove: (id: string) => void;
  onSelectionChange: (ids: string[]) => void;
  onRetryOcr?: (id: string) => void;
}

function confidenceBg(
  value: string | number | null | undefined,
  confidence?: Confidence
): string {
  if (value == null || value === "") return "bg-red-50";
  if (confidence === "low") return "bg-yellow-50";
  return "";
}

function OcrStatusBadge({ status, onRetry }: { status: ReceiptRow["ocrStatus"]; onRetry?: () => void }) {
  if (status === "pending")
    return (
      <Badge variant="secondary" className="gap-1 text-xs">
        <Clock className="h-3 w-3" />
        待機中
      </Badge>
    );
  if (status === "processing")
    return (
      <Badge variant="secondary" className="gap-1 text-xs bg-blue-100 text-blue-700">
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
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRetry}>
            <RotateCcw className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  // done
  return (
    <Badge variant="secondary" className="gap-1 text-xs bg-green-100 text-green-700">
      <CheckCircle2 className="h-3 w-3" />
      完了
    </Badge>
  );
}

function DuplicateWarning({ receipt }: { receipt: ReceiptRow }) {
  if (!receipt.duplicateOf) return null;
  return (
    <div className="flex items-center gap-1 text-xs text-orange-600" title={`重複の可能性: ${receipt.duplicateOf.date} / ${receipt.duplicateOf.vendor} / ¥${receipt.duplicateOf.amount.toLocaleString()}`}>
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">重複の可能性あり</span>
    </div>
  );
}

export function ReceiptTable({
  receipts,
  settings,
  onUpdate,
  onRemove,
  onSelectionChange,
  onRetryOcr,
}: ReceiptTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const doneReceipts = receipts.filter((r) => r.ocrStatus === "done" || r.ocrStatus === "error");
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
    [onSelectionChange]
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

  const isRowDisabled = (r: ReceiptRow) => r.ocrStatus === "pending" || r.ocrStatus === "processing";

  return (
    <div className="space-y-3">
      {/* Bulk edit bar */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-accent/50 p-3">
          <span className="text-sm font-medium">
            {selectedCount}件を選択中
          </span>
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
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                />
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
            {receipts.map((r) => {
              const disabled = isRowDisabled(r);
              return (
                <tr
                  key={r.id}
                  className={cn(
                    "border-b last:border-0 hover:bg-muted/30",
                    r.duplicateOf && "border-l-4 border-l-orange-400 bg-orange-50/50",
                    disabled && "opacity-60"
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
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                        -
                      </div>
                    )}
                  </td>
                  <td className="p-2">
                    <div className="space-y-1">
                      <OcrStatusBadge status={r.ocrStatus} onRetry={onRetryOcr ? () => onRetryOcr(r.id) : undefined} />
                      <DuplicateWarning receipt={r} />
                    </div>
                  </td>
                  <td className={cn("p-2", !disabled && confidenceBg(r.ocr.date, r.ocr.confidence.date))}>
                    <Input
                      type="date"
                      value={r.ocr.date || ""}
                      onChange={(e) =>
                        onUpdate(r.id, { date: e.target.value || null })
                      }
                      className="h-8 w-36 text-xs"
                      disabled={disabled}
                    />
                  </td>
                  <td className={cn("p-2", !disabled && confidenceBg(r.ocr.vendor, r.ocr.confidence.vendor))}>
                    <Input
                      value={r.ocr.vendor || ""}
                      onChange={(e) =>
                        onUpdate(r.id, { vendor: e.target.value || null })
                      }
                      className="h-8 text-xs"
                      placeholder="取引先名"
                      disabled={disabled}
                    />
                  </td>
                  <td className={cn("p-2", !disabled && confidenceBg(r.ocr.amount, r.ocr.confidence.amount))}>
                    <Input
                      type="number"
                      value={r.ocr.amount ?? ""}
                      onChange={(e) =>
                        onUpdate(r.id, {
                          amount: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="h-8 w-24 text-right text-xs"
                      placeholder="0"
                      disabled={disabled}
                    />
                  </td>
                  <td className="p-2">
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

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {receipts.map((r) => {
          const disabled = isRowDisabled(r);
          return (
            <div
              key={r.id}
              className={cn(
                "rounded-lg border bg-card p-3 space-y-3",
                r.duplicateOf && "border-orange-400 bg-orange-50/50"
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
                    className="h-16 w-16 shrink-0 rounded object-cover"
                  />
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <OcrStatusBadge status={r.ocrStatus} onRetry={onRetryOcr ? () => onRetryOcr(r.id) : undefined} />
                      <DuplicateWarning receipt={r} />
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
                      <Input
                        type="date"
                        value={r.ocr.date || ""}
                        onChange={(e) =>
                          onUpdate(r.id, { date: e.target.value || null })
                        }
                        className={cn(
                          "h-8 text-xs",
                          confidenceBg(r.ocr.date, r.ocr.confidence.date)
                        )}
                      />
                      <Input
                        value={r.ocr.vendor || ""}
                        onChange={(e) =>
                          onUpdate(r.id, { vendor: e.target.value || null })
                        }
                        className={cn(
                          "h-8 text-xs",
                          confidenceBg(r.ocr.vendor, r.ocr.confidence.vendor)
                        )}
                        placeholder="取引先名"
                      />
                    </>
                  )}
                </div>
              </div>
              {!disabled && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">金額(税込)</label>
                    <Input
                      type="number"
                      value={r.ocr.amount ?? ""}
                      onChange={(e) =>
                        onUpdate(r.id, {
                          amount: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className={cn(
                        "h-8 text-xs",
                        confidenceBg(r.ocr.amount, r.ocr.confidence.amount)
                      )}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      勘定科目
                    </label>
                    <Select
                      value={r.ocr.category || ""}
                      onValueChange={(v) => onUpdate(r.id, { category: v })}
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
                    <label className="text-xs text-muted-foreground">備考</label>
                    <Input
                      value={r.ocr.description || ""}
                      onChange={(e) =>
                        onUpdate(r.id, { description: e.target.value || null })
                      }
                      className="h-8 text-xs"
                      placeholder="品目・内容"
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
