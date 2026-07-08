// lib/gemini.ts
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL = "gemini-2.5-flash-lite";

/**
 * Generates a 3-bullet-point summary of the call transcript.
 * Outcome classification is handled natively by Retell's post-call analysis
 * (see custom_analysis_data.outcome in the call_analyzed webhook) — this
 * function only covers the summary, which Retell doesn't generate.
 */
export async function summarizeCall(transcript: string): Promise<string> {
  const prompt = `Summarize this sales call transcript in exactly 3 short bullet points. Focus on: what was discussed, the prospect's reaction/objections, and the outcome. Keep each bullet under 15 words. Respond with only the 3 bullets, formatted as:
- point one
- point two
- point three

Transcript:
"""
${transcript}
"""`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
  });

  return (response.text ?? "").trim();
}