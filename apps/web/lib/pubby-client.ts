"use client";

import { Pubby } from "@getpubby/sdk";

let pubbyInstance: Pubby | null = null;

export function getPubbyClient(): Pubby {
  if (!pubbyInstance) {
    pubbyInstance = new Pubby(process.env.NEXT_PUBLIC_PUBBY_KEY!, {
      wsHost: "wss://ws.pubby.dev",
      authEndpoint: "/api/pubby/auth",
    });
    pubbyInstance.connect();
  }
  return pubbyInstance;
}
