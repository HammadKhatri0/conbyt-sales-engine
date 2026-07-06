// lib/google-sheets.ts
import { google } from "googleapis";
import path from "path";

function getAuth() {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (!keyPath) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_PATH is not set in environment variables");
  }

  return new google.auth.GoogleAuth({
    keyFile: path.resolve(process.cwd(), keyPath),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

/**
 * Extracts the spreadsheet ID from a full Google Sheets URL.
 * e.g. https://docs.google.com/spreadsheets/d/1AbC.../edit#gid=0 -> "1AbC..."
 */
export function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/**
 * Fetches all rows from the first sheet/tab of a spreadsheet.
 * Returns headers (first row) and data rows separately.
 */
export async function fetchSheetData(spreadsheetUrl: string): Promise<{
  headers: string[];
  rows: Record<string, string>[];
}> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
  if (!spreadsheetId) {
    throw new Error("Could not extract a spreadsheet ID from that URL. Make sure it's a valid Google Sheets link.");
  }

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // Get the first sheet's name so we can reference it explicitly.
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const firstSheetTitle = meta.data.sheets?.[0]?.properties?.title;
  if (!firstSheetTitle) {
    throw new Error("Could not find any sheet tabs in this spreadsheet.");
  }

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: firstSheetTitle,
  });

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