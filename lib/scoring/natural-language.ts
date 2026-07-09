// lib/scoring/natural-language.ts
import { GoogleGenAI } from "@google/genai";
import { getSettings } from "@/lib/settings";
import { withRetry } from "@/lib/retry";
import type { Lead, ICPProfile } from "../../generated/prisma/client";

export interface NaturalLanguageScoreResult {
  score: number;
  reason: string;
  topSignals: string[];
}

export async function computeNaturalLanguageScore(
  lead: Lead,
  icp: ICPProfile
): Promise<NaturalLanguageScoreResult | null> {
  const settings = await getSettings();
  if (!settings.geminiApiKey) {
    console.error("Cannot run natural language scoring: Gemini API key not set");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });

  const enrichedData = {
    name: lead.name,
    company: lead.company,
    industry: lead.industry,
    jobTitle: lead.jobTitle,
    employeeCount: lead.employeeCount,
    location: lead.location,
    websiteSummary: lead.websiteSummary,
    newsSummary: lead.newsSummary,
    techStackDetected: lead.techStackDetected,
  };

  const prompt = `You are scoring a sales lead against an Ideal Customer Profile (ICP). Respond with JSON only, no markdown fences, no other text:

{
  "score": <number 0-10>,
  "reason": "<one sentence explaining why they match or don't>",
  "topSignals": ["<up to 3 short signal phrases most relevant to the ICP>"]
}

ICP structured criteria:
- Target industries: ${icp.targetIndustries.join(", ") || "none specified"}
- Target job titles: ${icp.targetJobTitles.join(", ") || "none specified"}
- Positive signals to look for: ${icp.positiveSignals.join(", ") || "none specified"}
- Negative signals to avoid: ${icp.negativeSignals.join(", ") || "none specified"}

Ideal customer, in the user's own words:
${icp.idealCustomerDescription || "not provided"}

What a bad fit looks like:
${icp.badFitDescription || "not provided"}

The one thing that would make someone want to call this lead immediately:
${icp.immediateCallTrigger || "not provided"}

Lead's enriched data:
${JSON.stringify(enrichedData, null, 2)}`;

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
      score: Math.max(0, Math.min(10, Number(parsed.score) || 0)),
      reason: parsed.reason ?? "",
      topSignals: Array.isArray(parsed.topSignals) ? parsed.topSignals.slice(0, 3) : [],
    };
  } catch (err) {
    console.error(`Natural language scoring failed for lead ${lead.id}:`, err);
    return null;
  }
}