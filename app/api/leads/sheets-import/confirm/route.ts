// app/api/leads/sheets-import/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface IncomingLead {
  name: string;
  phone: string;
  company?: string;
  industry?: string;
  website?: string;
  openerHook?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { leads } = (await req.json()) as { leads: IncomingLead[] };

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: "No leads provided" }, { status: 400 });
    }

    const e164Regex = /^\+[1-9]\d{7,14}$/;

    const results = {
      inserted: 0,
      skippedDuplicate: 0,
      skippedInvalid: 0,
      errors: [] as string[],
    };

    const seenInFile = new Set<string>();

    for (const row of leads) {
      const phone = row.phone?.trim();
      const name = row.name?.trim();

      if (!phone || !name) {
        results.skippedInvalid++;
        continue;
      }

      if (!e164Regex.test(phone)) {
        results.skippedInvalid++;
        results.errors.push(`Invalid phone format: ${phone}`);
        continue;
      }

      if (seenInFile.has(phone)) {
        results.skippedDuplicate++;
        continue;
      }
      seenInFile.add(phone);

      const existing = await prisma.lead.findUnique({ where: { phone } });
      if (existing) {
        results.skippedDuplicate++;
        continue;
      }

      await prisma.lead.create({
        data: {
          name,
          phone,
          company: row.company?.trim() || null,
          industry: row.industry?.trim() || null,
          website: row.website?.trim() || null,
          openerHook: row.openerHook?.trim() || null,
          status: "QUEUED",
        },
      });
      results.inserted++;
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error("Sheets import confirm error:", err);
    return NextResponse.json({ error: "Failed to import leads" }, { status: 500 });
  }
}