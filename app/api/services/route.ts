// app/api/services/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const services = await prisma.service.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ services });
  } catch (err) {
    console.error("Failed to fetch services:", err);
    return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.name?.trim() || !body.description?.trim()) {
      return NextResponse.json({ error: "Name and description are required" }, { status: 400 });
    }

    const service = await prisma.service.create({
      data: { name: body.name.trim(), description: body.description.trim() },
    });

    return NextResponse.json({ service });
  } catch (err) {
    console.error("Failed to create service:", err);
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
  }
}