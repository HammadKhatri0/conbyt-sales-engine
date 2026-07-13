// lib/gmail.ts
import { google } from "googleapis";
import { getSettings, updateSettings } from "@/lib/settings";

// Least-privilege scope — only allows sending mail, not reading the inbox.
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
];

function getRedirectUri(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is not set — needed to build the Gmail OAuth redirect URI.");
  }
  return `${baseUrl.replace(/\/$/, "")}/api/auth/gmail/callback`;
}

async function getOAuth2Client() {
  const settings = await getSettings();

  if (!settings.gmailClientId || !settings.gmailClientSecret) {
    throw new Error("Gmail Client ID/Secret not set in Settings — create an OAuth client in Google Cloud Console first.");
  }

  return new google.auth.OAuth2(settings.gmailClientId, settings.gmailClientSecret, getRedirectUri());
}

/** Builds the URL to send the user to for the Google consent screen. */
export async function getGmailAuthUrl(): Promise<string> {
  const oauth2Client = await getOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: "offline", // required to get a refresh_token back
    prompt: "consent", // forces a refresh_token even on reconnect
    scope: SCOPES,
  });
}

/**
 * Exchanges the OAuth callback's ?code= for tokens, fetches the connected
 * email address, and persists the connection in Settings.
 */
export async function completeGmailConnection(code: string): Promise<{ email: string }> {
  const oauth2Client = await getOAuth2Client();

  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google didn't return a refresh token. If you've connected this app before, revoke access at " +
        "https://myaccount.google.com/permissions and try again — Google only issues a refresh token " +
        "the first time consent is granted for a given account."
    );
  }

  oauth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();

  if (!data.email) {
    throw new Error("Could not determine the connected Gmail address from Google's response.");
  }

  await updateSettings({
    gmailRefreshToken: tokens.refresh_token,
    gmailEmailAddress: data.email,
    gmailConnected: true,
  });

  return { email: data.email };
}

export async function disconnectGmail(): Promise<void> {
  await updateSettings({
    gmailConnected: false,
    gmailRefreshToken: null,
    gmailEmailAddress: null,
  });
}

interface SendGmailParams {
  to: string;
  subject: string;
  body: string; // plain text
}

function buildRawMessage({ to, from, subject, body }: SendGmailParams & { from: string }): string {
  const messageParts = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?utf-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ];
  const message = messageParts.join("\n");

  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendGmailEmail(
  params: SendGmailParams
): Promise<{ success: boolean; error?: string }> {
  const settings = await getSettings();

  if (!settings.gmailConnected || !settings.gmailRefreshToken || !settings.gmailEmailAddress) {
    return { success: false, error: "Gmail is not connected in Settings" };
  }

  try {
    const oauth2Client = await getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: settings.gmailRefreshToken });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const raw = buildRawMessage({ ...params, from: settings.gmailEmailAddress });

    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

    return { success: true };
  } catch (err: any) {
    console.error("Failed to send Gmail email:", err);
    return { success: false, error: err?.message ?? "Failed to send email" };
  }
}
