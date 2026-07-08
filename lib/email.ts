// lib/email.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = "Conbyt <onboarding@resend.dev>";

interface SendBookingLinkParams {
  to: string;
  firstName: string;
  companyName?: string | null;
  bookingUrl: string;
}

export async function sendBookingLinkEmail({
  to,
  firstName,
  companyName,
  bookingUrl,
}: SendBookingLinkParams): Promise<{ success: boolean; error?: string }> {
  try {
    const subject = "Your Conbyt discovery call link";

    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <p>Hi ${escapeHtml(firstName)},</p>
        <p>Thanks for chatting${companyName ? ` about ${escapeHtml(companyName)}` : ""} earlier — here's the link to grab a time that works for you:</p>
        <p style="margin: 24px 0;">
          <a href="${bookingUrl}" style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
            Book your discovery call
          </a>
        </p>
        <p>Talk soon,<br/>The Conbyt team</p>
      </div>
    `;

    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Resend send error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Failed to send booking link email:", err);
    return { success: false, error: "Failed to send email" };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}