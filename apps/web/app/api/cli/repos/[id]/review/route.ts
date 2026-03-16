import { authenticateApiToken } from "@/lib/api-auth";
import { prisma } from "@octopus/db";
import { processReview } from "@/lib/reviewer";
import { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateApiToken(request);
  if (!result) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const repo = await prisma.repository.findFirst({
    where: { id, organizationId: result.org.id, isActive: true },
  });

  if (!repo) {
    return Response.json({ error: "Repository not found" }, { status: 404 });
  }

  const { prNumber } = await request.json();
  if (!prNumber) {
    return Response.json({ error: "Missing prNumber" }, { status: 400 });
  }

  const pr = await prisma.pullRequest.findFirst({
    where: { repositoryId: repo.id, number: prNumber },
  });

  if (!pr) {
    return Response.json({ error: "Pull request not found" }, { status: 404 });
  }

  if (pr.status === "reviewing") {
    return Response.json({ error: "Review already in progress" }, { status: 409 });
  }

  // Start review in the background
  processReview(pr.id).catch((err) => {
    console.error(`[cli] Review failed for PR #${prNumber}:`, err);
  });

  return Response.json({
    message: "Review started",
    pullRequestId: pr.id,
    prNumber: pr.number,
  });
}
