// lib/scoring/structured.ts
import type { Lead, ICPProfile } from "../../generated/prisma/client";

export interface ScoreLine {
  label: string;
  points: number;
}

export interface StructuredScoreResult {
  rawScore: number;
  clampedScore: number;
  breakdown: ScoreLine[];
  disqualified: boolean;
}

function includesCI(haystack: string | null | undefined, needle: string): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function anyMatchCI(list: string[] | null | undefined, value: string | null | undefined): boolean {
  if (!list?.length || !value) return false;
  const lower = value.toLowerCase();
  return list.some((item) => lower.includes(item.toLowerCase()) || item.toLowerCase().includes(lower));
}

export function computeStructuredScore(
  lead: Lead,
  icp: ICPProfile
): StructuredScoreResult {
  const breakdown: ScoreLine[] = [];

  // Hard disqualify: excluded job title
  if (anyMatchCI(icp.excludeJobTitles, lead.jobTitle)) {
    breakdown.push({ label: `Job title "${lead.jobTitle}" is on exclude list`, points: -5 });
    return { rawScore: -5, clampedScore: 0, breakdown, disqualified: true };
  }

  let score = 0;

  // Industry match: +2
  if (anyMatchCI(icp.targetIndustries, lead.industry)) {
    breakdown.push({ label: `Industry match: ${lead.industry}`, points: 2 });
    score += 2;
  }

  // Employee count in range: +2
  if (
    lead.employeeCount != null &&
    (icp.employeeCountMin == null || lead.employeeCount >= icp.employeeCountMin) &&
    (icp.employeeCountMax == null || lead.employeeCount <= icp.employeeCountMax)
  ) {
    breakdown.push({ label: `Employee count (${lead.employeeCount}) in target range`, points: 2 });
    score += 2;
  }

  // Geography match: +1
  if (
    includesCI(lead.location, icp.geographyCountry ?? "") ||
    includesCI(lead.location, icp.geographyRegion ?? "")
  ) {
    breakdown.push({ label: `Geography match: ${lead.location}`, points: 1 });
    score += 1;
  }

  // Job title match: +2
  if (anyMatchCI(icp.targetJobTitles, lead.jobTitle)) {
    breakdown.push({ label: `Job title match: ${lead.jobTitle}`, points: 2 });
    score += 2;
  }

  // Build a combined enriched text blob to search signals/keywords against
  const websiteSummaryText = lead.websiteSummary ? JSON.stringify(lead.websiteSummary) : "";
  const newsSummaryText = lead.newsSummary ? JSON.stringify(lead.newsSummary) : "";
  const enrichedBlob = `${websiteSummaryText} ${newsSummaryText}`.toLowerCase();

  // Positive signals: +0.5 each, max +2
  const positiveMatches = (icp.positiveSignals ?? []).filter((s) => enrichedBlob.includes(s.toLowerCase()));
  if (positiveMatches.length > 0) {
    const points = Math.min(positiveMatches.length * 0.5, 2);
    breakdown.push({ label: `Positive signals found: ${positiveMatches.join(", ")}`, points });
    score += points;
  }

  // Negative signals: -2 each, no stated cap in spec
  const negativeMatches = (icp.negativeSignals ?? []).filter((s) => enrichedBlob.includes(s.toLowerCase()));
  if (negativeMatches.length > 0) {
    const points = negativeMatches.length * -2;
    breakdown.push({ label: `Negative signals found: ${negativeMatches.join(", ")}`, points });
    score += points;
  }

  // LinkedIn post keywords: not available yet (no LinkedIn enrichment source)
  if (icp.linkedinPostKeywords?.length) {
    breakdown.push({ label: "LinkedIn post keyword matching: not available (no LinkedIn enrichment configured)", points: 0 });
  }

  // Website keyword match: +0.5 each, max +1
  const websiteKeywordMatches = (icp.websiteKeywords ?? []).filter((k) =>
    websiteSummaryText.toLowerCase().includes(k.toLowerCase())
  );
  if (websiteKeywordMatches.length > 0) {
    const points = Math.min(websiteKeywordMatches.length * 0.5, 1);
    breakdown.push({ label: `Website keywords found: ${websiteKeywordMatches.join(", ")}`, points });
    score += points;
  }

  // Recent news positive signal: flat +1 if any signal found at all
  const newsSignals = (lead.newsSummary as any)?.signals as string[] | undefined;
  if (newsSignals?.length) {
    breakdown.push({ label: `Recent news signals found (${newsSignals.length})`, points: 1 });
    score += 1;
  }

  // Competitor tool detected: -3
  // NOTE: this only detects presence, not sentiment ("seem happy with it" from
  // the spec isn't reliably assessable from a keyword match alone).
  const competitorMatch = (icp.competitorTools ?? []).find((tool) =>
    lead.techStackDetected.some((t) => t.toLowerCase().includes(tool.toLowerCase()))
  );
  if (competitorMatch) {
    breakdown.push({ label: `Competitor tool detected: ${competitorMatch}`, points: -3 });
    score -= 3;
  }

  const clampedScore = Math.max(0, Math.min(10, score));

  return { rawScore: score, clampedScore, breakdown, disqualified: false };
}