// lib/sms.ts
//
// Talks to Twilio's REST API directly via fetch (Basic Auth + form encoding)
// rather than pulling in the `twilio` SDK — sending a single message doesn't
// need the SDK's surface area, and this keeps the dependency list untouched.
import { getSettings } from "@/lib/settings";

interface SendSmsParams {
  to: string;
  body: string;
}

export async function sendSms({ to, body }: SendSmsParams): Promise<{ success: boolean; error?: string }> {
  const settings = await getSettings();

  if (!settings.twilioAccountSid || !settings.twilioAuthToken || !settings.twilioFromNumber) {
    return { success: false, error: "Twilio is not fully configured in Settings" };
  }

  try {
    const credentials = Buffer.from(`${settings.twilioAccountSid}:${settings.twilioAuthToken}`).toString("base64");

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${settings.twilioAccountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to,
          From: settings.twilioFromNumber,
          Body: body,
        }),
      }
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Twilio's error payload uses `message`, not `error`.
      return { success: false, error: data?.message ?? `Twilio API error (${res.status})` };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Failed to send SMS via Twilio:", err);
    return { success: false, error: err?.message ?? "Failed to send SMS" };
  }
}

/**
 * Sent once a lead exhausts all call retry attempts without ever being
 * reached (voicemail/no-answer every time) — a last-resort text nudge with
 * the booking link so there's still a path to convert them.
 */
export async function sendVoicemailFollowUpSms(params: {
  to: string;
  firstName: string;
  bookingUrl: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const { to, firstName, bookingUrl } = params;

  const body = bookingUrl
    ? `Hi ${firstName}, this is Conbyt — we tried calling a few times but couldn't connect. If it's easier, grab a time that works for you here: ${bookingUrl}`
    : `Hi ${firstName}, this is Conbyt — we tried calling a few times but couldn't connect. Reply here if you'd like us to try again at a better time.`;

  return sendSms({ to, body });
}
