"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessages: Record<string, string> = {
    Configuration: "サーバー設定に問題があります。管理者に連絡してください。",
    AccessDenied: "このアカウントはアクセスが許可されていません。",
    Verification: "認証トークンの期限切れです。再度ログインしてください。",
    Default: "認証中にエラーが発生しました。",
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">認証エラー</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {errorMessages[error || ""] || errorMessages.Default}
          </p>
          <p className="text-xs text-muted-foreground">
            エラーコード: {error || "unknown"}
          </p>
          <Link href="/login">
            <Button className="w-full">ログイン画面に戻る</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  );
}
