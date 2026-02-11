import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ensureFolderStructure, uploadReceiptImage } from "@/lib/drive";
import type { ReceiptOCRResult } from "@/lib/types";

interface DriveUploadItem {
  ocr: ReceiptOCRResult;
  fileName: string;
  imageBase64: string;
  mimeType: string;
  year: number;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { items: DriveUploadItem[] };

  // Group items by year-month
  const grouped = new Map<string, DriveUploadItem[]>();
  for (const item of body.items) {
    let month: number;
    if (item.ocr.date) {
      const d = new Date(item.ocr.date);
      month = d.getMonth() + 1;
    } else {
      month = new Date().getMonth() + 1;
    }
    const key = `${item.year}-${month}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  // Ensure folders and upload
  const results: { fileName: string; success: boolean; driveFileName?: string }[] = [];

  for (const [key, items] of grouped) {
    const [yearStr, monthStr] = key.split("-");
    const folderId = await ensureFolderStructure(
      session.accessToken,
      parseInt(yearStr),
      parseInt(monthStr)
    );

    for (const item of items) {
      try {
        const buffer = Buffer.from(item.imageBase64, "base64");
        const uploaded = await uploadReceiptImage(
          session.accessToken,
          folderId,
          buffer,
          item.mimeType,
          item.ocr.date,
          item.ocr.vendor,
          item.ocr.amount,
          item.fileName
        );
        results.push({
          fileName: item.fileName,
          success: true,
          driveFileName: uploaded.name,
        });
      } catch (error) {
        console.error(`Drive upload failed for ${item.fileName}:`, error);
        results.push({ fileName: item.fileName, success: false });
      }
    }
  }

  return NextResponse.json({ results });
}
