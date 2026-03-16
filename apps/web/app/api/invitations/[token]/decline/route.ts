import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@octopus/db";

const APP_URL = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// POST /api/invitations/:token/decline — Decline invitation
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  return handleDecline(await params);
}

// GET for email link click
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const result = await handleDecline(await params);
  if (result.ok) {
    return NextResponse.redirect(`${APP_URL}/login?message=${encodeURIComponent("Invitation declined")}`);
  }
  const body = await result.json();
  return NextResponse.redirect(`${APP_URL}/login?error=${encodeURIComponent(body.error)}`);
}

async function handleDecline({ token }: { token: string }): Promise<NextResponse> {
  const invitation = await prisma.organizationInvitation.findUnique({
    where: { token },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  if (invitation.status !== "pending") {
    return NextResponse.json({ error: `Invitation has already been ${invitation.status}` }, { status: 400 });
  }

  await prisma.organizationInvitation.update({
    where: { id: invitation.id },
    data: { status: "revoked" },
  });

  return NextResponse.json({ message: "Invitation declined" });
}
