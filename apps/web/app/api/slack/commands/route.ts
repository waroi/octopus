import { NextResponse } from "next/server";
import { prisma } from "@octopus/db";
import { processSlackQuestion } from "@/lib/slack-responder";
import crypto from "crypto";

export async function POST(request: Request) {
  // Read raw body for signature verification
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp");
  const slackSignature = request.headers.get("x-slack-signature");
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  if (!timestamp || !slackSignature || !signingSecret) {
    console.error("[slack-commands] Missing signature headers or signing secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Replay attack protection (5 minute window)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    console.error("[slack-commands] Request timestamp too old");
    return NextResponse.json({ error: "Request too old" }, { status: 401 });
  }

  // HMAC-SHA256 signature verification
  const sigBasestring = `v0:${timestamp}:${rawBody}`;
  const mySignature = `v0=${crypto.createHmac("sha256", signingSecret).update(sigBasestring).digest("hex")}`;

  if (!crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(slackSignature))) {
    console.error("[slack-commands] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Parse form-urlencoded body
  const params = new URLSearchParams(rawBody);
  const teamId = params.get("team_id");
  const text = params.get("text")?.trim() ?? "";
  const responseUrl = params.get("response_url");
  const userName = params.get("user_name") ?? "someone";
  const userId = params.get("user_id") ?? "";

  if (!teamId || !responseUrl) {
    console.error("[slack-commands] Missing team_id or response_url");
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // Lookup org by team_id
  const slackIntegration = await prisma.slackIntegration.findFirst({
    where: { teamId },
    select: { organizationId: true },
  });

  if (!slackIntegration) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "This Slack workspace is not connected to any Octopus organization. Please connect it from the Octopus settings page.",
    });
  }

  // Empty text → usage hint
  if (!text) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "Usage: `/octopus <your question about the codebase>`\nExample: `/octopus how does authentication work?`",
    });
  }

  // Fire-and-forget background processing
  processSlackQuestion({
    question: text,
    orgId: slackIntegration.organizationId,
    responseUrl,
    userName,
    slackUserId: userId,
  }).catch((err) => {
    console.error("[slack-commands] Background processing failed:", err);
  });

  // Immediate acknowledgment (must respond within 3 seconds)
  console.log(`[slack-commands] Received question from @${userName} in team ${teamId}: "${text}"`);
  return NextResponse.json({
    response_type: "in_channel",
    text: `:hourglass_flowing_sand: *@${userName}* asked: _${text}_\n\nThinking...`,
  });
}
