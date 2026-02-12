import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { appendToSheet, receiptToFreeeRow, getSheetData } from "@/lib/sheets";
import { loadUserSettings } from "@/lib/drive";
import type { ReceiptOCRResult } from "@/lib/types";

interface SheetRequestBody {
  receipts: {
    ocr: ReceiptOCRResult;
    paymentMethod?: string;
  }[];
  year?: number;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const year = Number(req.nextUrl.searchParams.get("year")) || new Date().getFullYear();

  try {
    const rows = await getSheetData(session.accessToken, year);
    return NextResponse.json({ rows });
  } catch (error) {
    console.error("Failed to fetch sheet data:", error);
    return NextResponse.json({ rows: [] });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as SheetRequestBody;
  const settings = await loadUserSettings(session.accessToken);
  const year = body.year || settings.year;

  const rows = body.receipts.map((r) =>
    receiptToFreeeRow(r.ocr, r.paymentMethod)
  );

  const confidences = body.receipts.map((r) => r.ocr.confidence);

  const sheetsUrl = await appendToSheet(
    session.accessToken,
    year,
    rows,
    confidences
  );

  return NextResponse.json({ url: sheetsUrl });
}
