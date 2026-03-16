"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@octopus/db";

export type RepoModelItem = {
  id: string;
  name: string;
  fullName: string;
  reviewModelId: string | null;
  embedModelId: string | null;
};

export async function searchRepoModels(
  query: string,
  skip: number,
  take: number,
): Promise<{ repos: RepoModelItem[]; total: number }> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) redirect("/login");

  const cookieStore = await cookies();
  const currentOrgId = cookieStore.get("current_org_id")?.value;

  const member = await prisma.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      ...(currentOrgId ? { organizationId: currentOrgId } : {}),
      deletedAt: null,
    },
    select: { organizationId: true },
  });

  if (!member) return { repos: [], total: 0 };

  const where = {
    organizationId: member.organizationId,
    isActive: true,
    ...(query
      ? { fullName: { contains: query, mode: "insensitive" as const } }
      : {}),
  };

  const [repos, total] = await Promise.all([
    prisma.repository.findMany({
      where,
      select: {
        id: true,
        name: true,
        fullName: true,
        reviewModelId: true,
        embedModelId: true,
      },
      orderBy: [{ name: "asc" }],
      skip,
      take,
    }),
    prisma.repository.count({ where }),
  ]);

  // Sort: custom (has overrides) first
  repos.sort((a, b) => {
    const aCustom = a.reviewModelId || a.embedModelId ? 1 : 0;
    const bCustom = b.reviewModelId || b.embedModelId ? 1 : 0;
    if (aCustom !== bCustom) return bCustom - aCustom;
    return 0;
  });

  return { repos, total };
}
