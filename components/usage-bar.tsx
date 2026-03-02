"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UsageBarProps {
  count: number;
  limit: number;
  plan: "free" | "pro";
  limitReached: boolean;
}

export function UsageBar({ count, limit, plan, limitReached }: UsageBarProps) {
  if (plan === "pro") {
    return (
      <div className="text-xs text-muted-foreground">Pro プラン: 無制限</div>
    );
  }

  const percentage = Math.min((count / limit) * 100, 100);

  return (
    <>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            今月: {count}/{limit}枚
          </span>
          {count >= limit && (
            <span className="text-destructive font-medium">上限到達</span>
          )}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${percentage}%`,
              backgroundColor:
                percentage >= 90 ? "var(--destructive)" : "var(--primary)",
            }}
          />
        </div>
      </div>

      <Dialog open={limitReached}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>月間処理上限に達しました</DialogTitle>
            <DialogDescription>
              Freeプランの月間処理上限（{limit}枚）に達しました。
              引き続きご利用いただくには、Proプランへのアップグレードをご検討ください。
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
