import { auth } from "@/lib/auth";
import { pubby } from "@/lib/pubby";
import { headers } from "next/headers";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { channel, event, data } = await req.json();

  await pubby.trigger(channel, event, data);

  return Response.json({ ok: true });
}
