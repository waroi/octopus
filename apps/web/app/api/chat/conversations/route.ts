import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@octopus/db";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = request.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return Response.json({ error: "Missing orgId" }, { status: 400 });
  }

  // Verify membership
  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId: orgId,
      userId: session.user.id,
      deletedAt: null,
    },
  });
  if (!membership) {
    return Response.json({ error: "Not a member" }, { status: 403 });
  }

  const conversations = await prisma.chatConversation.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      OR: [
        { userId: session.user.id },
        { isShared: true },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      isShared: true,
      userId: true,
      user: { select: { name: true, image: true } },
    },
  });

  return Response.json(conversations);
}
