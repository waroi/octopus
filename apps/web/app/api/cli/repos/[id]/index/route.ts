import { authenticateApiToken } from "@/lib/api-auth";
import { prisma } from "@octopus/db";
import { indexRepository } from "@/lib/indexer";
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

  if (repo.indexStatus === "indexing") {
    return Response.json({ error: "Indexing already in progress" }, { status: 409 });
  }

  if (!repo.installationId) {
    return Response.json({ error: "Repository has no installation ID" }, { status: 400 });
  }

  // Start indexing in the background
  indexRepository(
    repo.id,
    repo.fullName,
    repo.defaultBranch,
    repo.installationId,
    () => {},
    undefined,
    repo.provider,
    result.org.id,
  ).catch((err) => {
    console.error(`[cli] Index failed for ${repo.fullName}:`, err);
  });

  return Response.json({ message: "Indexing started", repoId: repo.id });
}
