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

export interface CompanyContext {
  industry?: string | null;
  location?: string | null;
}

export async function researchCompanyNews(
  companyName: string,
  context: CompanyContext = {}
): Promise<NewsSummary | null> {
  if (!companyName) return null;

  try {
    // Exact-phrase match (quoted) rather than a bag-of-words match — without
    // quotes, Google News RSS treats a multi-word company name as "match any
    // of these words," which is a major source of false positives for
    // generic names. Appending a location/industry qualifier (when we have
    // one) narrows the result set further, at the search level rather than
    // relying entirely on the LLM to filter noise after the fact.
    const qualifier = context.location || context.industry || "";
    const searchTerms = qualifier ? `"${companyName}" ${qualifier}` : `"${companyName}"`;
    const query = encodeURIComponent(searchTerms);
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

    const contextLine = [
      context.industry ? `Industry: ${context.industry}` : null,
      context.location ? `Location: ${context.location}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    const prompt = `These are recent news headlines returned by searching for "${companyName}".
${contextLine ? `What we know about the actual company: ${contextLine}.` : "No additional company details are known beyond the name."}

IMPORTANT: A generic or common business name can return headlines about a completely different, unrelated company that happens to share the name. Before extracting anything, judge for each headline whether it plausibly refers to THIS specific company (matching what we know about it) or a same-named but different entity. If ${contextLine ? "the company details above don't support a headline being about this company" : "you can't reasonably tell whether a headline is about this specific company"}, exclude that headline entirely rather than guessing.

Extract growth signals (expansion, funding, new locations), problem signals (layoffs, complaints, issues), and hiring signals — but ONLY from headlines you're reasonably confident are actually about this company. Respond with JSON only, no markdown fences:

{
  "signals": ["short signal phrase, max 5, empty array if nothing confidently relevant found"],
  "summary": "one sentence overall summary, or null if no headlines are confidently about this specific company"
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