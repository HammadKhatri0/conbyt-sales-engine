// app/api/icp-profiles/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const profile = await prisma.iCPProfile.findUnique({ where: { id } });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    return NextResponse.json({ profile });
  } catch (err) {
    console.error(`Failed to fetch ICP profile ${id}:`, err);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();

    // isActive is handled exclusively by the /activate route, which also
    // deactivates every other profile — never let a plain PATCH set it,
    // or you could end up with two "active" profiles at once.
    const { isActive, ...safeData } = body;

    const profile = await prisma.iCPProfile.update({
      where: { id },
      data: safeData,
    });

    return NextResponse.json({ profile });
  } catch (err) {
    console.error(`Failed to update ICP profile ${id}:`, err);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.iCPProfile.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`Failed to delete ICP profile ${id}:`, err);
    return NextResponse.json({ error: "Failed to delete profile" }, { status: 500 });
  }
}