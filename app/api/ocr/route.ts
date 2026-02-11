import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { processReceiptOCR, Semaphore } from "@/lib/gemini";
import type { ReceiptOCRResult } from "@/lib/types";

const semaphore = new Semaphore(3);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const results = await Promise.allSettled(
    files.map(async (file, index) => {
      await semaphore.acquire();
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64 = buffer.toString("base64");
        const mimeType = file.type || "image/jpeg";
        return await processReceiptOCR(base64, mimeType);
      } catch (error) {
        console.error(`OCR failed for file ${index} (${file.name}):`, error);
        return createEmptyResult();
      } finally {
        semaphore.release();
      }
    })
  );

  const ocrResults: ReceiptOCRResult[] = results.map((r) =>
    r.status === "fulfilled" ? r.value : createEmptyResult()
  );

  return NextResponse.json({ results: ocrResults });
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
