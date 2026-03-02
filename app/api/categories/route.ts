import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadCategoryLearning, saveCategoryLearning } from "@/lib/drive";
import { recordCategoryChoice } from "@/lib/category-learning";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { vendor, category } = await req.json();

  if (!vendor || !category) {
    return NextResponse.json(
      { error: "Missing vendor or category" },
      { status: 400 },
    );
  }

  try {
    const learningData = await loadCategoryLearning(session.accessToken);
    const updated = recordCategoryChoice(learningData, vendor, category);
    await saveCategoryLearning(session.accessToken, updated);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to record category choice:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
