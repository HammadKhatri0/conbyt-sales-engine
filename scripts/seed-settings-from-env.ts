// scripts/seed-settings-from-env.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

async function main() {
  const { prisma } = await import("../lib/prisma");

  await prisma.settings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      retellApiKey: process.env.RETELL_API_KEY,
      retellAgentId: process.env.RETELL_AGENT_ID,
      retellFromNumber: process.env.RETELL_FROM_NUMBER,
      geminiApiKey: process.env.GEMINI_API_KEY,
      resendApiKey: process.env.RESEND_API_KEY,
      bookingUrl: process.env.BOOKING_URL,
      googleServiceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    },
    update: {
      retellApiKey: process.env.RETELL_API_KEY,
      retellAgentId: process.env.RETELL_AGENT_ID,
      retellFromNumber: process.env.RETELL_FROM_NUMBER,
      geminiApiKey: process.env.GEMINI_API_KEY,
      resendApiKey: process.env.RESEND_API_KEY,
      bookingUrl: process.env.BOOKING_URL,
      googleServiceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    },
  });
  console.log("Settings seeded from .env + .env.local ✅");
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});