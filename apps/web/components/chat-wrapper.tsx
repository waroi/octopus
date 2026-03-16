"use client";

import { ChatProvider } from "@/components/chat-provider";
import { FloatingChat } from "@/components/floating-chat";
import type { ReactNode } from "react";

export function ChatWrapper({
  children,
  orgId,
  userId,
  userName,
}: {
  children: ReactNode;
  orgId: string;
  userId: string;
  userName: string;
}) {
  return (
    <ChatProvider orgId={orgId} userId={userId} userName={userName}>
      {children}
      <FloatingChat />
    </ChatProvider>
  );
}
