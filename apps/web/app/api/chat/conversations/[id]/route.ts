import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@octopus/db";

async function verifyOwnership(userId: string, conversationId: string, orgId: string) {
  return prisma.chatConversation.findFirst({
    where: { id: conversationId, userId, organizationId: orgId, deletedAt: null },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const orgId = request.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return Response.json({ error: "Missing orgId" }, { status: 400 });
  }

  // Verify org membership
  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId: orgId, userId: session.user.id, deletedAt: null },
  });
  if (!membership) {
    return Response.json({ error: "Not a member" }, { status: 403 });
  }

  const conversation = await prisma.chatConversation.findFirst({
    where: {
      id,
      organizationId: orgId,
      deletedAt: null,
      OR: [
        { userId: session.user.id },
        { isShared: true },
      ],
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true, createdAt: true, userId: true, userName: true },
      },
    },
  });

  if (!conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  return Response.json({
    id: conversation.id,
    title: conversation.title,
    isShared: conversation.isShared,
    messages: conversation.messages,
  });
}

// Rename conversation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { title, orgId } = await request.json();
  if (!orgId || !title?.trim()) {
    return Response.json({ error: "Missing orgId or title" }, { status: 400 });
  }

  const conversation = await verifyOwnership(session.user.id, id, orgId);
  if (!conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  const updated = await prisma.chatConversation.update({
    where: { id },
    data: { title: title.trim() },
    select: { id: true, title: true },
  });

  return Response.json(updated);
}

// Soft delete conversation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const orgId = request.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return Response.json({ error: "Missing orgId" }, { status: 400 });
  }

  const conversation = await verifyOwnership(session.user.id, id, orgId);
  if (!conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  await prisma.chatConversation.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return Response.json({ ok: true });
}
