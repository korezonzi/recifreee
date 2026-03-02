import { google } from "googleapis";
import type { UserSettings, CategoryLearningData } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { EMPTY_LEARNING_DATA } from "./category-learning";

function getDriveClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth });
}

async function findOrCreateFolder(
  accessToken: string,
  name: string,
  parentId?: string,
): Promise<string> {
  const drive = getDriveClient(accessToken);
  const parentQuery = parentId ? `'${parentId}' in parents and ` : "";
  const res = await drive.files.list({
    q: `${parentQuery}name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: "id",
  });

  return created.data.id!;
}

function sanitizeFilename(str: string): string {
  return str.replace(/[/\\:*?"<>|]/g, "_").trim() || "不明";
}

function buildFileName(
  date: string | null,
  vendor: string | null,
  amount: number | null,
  originalName: string,
): string {
  const ext = originalName.split(".").pop() || "jpg";

  let dateStr: string;
  if (date) {
    dateStr = date.replace(/-/g, "");
  } else {
    const now = new Date();
    dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  }

  const vendorStr = sanitizeFilename(vendor || "不明");
  const amountStr = amount != null ? String(amount) : "0";

  return `${dateStr}_${vendorStr}_${amountStr}.${ext}`;
}

export async function ensureFolderStructure(
  accessToken: string,
  year: number,
  month: number,
): Promise<string> {
  const rootId = await findOrCreateFolder(accessToken, "確定申告");
  const yearId = await findOrCreateFolder(accessToken, `${year}年`, rootId);
  const monthStr = `${String(month).padStart(2, "0")}月`;
  const monthId = await findOrCreateFolder(accessToken, monthStr, yearId);
  return monthId;
}

export async function ensureRootFolder(accessToken: string): Promise<string> {
  return await findOrCreateFolder(accessToken, "確定申告");
}

export async function uploadReceiptImage(
  accessToken: string,
  folderId: string,
  fileBuffer: Buffer,
  mimeType: string,
  date: string | null,
  vendor: string | null,
  amount: number | null,
  originalName: string,
): Promise<{ id: string; name: string }> {
  const drive = getDriveClient(accessToken);
  const fileName = buildFileName(date, vendor, amount, originalName);

  const { Readable } = await import("stream");
  const stream = Readable.from(fileBuffer);

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: "id, name",
  });

  return { id: res.data.id!, name: res.data.name! };
}

const CONFIG_FILE_NAME = ".recifreee-config.json";
const CATEGORIES_FILE_NAME = ".recifreee-categories.json";

export async function loadUserSettings(
  accessToken: string,
): Promise<UserSettings> {
  const drive = getDriveClient(accessToken);

  try {
    const rootId = await findOrCreateFolder(accessToken, "確定申告");
    const res = await drive.files.list({
      q: `'${rootId}' in parents and name='${CONFIG_FILE_NAME}' and trashed=false`,
      fields: "files(id)",
      spaces: "drive",
    });

    if (!res.data.files || res.data.files.length === 0) {
      return { ...DEFAULT_SETTINGS };
    }

    const fileId = res.data.files[0].id!;
    const content = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "json" },
    );

    return { ...DEFAULT_SETTINGS, ...(content.data as object) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveUserSettings(
  accessToken: string,
  settings: UserSettings,
): Promise<void> {
  const drive = getDriveClient(accessToken);
  const rootId = await findOrCreateFolder(accessToken, "確定申告");

  const res = await drive.files.list({
    q: `'${rootId}' in parents and name='${CONFIG_FILE_NAME}' and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
  });

  const { Readable } = await import("stream");
  const body = Readable.from(JSON.stringify(settings, null, 2));

  if (res.data.files && res.data.files.length > 0) {
    await drive.files.update({
      fileId: res.data.files[0].id!,
      media: { mimeType: "application/json", body },
    });
  } else {
    await drive.files.create({
      requestBody: {
        name: CONFIG_FILE_NAME,
        parents: [rootId],
        mimeType: "application/json",
      },
      media: { mimeType: "application/json", body },
      fields: "id",
    });
  }
}

export async function loadCategoryLearning(
  accessToken: string,
): Promise<CategoryLearningData> {
  const drive = getDriveClient(accessToken);

  try {
    const rootId = await findOrCreateFolder(accessToken, "確定申告");
    const res = await drive.files.list({
      q: `'${rootId}' in parents and name='${CATEGORIES_FILE_NAME}' and trashed=false`,
      fields: "files(id)",
      spaces: "drive",
    });

    if (!res.data.files || res.data.files.length === 0) {
      return { ...EMPTY_LEARNING_DATA };
    }

    const fileId = res.data.files[0].id!;
    const content = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "json" },
    );

    return { ...EMPTY_LEARNING_DATA, ...(content.data as object) };
  } catch {
    return { ...EMPTY_LEARNING_DATA };
  }
}

export async function saveCategoryLearning(
  accessToken: string,
  data: CategoryLearningData,
): Promise<void> {
  const drive = getDriveClient(accessToken);
  const rootId = await findOrCreateFolder(accessToken, "確定申告");

  const res = await drive.files.list({
    q: `'${rootId}' in parents and name='${CATEGORIES_FILE_NAME}' and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
  });

  const { Readable } = await import("stream");
  const body = Readable.from(JSON.stringify(data, null, 2));

  if (res.data.files && res.data.files.length > 0) {
    await drive.files.update({
      fileId: res.data.files[0].id!,
      media: { mimeType: "application/json", body },
    });
  } else {
    await drive.files.create({
      requestBody: {
        name: CATEGORIES_FILE_NAME,
        parents: [rootId],
        mimeType: "application/json",
      },
      media: { mimeType: "application/json", body },
      fields: "id",
    });
  }
}

const FREE_PLAN_LIMIT = 10;

export async function getUsageData(accessToken: string): Promise<{
  month: string;
  count: number;
  plan: "free" | "pro";
  limit: number;
}> {
  const settings = await loadUserSettings(accessToken);
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const plan = settings.plan || "free";
  const usage = settings.usage;

  if (!usage || usage.month !== currentMonth) {
    return {
      month: currentMonth,
      count: 0,
      plan,
      limit: plan === "pro" ? Infinity : FREE_PLAN_LIMIT,
    };
  }

  return {
    month: currentMonth,
    count: usage.count,
    plan,
    limit: plan === "pro" ? Infinity : FREE_PLAN_LIMIT,
  };
}

export async function incrementUsage(accessToken: string): Promise<{
  allowed: boolean;
  count: number;
  limit: number;
  plan: "free" | "pro";
}> {
  const settings = await loadUserSettings(accessToken);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const plan = settings.plan || "free";
  const limit = plan === "pro" ? Infinity : FREE_PLAN_LIMIT;

  let count = 0;
  if (settings.usage && settings.usage.month === currentMonth) {
    count = settings.usage.count;
  }

  if (plan === "free" && count >= FREE_PLAN_LIMIT) {
    return { allowed: false, count, limit, plan };
  }

  count++;
  await saveUserSettings(accessToken, {
    ...settings,
    usage: { month: currentMonth, count },
  });

  return { allowed: true, count, limit, plan };
}
