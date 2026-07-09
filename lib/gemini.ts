// lib/gemini.ts
import { GoogleGenAI } from "@google/genai";
import { getSettings } from "@/lib/settings";
import { withRetry } from "@/lib/retry";

const MODEL = "gemini-2.5-flash-lite";

export async function summarizeCall(transcript: string): Promise<string> {
  const settings = await getSettings();

  if (!settings.geminiApiKey) {
    throw new Error("Gemini API key not set in Settings");
  }

  const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });

  const prompt = `Summarize this sales call transcript in exactly 3 short bullet points. Focus on: what was discussed, the prospect's reaction/objections, and the outcome. Keep each bullet under 15 words. Respond with only the 3 bullets, formatted as:
- point one
- point two
- point three

Transcript:
"""
${transcript}
"""`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL,
      contents: prompt,
    })
  );

  return (response.text ?? "").trim();
}