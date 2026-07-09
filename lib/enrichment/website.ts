// lib/enrichment/website.ts
import * as cheerio from "cheerio";
import { GoogleGenAI } from "@google/genai";
import { getSettings } from "@/lib/settings";
import { withRetry } from "@/lib/retry";

export interface WebsiteSummary {
  servicesOffered: string[];
  locationCoverage: string | null;
  techStackMentioned: string[];
  softwareToolsMentioned: string[];
  teamSizeLanguage: string | null;
}

export async function researchWebsite(url: string): Promise<WebsiteSummary | null> {
  let html: string;
  try {
    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
    const res = await fetch(normalizedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ConbytBot/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error(`Website fetch failed for ${url}: HTTP ${res.status}`);
      return null;
    }
    html = await res.text();
  } catch (err) {
    console.error(`Failed to fetch website ${url}:`, err);
    return null;
  }

  const $ = cheerio.load(html);
  $("script, style, noscript, svg").remove();
  const visibleText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 8000);

  if (!visibleText) return null;

  const settings = await getSettings();
  if (!settings.geminiApiKey) {
    console.error("Cannot analyze website: Gemini API key not set in Settings");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });

  const prompt = `Analyze this company website's visible text and extract the following as JSON only, no other text, no markdown fences:

{
  "servicesOffered": ["short phrase per service, max 5"],
  "locationCoverage": "areas/regions they serve, or null if not mentioned",
  "techStackMentioned": ["any technology/platform names mentioned, max 5, empty array if none"],
  "softwareToolsMentioned": ["any named business software tools mentioned by name, e.g. Jobber, ServiceTitan, empty array if none"],
  "teamSizeLanguage": "any phrase suggesting team size, e.g. 'family owned', '50+ technicians', or null if not mentioned"
}

Website text:
"""
${visibleText}
"""`;

  try {
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: prompt,
      })
    );

    const raw = (response.text ?? "").trim().replace(/^```json\s*|\s*```$/g, "");
    return JSON.parse(raw) as WebsiteSummary;
  } catch (err) {
    console.error(`Failed to analyze website content for ${url}:`, err);
    return null;
  }
}