import { auth } from "@/lib/auth";
import { pubby } from "@/lib/pubby";
import { prisma } from "@octopus/db";
import { headers } from "next/headers";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { socket_id, channel_name } = await req.json();

  if (channel_name.startsWith("presence-")) {
    // Validate presence-chat-{conversationId} channels
    const chatMatch = channel_name.match(/^presence-chat-(.+)$/);
    if (chatMatch) {
      const conversationId = chatMatch[1];
      const conversation = await prisma.chatConversation.findFirst({
        where: {
          id: conversationId,
          isShared: true,
          deletedAt: null,
        },
        select: { organizationId: true },
      });

      if (!conversation) {
        return new Response("Conversation not found or not shared", { status: 403 });
      }

      // Verify org membership
      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId: conversation.organizationId,
          userId: session.user.id,
          deletedAt: null,
        },
      });
      if (!membership) {
        return new Response("Not a member of this organization", { status: 403 });
      }
    }

    const authResponse = pubby.authenticatePresenceChannel(
      socket_id,
      channel_name,
      session.user.id,
      { name: session.user.name, image: session.user.image }
    );
    return Response.json(authResponse);
  }

  const authResponse = pubby.authenticatePrivateChannel(socket_id, channel_name);
  return Response.json(authResponse);
}
