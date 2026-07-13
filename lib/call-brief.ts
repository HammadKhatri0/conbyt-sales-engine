// lib/call-brief.ts
import { GoogleGenAI } from "@google/genai";
import { getSettings } from "@/lib/settings";
import { withRetry } from "@/lib/retry";
import { prisma } from "@/lib/prisma";
import type { Lead, ICPProfile } from "../generated/prisma/client";

export interface CallBrief {
  openerHook: string;
  painAssumption: string;
  proofPoint: string | null;
  personalizedPitch: string;
}

export async function generateCallBrief(
  lead: Lead,
  icp: ICPProfile
): Promise<CallBrief | null> {
  const settings = await getSettings();
  if (!settings.geminiApiKey) {
    console.error("Cannot generate call brief: Gemini API key not set");
    return null;
  }

  const proofPoints = await prisma.proofPoint.findMany();

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
  };

  const proofPointsText = proofPoints.length
    ? proofPoints.map((p) => `- ${p.name}: ${p.metric} — ${p.description}`).join("\n")
    : "No proof points available in the library.";

  const prompt = `Generate a personalized call brief for a sales agent about to call this lead. Respond with JSON only, no markdown fences, no other text:

{
  "openerHook": "one specific sentence referencing something real from their enriched data (website or news signal) — the most recent/relevant thing found. If nothing specific was found, use a general but still industry-relevant opener, not a generic greeting.",
  "painAssumption": "the most likely operational pain point based on all the enriched data combined, written as a single clear sentence",
  "proofPoint": "the name of the single most relevant proof point from the library below for this lead's specific situation, or null if none fit or the library is empty",
  "personalizedPitch": "a 2 sentence booking pitch written specifically for this lead, referencing their situation"
}

Lead's enriched data:
${JSON.stringify(enrichedData, null, 2)}

Available proof points library:
${proofPointsText}

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

    return {
      openerHook: parsed.openerHook ?? "",
      painAssumption: parsed.painAssumption ?? "",
      proofPoint: parsed.proofPoint ?? null,
      personalizedPitch: parsed.personalizedPitch ?? "",
    };
  } catch (err) {
    console.error(`Call brief generation failed for lead ${lead.id}:`, err);
    return null;
  }
}