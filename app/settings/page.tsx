"use client";

import { useSession } from "next-auth/react";
import { Header } from "@/components/header";
import { SettingsForm } from "@/components/settings-form";

export default function SettingsPage() {
  const { data: session } = useSession();
  if (!session) return null;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-xl font-bold">設定</h1>
        <SettingsForm />
      </main>
    </>
  );
}
