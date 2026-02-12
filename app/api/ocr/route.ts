import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { processReceiptOCR } from "@/lib/gemini";
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

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "image/jpeg";
    const result = await processReceiptOCR(base64, mimeType);
    return NextResponse.json({ result });
  } catch (error) {
    console.error(`OCR failed for file (${file.name}):`, error);
    return NextResponse.json({ result: createEmptyResult() });
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
    confidence: { date: "low", amount: "low", vendor: "low" },
  };
}
