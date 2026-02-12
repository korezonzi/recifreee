import { google } from "googleapis";
import type { ReceiptOCRResult } from "./types";
import { FREEE_COLUMNS } from "./types";
import { ensureRootFolder } from "./drive";

function getSheetsClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: "v4", auth });
}

function getDriveClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth });
}

const SHEET_NAME = "経費データ";

async function findOrCreateSpreadsheet(
  accessToken: string,
  year: number
): Promise<string> {
  const drive = getDriveClient(accessToken);
  const rootId = await ensureRootFolder(accessToken);
  const fileName = `${year}年_経費`;

  const res = await drive.files.list({
    q: `'${rootId}' in parents and name='${fileName}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }

  const sheets = getSheetsClient(accessToken);
  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: fileName },
      sheets: [
        {
          properties: {
            title: SHEET_NAME,
            gridProperties: { frozenRowCount: 1 },
          },
        },
      ],
    },
  });

  const spreadsheetId = created.data.spreadsheetId!;

  // Move to 確定申告 folder
  const fileInfo = await drive.files.get({
    fileId: spreadsheetId,
    fields: "parents",
  });
  const previousParents = (fileInfo.data.parents || []).join(",");
  await drive.files.update({
    fileId: spreadsheetId,
    addParents: rootId,
    removeParents: previousParents,
    fields: "id, parents",
  });

  // Write header row
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME}!A1:U1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [FREEE_COLUMNS as unknown as string[]],
    },
  });

  // Format header
  const sheetId = created.data.sheets![0].properties!.sheetId!;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: FREEE_COLUMNS.length,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                textFormat: {
                  bold: true,
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                },
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat)",
          },
        },
        {
          updateSheetProperties: {
            properties: {
              sheetId,
              gridProperties: { frozenRowCount: 1 },
            },
            fields: "gridProperties.frozenRowCount",
          },
        },
      ],
    },
  });

  return spreadsheetId;
}

function determineTaxCategory(taxAmount: number | null, amount: number | null): string {
  if (taxAmount == null || amount == null) return "課対仕入10%";
  if (amount === 0) return "課対仕入10%";
  const rate = taxAmount / (amount - taxAmount);
  return rate < 0.09 ? "課対仕入8%" : "課対仕入10%";
}

export function receiptToFreeeRow(
  ocr: ReceiptOCRResult,
  paymentMethod?: string
): string[] {
  const taxCategory = determineTaxCategory(ocr.tax_amount, ocr.amount);

  return [
    "支出",                                    // 収支区分
    "",                                         // 管理番号
    ocr.date || "",                             // 発生日
    "",                                         // 決済期日
    ocr.vendor || "",                           // 取引先
    ocr.category || "",                         // 勘定科目
    taxCategory,                                // 税区分
    ocr.amount != null ? String(ocr.amount) : "", // 金額
    "内税",                                     // 税計算区分
    ocr.tax_amount != null ? String(ocr.tax_amount) : "", // 税額
    ocr.description || "",                      // 備考
    "",                                         // 品目
    "",                                         // 部門
    "",                                         // メモタグ
    ocr.date || "",                             // 決済日
    paymentMethod || "",                        // 決済口座
    ocr.amount != null ? String(ocr.amount) : "", // 決済金額
    "",                                         // "対象"のつく仕訳を自動作成
    "",                                         // 支出元口座
    "",                                         // 取引先コード
    "",                                         // 収支計上日
  ];
}

interface ConfidenceInfo {
  date: string;
  amount: string;
  vendor: string;
}

export async function appendToSheet(
  accessToken: string,
  year: number,
  rows: string[][],
  confidences: ConfidenceInfo[]
): Promise<string> {
  const spreadsheetId = await findOrCreateSpreadsheet(accessToken, year);
  const sheets = getSheetsClient(accessToken);

  // Get current row count
  const current = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A:A`,
  });
  const startRow = (current.data.values?.length || 1) + 1;

  // Append data
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME}!A${startRow}:U${startRow + rows.length - 1}`,
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });

  // Apply confidence-based coloring
  const sheetInfo = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });
  const sheetId = sheetInfo.data.sheets![0].properties!.sheetId!;

  const colorRequests = buildColorRequests(
    sheetId,
    startRow - 1,
    rows,
    confidences
  );

  if (colorRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: colorRequests },
    });
  }

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
}

export async function getSheetData(
  accessToken: string,
  year: number
): Promise<{ date: string; amount: string; vendor: string }[]> {
  const drive = getDriveClient(accessToken);
  const rootId = await ensureRootFolder(accessToken);
  const fileName = `${year}年_経費`;

  const res = await drive.files.list({
    q: `'${rootId}' in parents and name='${fileName}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
  });

  if (!res.data.files || res.data.files.length === 0) {
    return [];
  }

  const spreadsheetId = res.data.files[0].id!;
  const sheets = getSheetsClient(accessToken);

  const data = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A2:H`,
  });

  if (!data.data.values) return [];

  return data.data.values.map((row) => ({
    date: row[2] || "",    // col C: 発生日
    vendor: row[4] || "",  // col E: 取引先
    amount: row[7] || "",  // col H: 金額
  }));
}

function buildColorRequests(
  sheetId: number,
  startRowIndex: number,
  rows: string[][],
  confidences: ConfidenceInfo[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requests: any[] = [];

  // Column mapping: which confidence field applies to which columns
  const confidenceMap: Record<number, keyof ConfidenceInfo> = {
    2: "date",    // 発生日 (C)
    4: "vendor",  // 取引先 (E)
    7: "amount",  // 金額 (H)
  };

  // Yellow for low confidence
  const yellowBg = { red: 0.996, green: 0.953, blue: 0.78 };
  // Light red for null/empty
  const redBg = { red: 0.996, green: 0.886, blue: 0.886 };

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const conf = confidences[rowIdx];
    if (!conf) continue;

    for (const [colStr, field] of Object.entries(confidenceMap)) {
      const col = parseInt(colStr);
      const cellValue = row[col];
      const confidence = conf[field];

      let backgroundColor;
      if (cellValue === "" || cellValue == null) {
        backgroundColor = redBg;
      } else if (confidence === "low") {
        backgroundColor = yellowBg;
      } else {
        continue;
      }

      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: startRowIndex + rowIdx,
            endRowIndex: startRowIndex + rowIdx + 1,
            startColumnIndex: col,
            endColumnIndex: col + 1,
          },
          cell: {
            userEnteredFormat: { backgroundColor },
          },
          fields: "userEnteredFormat.backgroundColor",
        },
      });
    }
  }

  return requests;
}
