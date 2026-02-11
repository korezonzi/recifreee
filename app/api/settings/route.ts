import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadUserSettings, saveUserSettings } from "@/lib/drive";
import type { UserSettings } from "@/lib/types";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await loadUserSettings(session.accessToken);
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as UserSettings;
  await saveUserSettings(session.accessToken, body);
  return NextResponse.json({ ok: true });
}
