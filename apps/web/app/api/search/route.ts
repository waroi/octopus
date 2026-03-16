import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@octopus/db";
import { extractAllMermaidBlocks } from "@/lib/mermaid-utils";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const orgId = searchParams.get("orgId");

  if (!q || !orgId) {
    return Response.json({ repos: [], diagrams: [], members: [] });
  }

  // Verify org membership
  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId: orgId,
      userId: session.user.id,
      deletedAt: null,
    },
  });
  if (!membership) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const [repos, prs, members] = await Promise.all([
    // Repositories
    prisma.repository.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { fullName: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        fullName: true,
        indexStatus: true,
      },
      take: 5,
    }),

    // PRs with diagrams
    prisma.pullRequest.findMany({
      where: {
        status: "completed",
        reviewBody: { not: null },
        repository: { organizationId: orgId, isActive: true },
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { author: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        number: true,
        title: true,
        author: true,
        reviewBody: true,
        repositoryId: true,
        repository: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),

    // Members
    prisma.organizationMember.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        user: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
      },
      select: {
        id: true,
        role: true,
        user: { select: { name: true, email: true } },
      },
      take: 5,
    }),
  ]);

  // Filter PRs that actually have diagrams, add diagram info
  const diagrams = prs
    .map((pr) => {
      const blocks = extractAllMermaidBlocks(pr.reviewBody);
      if (blocks.length === 0) return null;
      return {
        prId: pr.id,
        number: pr.number,
        title: pr.title,
        author: pr.author,
        repoId: pr.repositoryId,
        repoName: pr.repository.name,
        diagramCount: blocks.length,
        diagramTypes: [...new Set(blocks.map((b) => b.type))],
      };
    })
    .filter(Boolean)
    .slice(0, 5);

  return Response.json({ repos, diagrams, members });
}
