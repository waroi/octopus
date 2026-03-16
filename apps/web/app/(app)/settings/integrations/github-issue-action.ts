"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@octopus/db";
import { createGitHubIssue } from "@/lib/github";

async function getSessionAndOrg(): Promise<{ orgId: string } | { error: string }> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) redirect("/login");

  const cookieStore = await cookies();
  const orgId = cookieStore.get("current_org_id")?.value;
  if (!orgId) return { error: "No organization selected." };

  const member = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organizationId: orgId, deletedAt: null },
    select: { id: true },
  });
  if (!member) return { error: "Not a member of this organization." };

  return { orgId };
}

type InitResult =
  | { step: "ready"; repoFullName: string }
  | { error: string };

export async function initGitHubIssueCreation(issueId: string): Promise<InitResult> {
  const ctx = await getSessionAndOrg();
  if ("error" in ctx) return { error: ctx.error };
  const { orgId } = ctx;

  const issue = await prisma.reviewIssue.findUnique({
    where: { id: issueId },
    include: {
      pullRequest: {
        include: { repository: true },
      },
    },
  });

  if (!issue) return { error: "Issue not found." };

  const repo = issue.pullRequest.repository;
  if (repo.organizationId !== orgId) {
    return { error: "Issue does not belong to this organization." };
  }

  if (repo.provider !== "github") {
    return { error: "GitHub issues can only be created for GitHub repositories." };
  }

  // Verify we have an installation ID (prefer org-level, it's more up-to-date after reinstalls)
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { githubInstallationId: true },
  });
  const installationId = org?.githubInstallationId ?? repo.installationId;
  if (!installationId) {
    return { error: "No GitHub App installation found." };
  }

  return { step: "ready", repoFullName: repo.fullName };
}

export async function createGitHubIssueFromReview(
  issueId: string,
  title: string,
  description: string,
): Promise<{ issueNumber?: number; issueUrl?: string; error?: string }> {
  const ctx = await getSessionAndOrg();
  if ("error" in ctx) return { error: ctx.error };
  const { orgId } = ctx;

  const issue = await prisma.reviewIssue.findUnique({
    where: { id: issueId },
    include: {
      pullRequest: {
        include: { repository: true },
      },
    },
  });

  if (!issue) return { error: "Issue not found." };

  const repo = issue.pullRequest.repository;
  if (repo.organizationId !== orgId) {
    return { error: "Issue does not belong to this organization." };
  }

  if (repo.provider !== "github") {
    return { error: "GitHub issues can only be created for GitHub repositories." };
  }

  // Prefer org-level installation ID (more up-to-date after reinstalls)
  const orgForInstall = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { githubInstallationId: true },
  });
  const installationId = orgForInstall?.githubInstallationId ?? repo.installationId;

  if (!installationId) {
    return { error: "No GitHub App installation found." };
  }

  const [owner, repoName] = repo.fullName.split("/");

  try {
    const result = await createGitHubIssue(
      installationId,
      owner,
      repoName,
      title,
      description,
      ["octopus-review"],
    );

    await prisma.reviewIssue.update({
      where: { id: issueId },
      data: {
        githubIssueNumber: result.number,
        githubIssueUrl: result.html_url,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/timeline");
    return { issueNumber: result.number, issueUrl: result.html_url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[github-issue] Failed to create GitHub issue:", err);
    return { error: message };
  }
}
