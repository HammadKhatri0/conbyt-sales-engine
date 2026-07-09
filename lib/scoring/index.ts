// lib/scoring/index.ts
import { prisma } from "@/lib/prisma";
import { getActiveICPProfile } from "@/lib/icp";
import { computeStructuredScore, type ScoreLine } from "./structured";
import { computeNaturalLanguageScore } from "./natural-language";

const NATURAL_LANGUAGE_THRESHOLD = 4; // per spec: only run NL scoring for leads scoring 4+ on structured

export async function scoreLead(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error(`Lead ${leadId} not found`);

  const icp = await getActiveICPProfile();
  if (!icp) {
    console.log(`No active ICP profile — skipping scoring for lead ${leadId}`);
    return;
  }

  const structured = computeStructuredScore(lead, icp);

  if (structured.disqualified) {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        finalScore: 0,
        structuredScore: structured.rawScore,
        naturalLanguageScore: null,
        scoreBreakdown: structured.breakdown as any,
        scoredAt: new Date(),
      },
    });
    return;
  }

  let breakdown: ScoreLine[] = [...structured.breakdown];
  let finalScore = structured.clampedScore;
  let naturalScore: number | null = null;

  if (structured.rawScore >= NATURAL_LANGUAGE_THRESHOLD) {
    const nlResult = await computeNaturalLanguageScore(lead, icp);

    if (nlResult) {
      naturalScore = nlResult.score;
      finalScore = Math.max(0, Math.min(10, structured.clampedScore * 0.6 + nlResult.score * 0.4));

      breakdown.push({ label: `AI assessment: ${nlResult.reason}`, points: 0 });
      nlResult.topSignals.forEach((signal) => {
        breakdown.push({ label: `AI signal: ${signal}`, points: 0 });
      });
    }
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      finalScore,
      structuredScore: structured.rawScore,
      naturalLanguageScore: naturalScore,
      scoreBreakdown: breakdown as any,
      scoredAt: new Date(),
    },
  });
}