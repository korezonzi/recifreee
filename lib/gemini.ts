import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import type { ReceiptOCRResult, Confidence } from "./types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const responseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    date: { type: SchemaType.STRING, nullable: true },
    amount: { type: SchemaType.NUMBER, nullable: true },
    tax_amount: { type: SchemaType.NUMBER, nullable: true },
    vendor: { type: SchemaType.STRING, nullable: true },
    category: { type: SchemaType.STRING, nullable: true },
    description: { type: SchemaType.STRING, nullable: true },
    payment_method: { type: SchemaType.STRING, nullable: true },
    receipt_number: { type: SchemaType.STRING, nullable: true },
    confidence: {
      type: SchemaType.OBJECT,
      properties: {
        date: { type: SchemaType.STRING, format: "enum", enum: ["high", "medium", "low"] },
        amount: { type: SchemaType.STRING, format: "enum", enum: ["high", "medium", "low"] },
        vendor: { type: SchemaType.STRING, format: "enum", enum: ["high", "medium", "low"] },
      },
      required: ["date", "amount", "vendor"],
    },
  },
  required: ["date", "amount", "vendor", "confidence"],
};

const OCR_PROMPT = `以下の領収書画像から情報を読み取り、JSON形式で返してください。
読み取れない項目はnullとしてください。

{
  "date": "YYYY-MM-DD（利用日）",
  "amount": 数値（税込合計金額）,
  "tax_amount": 数値（消費税額、判別できれば）,
  "vendor": "店舗名・取引先名",
  "category": "勘定科目の推定（例: 旅費交通費、接待交際費、消耗品費、通信費 等）",
  "description": "品目・内容の要約",
  "payment_method": "支払方法（現金、クレジットカード等、判別できれば）",
  "receipt_number": "レシート番号（あれば）",
  "confidence": {
    "date": "high|medium|low",
    "amount": "high|medium|low",
    "vendor": "high|medium|low"
  }
}`;

export async function processReceiptOCR(
  imageBase64: string,
  mimeType: string
): Promise<ReceiptOCRResult> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  const result = await model.generateContent([
    OCR_PROMPT,
    {
      inlineData: {
        data: imageBase64,
        mimeType,
      },
    },
  ]);

  const text = result.response.text();
  const parsed = JSON.parse(text) as ReceiptOCRResult;

  return postProcessConfidence(parsed);
}

function postProcessConfidence(ocr: ReceiptOCRResult): ReceiptOCRResult {
  const result = { ...ocr, confidence: { ...ocr.confidence } };

  // Date validation
  if (ocr.date) {
    const d = new Date(ocr.date);
    const now = new Date();
    if (
      isNaN(d.getTime()) ||
      d.getFullYear() < now.getFullYear() - 5 ||
      d > now
    ) {
      result.confidence.date = "low";
    }
  } else {
    result.confidence.date = "low";
  }

  // Amount validation
  if (ocr.amount != null) {
    if (ocr.amount <= 0 || ocr.amount > 1_000_000) {
      result.confidence.amount = "low";
    }
  } else {
    result.confidence.amount = "low";
  }

  // Vendor validation
  if (!ocr.vendor || ocr.vendor.trim() === "") {
    result.confidence.vendor = "low";
  }

  return result;
}

export class Semaphore {
  private queue: (() => void)[] = [];
  private running = 0;

  constructor(private maxConcurrent: number) {}

  async acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.running++;
        resolve();
      });
    });
  }

  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) next();
  }
}
