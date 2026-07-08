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