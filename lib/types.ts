export type Confidence = "high" | "medium" | "low";

export interface OCRFieldResult<T> {
  value: T | null;
  confidence: Confidence;
}

export interface ReceiptOCRResult {
  date: string | null;
  amount: number | null;
  tax_amount: number | null;
  vendor: string | null;
  category: string | null;
  description: string | null;
  payment_method: string | null;
  receipt_number: string | null;
  confidence: {
    date: Confidence;
    amount: Confidence;
    vendor: Confidence;
  };
}

export interface ReceiptRow {
  id: string;
  imageFile?: File;
  imageUrl?: string;
  fileName: string;
  ocr: ReceiptOCRResult;
  selected: boolean;
}

export interface UserSettings {
  year: number;
  paymentMethods: string[];
  categories: string[];
}

export const DEFAULT_SETTINGS: UserSettings = {
  year: new Date().getFullYear(),
  paymentMethods: [
    "現金",
    "プライベート資金",
    "事業用口座",
    "クレジットカード",
  ],
  categories: [
    "旅費交通費",
    "接待交際費",
    "消耗品費",
    "通信費",
    "地代家賃",
    "水道光熱費",
    "広告宣伝費",
    "新聞図書費",
    "雑費",
    "外注費",
  ],
};

export interface FreeeRow {
  収支区分: string;
  管理番号: string;
  発生日: string;
  決済期日: string;
  取引先: string;
  勘定科目: string;
  税区分: string;
  金額: string;
  税計算区分: string;
  税額: string;
  備考: string;
  品目: string;
  部門: string;
  メモタグ: string;
  決済日: string;
  決済口座: string;
  決済金額: string;
  対象のつく仕訳を自動作成: string;
  支出元口座: string;
  取引先コード: string;
  収支計上日: string;
}

export const FREEE_COLUMNS = [
  "収支区分",
  "管理番号",
  "発生日",
  "決済期日",
  "取引先",
  "勘定科目",
  "税区分",
  "金額",
  "税計算区分",
  "税額",
  "備考",
  "品目",
  "部門",
  "メモタグ",
  "決済日",
  "決済口座",
  "決済金額",
  "\"対象\"のつく仕訳を自動作成",
  "支出元口座",
  "取引先コード",
  "収支計上日",
] as const;

export interface SaveResult {
  sheetsUrl?: string;
  driveResults?: { fileName: string; success: boolean }[];
  error?: string;
}
