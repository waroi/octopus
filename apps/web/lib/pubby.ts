import { PubbyServer } from "@getpubby/sdk/server";

export const pubby = new PubbyServer({
  appId: process.env.PUBBY_APP_ID!,
  key: process.env.PUBBY_APP_KEY!,
  secret: process.env.PUBBY_APP_SECRET!,
  apiHost: "https://api.pubby.dev",
});
