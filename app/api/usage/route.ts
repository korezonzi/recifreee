import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUsageData } from "@/lib/drive";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const usage = await getUsageData(session.accessToken);
    return NextResponse.json(usage);
  } catch (error) {
    console.error("Failed to get usage data:", error);
    return NextResponse.json({
      month: new Date().toISOString().slice(0, 7),
      count: 0,
      plan: "free",
      limit: 10,
    });
  }
}
