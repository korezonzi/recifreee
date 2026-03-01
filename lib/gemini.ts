import {
  GoogleGenerativeAI,
  SchemaType,
  type Schema,
} from "@google/generative-ai";
import type { ReceiptOCRResult, Confidence, FieldIssue } from "./types";

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
        date: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["high", "medium", "low"],
        },
        amount: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["high", "medium", "low"],
        },
        vendor: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["high", "medium", "low"],
        },
        category: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["high", "medium", "low"],
        },
      },
      required: ["date", "amount", "vendor", "category"],
    },
  },
  required: ["date", "amount", "vendor", "confidence"],
};

const BASE_OCR_PROMPT = `以下の領収書画像から情報を読み取り、JSON形式で返してください。
読み取れない項目はnullとしてください。

{
  "date": "YYYY-MM-DD（利用日）",
  "amount": 数値（税込合計金額）,
  "tax_amount": 数値（消費税額、判別できれば）,
  "vendor": "店舗名・取引先名",
  "category": "勘定科目の推定（例: 旅費交通費、交際費、消耗品費、通信費 等）",
  "description": "品目・内容の要約",
  "payment_method": "支払方法（現金、クレジットカード等、判別できれば）",
  "receipt_number": "レシート番号（あれば）",
  "confidence": {
    "date": "high|medium|low",
    "amount": "high|medium|low",
    "vendor": "high|medium|low",
    "category": "high|medium|low"
  }
}`;

export async function processReceiptOCR(
  imageBase64: string,
  mimeType: string,
  categories?: string[],
): Promise<ReceiptOCRResult> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  let prompt = BASE_OCR_PROMPT;
  if (categories && categories.length > 0) {
    prompt += `\n\ncategoryは以下から選択してください: ${categories.join("、")}`;
  }

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: imageBase64,
        mimeType,
      },
    },
  ]);

  const text = result.response.text();
  const parsed = JSON.parse(text) as ReceiptOCRResult;

  return postProcessConfidence(parsed, categories);
}

function postProcessConfidence(
  ocr: ReceiptOCRResult,
  categories?: string[],
): ReceiptOCRResult {
  const result = { ...ocr, confidence: { ...ocr.confidence } };

  // Ensure category confidence exists (backward compat)
  if (!result.confidence.category) {
    result.confidence.category = "low";
  }

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

  // Category validation
  if (!ocr.category || ocr.category.trim() === "") {
    result.confidence.category = "low";
  } else if (
    categories &&
    categories.length > 0 &&
    !categories.includes(ocr.category)
  ) {
    result.confidence.category = "low";
  }

  return result;
}

export function analyzeOcrQuality(ocr: ReceiptOCRResult): FieldIssue[] {
  const issues: FieldIssue[] = [];

  if (!ocr.date) {
    issues.push({
      field: "date",
      issue: "missing",
      guidance: "日付が読み取れません。手入力してください",
    });
  }

  if (ocr.amount == null || ocr.amount === 0) {
    issues.push({
      field: "amount",
      issue: ocr.amount === 0 ? "invalid" : "missing",
      guidance: "金額が読み取れませんでした。手入力してください",
    });
  }

  if (!ocr.vendor || ocr.vendor.trim() === "") {
    issues.push({
      field: "vendor",
      issue: "missing",
      guidance: "取引先名が読み取れません。手入力してください",
    });
  }

  // All fields failed - likely blurry image
  if (issues.length === 3) {
    issues.length = 0;
    issues.push(
      {
        field: "date",
        issue: "missing",
        guidance: "画像が不鮮明です。再撮影をお試しください",
      },
      {
        field: "amount",
        issue: "missing",
        guidance: "画像が不鮮明です。再撮影をお試しください",
      },
      {
        field: "vendor",
        issue: "missing",
        guidance: "画像が不鮮明です。再撮影をお試しください",
      },
    );
  }

  return issues;
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
