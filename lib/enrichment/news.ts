// lib/enrichment/news.ts
import Parser from "rss-parser";
import { GoogleGenAI } from "@google/genai";
import { getSettings } from "@/lib/settings";
import { withRetry } from "@/lib/retry";

const parser = new Parser();

export interface NewsSummary {
  articlesFound: number;
  signals: string[];
  summary: string | null;
}

export async function researchCompanyNews(companyName: string): Promise<NewsSummary | null> {
  if (!companyName) return null;

  try {
    const query = encodeURIComponent(companyName);
    const feedUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
    const feed = await parser.parseURL(feedUrl);

    const articles = (feed.items ?? []).slice(0, 5);

    if (articles.length === 0) {
      return { articlesFound: 0, signals: [], summary: null };
    }

    const settings = await getSettings();
    if (!settings.geminiApiKey) {
      return { articlesFound: articles.length, signals: [], summary: null };
    }

    const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });

    const articlesText = articles
      .map((a) => `- ${a.title} (${a.pubDate ?? "date unknown"})`)
      .join("\n");

    const prompt = `These are recent news headlines mentioning "${companyName}". Extract growth signals (expansion, funding, new locations), problem signals (layoffs, complaints, issues), and hiring signals. Respond with JSON only, no markdown fences:

{
  "signals": ["short signal phrase, max 5, empty array if nothing relevant found"],
  "summary": "one sentence overall summary, or null if headlines are irrelevant/unrelated to this company specifically"
}

Headlines:
${articlesText}`;

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: prompt,
      })
    );

    const raw = (response.text ?? "").trim().replace(/^```json\s*|\s*```$/g, "");
    const parsed = JSON.parse(raw);

    return {
      articlesFound: articles.length,
      signals: parsed.signals ?? [],
      summary: parsed.summary ?? null,
    };
  } catch (err) {
    console.error(`Failed to research news for ${companyName}:`, err);
    return null;
  }
}