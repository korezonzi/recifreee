import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { processReceiptOCR, analyzeOcrQuality } from "@/lib/gemini";
import {
  loadUserSettings,
  loadCategoryLearning,
  incrementUsage,
} from "@/lib/drive";
import { applyCategoryLearning } from "@/lib/category-learning";
import type { ReceiptOCRResult } from "@/lib/types";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Check usage limit
  try {
    const usage = await incrementUsage(session.accessToken);
    if (!usage.allowed) {
      return NextResponse.json(
        {
          error: "Monthly limit reached",
          count: usage.count,
          limit: usage.limit,
          plan: usage.plan,
        },
        { status: 429 },
      );
    }
  } catch (error) {
    console.error("Usage check failed:", error);
    // Allow OCR to proceed if usage check fails
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "image/jpeg";

    // Load user settings and learning data
    const [settings, learningData] = await Promise.all([
      loadUserSettings(session.accessToken),
      loadCategoryLearning(session.accessToken),
    ]);

    let result = await processReceiptOCR(base64, mimeType, settings.categories);

    // Apply category learning
    result = applyCategoryLearning(result, learningData);

    // Analyze OCR quality for field issues
    const fieldIssues = analyzeOcrQuality(result);

    return NextResponse.json({ result, fieldIssues });
  } catch (error) {
    console.error(`OCR failed for file (${file.name}):`, error);
    return NextResponse.json({ result: createEmptyResult(), fieldIssues: [] });
  }
}

function createEmptyResult(): ReceiptOCRResult {
  return {
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
}
