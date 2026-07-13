// lib/email-generation.ts
import { GoogleGenAI } from "@google/genai";
import { getSettings } from "@/lib/settings";
import { withRetry } from "@/lib/retry";
import { prisma } from "@/lib/prisma";
import type { Lead, ICPProfile } from "../generated/prisma/client";

export interface GeneratedEmail {
  subject: string;
  body: string;
}

/**
 * Generates a personalized cold outbound email for a lead, reusing the same
 * enriched data (website/news signals, score breakdown) and proof-point
 * library as the call brief generator, plus the brief's own opener/pitch if
 * one's already been generated for this lead so tone stays consistent
 * between the call and the email.
 */
export async function generateOutboundEmail(
  lead: Lead,
  icp: ICPProfile
): Promise<GeneratedEmail | null> {
  const settings = await getSettings();
  if (!settings.geminiApiKey) {
    console.error("Cannot generate email: Gemini API key not set");
    return null;
  }

  const proofPoints = await prisma.proofPoint.findMany();
  const services = await prisma.service.findMany();

  const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });

  const enrichedData = {
    name: lead.name,
    firstName: lead.name?.split(" ")[0],
    company: lead.company,
    industry: lead.industry,
    jobTitle: lead.jobTitle,
    employeeCount: lead.employeeCount,
    websiteSummary: lead.websiteSummary,
    newsSummary: lead.newsSummary,
    techStackDetected: lead.techStackDetected,
    scoreBreakdown: lead.scoreBreakdown,
    existingCallBrief: lead.briefGeneratedAt
      ? {
        openerHook: lead.briefOpenerHook,
        painAssumption: lead.briefPainAssumption,
        proofPoint: lead.briefProofPoint,
      }
      : null,
  };

  const proofPointsText = proofPoints.length
    ? proofPoints.map((p) => `- ${p.name}: ${p.metric} — ${p.description}`).join("\n")
    : "No proof points available in the library.";

  const servicesText = services.length
    ? services.map((s) => `- ${s.name}: ${s.description}`).join("\n")
    : "No services listed in the library.";

  const prompt = `Write a short, personalized cold outbound sales email to this lead. Respond with JSON only, no markdown fences, no other text:

{
  "subject": "a short, specific, non-salesy subject line (under 60 characters) — no clickbait, no emoji",
  "body": "the email body as plain text (no HTML). 4-6 short sentences max. Open with something specific from their enriched data, state one likely pain point, mention the single most relevant proof point or service, and end with a low-friction call to action (asking for a quick call, not demanding a meeting). Sign off as 'The Conbyt team'. No subject line inside the body."
}

Lead's enriched data:
${JSON.stringify(enrichedData, null, 2)}

Available proof points library:
${proofPointsText}

Available services library:
${servicesText}

Ideal customer description (for context/tone):
${icp.idealCustomerDescription || "not provided"}`;

  try {
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: prompt,
      })
    );

    const raw = (response.text ?? "").trim().replace(/^```json\s*|\s*```$/g, "");
    const parsed = JSON.parse(raw);

    if (!parsed.subject || !parsed.body) {
      throw new Error("Gemini response missing subject or body");
    }

    return { subject: parsed.subject, body: parsed.body };
  } catch (err) {
    console.error(`Email generation failed for lead ${lead.id}:`, err);
    return null;
  }
}
