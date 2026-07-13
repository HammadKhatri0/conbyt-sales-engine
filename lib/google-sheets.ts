// lib/google-sheets.ts
import { google } from "googleapis";
import path from "path";
import { getSettings } from "@/lib/settings";

async function getAuth() {
  const settings = await getSettings();
  const keyPath = settings.googleServiceAccountKeyPath;

  if (!keyPath) {
    throw new Error("Google service account key path is not set in Settings");
  }

  return new google.auth.GoogleAuth({
    keyFile: path.resolve(process.cwd(), keyPath),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

async function getWriteAuth() {
  const settings = await getSettings();
  const keyPath = settings.googleServiceAccountKeyPath;

  if (!keyPath) {
    throw new Error("Google service account key path is not set in Settings");
  }

  // Read-write scope — the target spreadsheet must be shared with the
  // service account's email as Editor, not just Viewer (Viewer is enough
  // for import, which only reads).
  return new google.auth.GoogleAuth({
    keyFile: path.resolve(process.cwd(), keyPath),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

export async function fetchSheetData(spreadsheetUrl: string): Promise<{
  headers: string[];
  rows: Record<string, string>[];
}> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
  if (!spreadsheetId) {
    throw new Error("Could not extract a spreadsheet ID from that URL. Make sure it's a valid Google Sheets link.");
  }

  const auth = await getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const firstSheetTitle = meta.data.sheets?.[0]?.properties?.title;
  if (!firstSheetTitle) {
    throw new Error("Could not find any sheet tabs in this spreadsheet.");
  }

  const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: firstSheetTitle });

  const values = result.data.values ?? [];
  if (values.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = values[0].map((h) => String(h ?? "").trim());
  const rows = values.slice(1).map((row) => {
    const rowObj: Record<string, string> = {};
    headers.forEach((header, i) => {
      rowObj[header] = String(row[i] ?? "").trim();
    });
    return rowObj;
  });

  return { headers, rows };
}

/**
 * Writes a header row + data rows to a tab in an existing spreadsheet,
 * creating the tab if it doesn't exist yet or clearing and reusing it if it
 * does (so re-exporting to the same tab name doesn't leave stale rows below
 * a shorter new export).
 */
export async function exportRowsToSheet(
  spreadsheetUrl: string,
  sheetName: string,
  headers: string[],
  rows: string[][]
): Promise<{ sheetUrl: string }> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
  if (!spreadsheetId) {
    throw new Error("Could not extract a spreadsheet ID from that URL. Make sure it's a valid Google Sheets link.");
  }

  const auth = await getWriteAuth();
  const sheets = google.sheets({ version: "v4", auth });

  let sheetId: number | null | undefined;
  try {
    const addResult = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
    });
    sheetId = addResult.data.replies?.[0]?.addSheet?.properties?.sheetId;
  } catch (err: any) {
    const alreadyExists = err?.message?.includes("already exists");
    if (!alreadyExists) {
      throw new Error(
        err?.message?.includes("PERMISSION_DENIED") || err?.code === 403
          ? "Permission denied — share the spreadsheet with the service account's email as Editor (not just Viewer)."
          : err?.message ?? "Failed to create the export tab"
      );
    }
    // Tab already exists — clear it and reuse rather than erroring, so
    // re-exporting to the same tab name is a normal "refresh" action.
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${sheetName}'` });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetName}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [headers, ...rows] },
  });

  const gidSuffix = sheetId != null ? `#gid=${sheetId}` : "";
  return { sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}${gidSuffix}` };
}