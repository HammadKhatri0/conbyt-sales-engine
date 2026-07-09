// app/api/leads/apollo-search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { searchApolloPeople } from "@/lib/apollo";

export async function POST(req: NextRequest) {
  try {
    const settings = await getSettings();

    if (!settings.apolloApiKey) {
      return NextResponse.json(
        { error: "Apollo API key is not set in Settings" },
        { status: 400 }
      );
    }

    const filters = await req.json();

    const result = await searchApolloPeople(settings.apolloApiKey, filters);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Apollo search failed:", err);
    return NextResponse.json(
      { error: err.message ?? "Apollo search failed" },
      { status: 500 }
    );
  }
}