// app/api/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings, SENSITIVE_SETTINGS_FIELDS } from "@/lib/settings";

// Fields that should never be sent back to the client in full once saved —
// masked to avoid re-displaying secrets in the UI after page reloads.
// (Same list used to decide what gets encrypted at rest — see lib/settings.ts)
const SENSITIVE_FIELDS = SENSITIVE_SETTINGS_FIELDS;

function maskSecret(value: string | null): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}${"•".repeat(8)}${value.slice(-4)}`;
}

export async function GET() {
  try {
    const settings = await getSettings();

    const masked = { ...settings };
    for (const field of SENSITIVE_FIELDS) {
      if ((masked as any)[field]) {
        (masked as any)[field] = maskSecret((masked as any)[field]);
      }
    }

    return NextResponse.json({ settings: masked });
  } catch (err) {
    console.error("Failed to fetch settings:", err);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    // Ignore any field that looks like a masked value being sent back unchanged
    // (i.e. contains the bullet character), so re-saving the form without
    // touching a secret field doesn't overwrite it with the masked placeholder.
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string" && value.includes("•")) {
        continue; // skip — user didn't actually change this field
      }
      cleaned[key] = value;
    }

    const updated = await updateSettings(cleaned);
    return NextResponse.json({ success: true, settings: updated });
  } catch (err) {
    console.error("Failed to update settings:", err);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}