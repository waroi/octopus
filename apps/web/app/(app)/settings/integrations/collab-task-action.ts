"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@octopus/db";
import { createCollabTask, listCollabProjects } from "@/lib/collab";
import Anthropic from "@anthropic-ai/sdk";
import { logAiUsage } from "@/lib/ai-usage";
import { isOrgOverSpendLimit } from "@/lib/cost";
import { getReviewModel } from "@/lib/ai-client";

// ── Helpers ──

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

let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return anthropicClient;
}

// ── Legacy action (backward compat) ──

export async function createCollabTaskFromIssue(
  issueId: string,
): Promise<{ error?: string; taskId?: string }> {
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

  const issue = await prisma.reviewIssue.findUnique({
    where: { id: issueId },
    include: {
      pullRequest: {
        include: {
          repository: true,
        },
      },
    },
  });

  if (!issue) return { error: "Issue not found." };

  const repo = issue.pullRequest.repository;
  if (repo.organizationId !== orgId) {
    return { error: "Issue does not belong to this organization." };
  }

  const integration = await prisma.collabIntegration.findUnique({
    where: { organizationId: orgId },
    include: {
      projectMappings: {
        where: { repositoryId: repo.id },
      },
    },
  });

  if (!integration || !integration.isActive) {
    return { error: "Collab integration is not configured." };
  }

  const mapping = integration.projectMappings[0];
  if (!mapping) {
    return { error: `No Collab project mapped for ${repo.fullName}.` };
  }

  try {
    const result = await createCollabTask(
      integration.apiKey,
      mapping.collabProjectId,
      {
        title: issue.title,
        description: issue.description,
        severity: issue.severity,
        filePath: issue.filePath ?? undefined,
        lineNumber: issue.lineNumber ?? undefined,
        prUrl: issue.pullRequest.url,
      },
    );

    return { taskId: result.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[collab-task] Failed to create task:", err);
    return { error: message };
  }
}

// ── New multi-step actions ──

type InitResult =
  | { step: "mapped"; projectName: string; repoFullName: string }
  | { step: "select_project"; projects: { id: string; name: string; slug: string }[]; repoId: string; repoName: string }
  | { error: string };

export async function initIssueCreation(issueId: string): Promise<InitResult> {
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

  const integration = await prisma.collabIntegration.findUnique({
    where: { organizationId: orgId },
    include: {
      projectMappings: {
        where: { repositoryId: repo.id },
      },
    },
  });

  if (!integration || !integration.isActive) {
    return { error: "Collab integration is not configured." };
  }

  const mapping = integration.projectMappings[0];
  if (mapping) {
    return {
      step: "mapped",
      projectName: mapping.collabProjectName,
      repoFullName: repo.fullName,
    };
  }

  // No mapping — fetch projects for selection
  try {
    const projects = await listCollabProjects(integration.apiKey);
    return {
      step: "select_project",
      projects,
      repoId: repo.id,
      repoName: repo.fullName,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch projects";
    console.error("[collab-task] Failed to list projects:", err);
    return { error: message };
  }
}

export async function saveProjectMapping(
  repoId: string,
  projectId: string,
  projectName: string,
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getSessionAndOrg();
  if ("error" in ctx) return { error: ctx.error };
  const { orgId } = ctx;

  const integration = await prisma.collabIntegration.findUnique({
    where: { organizationId: orgId },
    select: { id: true },
  });

  if (!integration) return { error: "No Collab integration found." };

  await prisma.collabProjectMapping.upsert({
    where: {
      collabIntegrationId_repositoryId: {
        collabIntegrationId: integration.id,
        repositoryId: repoId,
      },
    },
    create: {
      collabProjectId: projectId,
      collabProjectName: projectName,
      repositoryId: repoId,
      collabIntegrationId: integration.id,
    },
    update: {
      collabProjectId: projectId,
      collabProjectName: projectName,
    },
  });

  return { success: true };
}

export async function generateIssueContent(
  issueId: string,
): Promise<{ title: string; description: string } | { error: string }> {
  const ctx = await getSessionAndOrg();
  if ("error" in ctx) return { error: ctx.error };
  const { orgId } = ctx;

  // Check spend limit
  if (await isOrgOverSpendLimit(orgId)) {
    return { error: "Monthly AI usage limit reached. Please upgrade or wait until next month." };
  }

  const issue = await prisma.reviewIssue.findUnique({
    where: { id: issueId },
    include: {
      pullRequest: {
        select: { url: true, title: true, number: true },
      },
    },
  });

  if (!issue) return { error: "Issue not found." };

  const model = await getReviewModel(orgId);

  try {
    const response = await getAnthropicClient().messages.create({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a senior software engineer creating a structured bug report from an automated code review finding.

Review finding data:
- Title: ${issue.title}
- Description: ${issue.description}
- Severity: ${issue.severity}
- File: ${issue.filePath ?? "N/A"}${issue.lineNumber ? `:${issue.lineNumber}` : ""}
- Pull Request: ${issue.pullRequest.title} (#${issue.pullRequest.number})
- PR URL: ${issue.pullRequest.url}

Generate a well-structured bug report in JSON format with two fields:
1. "title": A concise, actionable issue title (max 80 chars). Do not just copy the review title — improve it.
2. "description": A structured plain-text description with the following sections separated by blank lines:

## Summary
One-paragraph summary of the issue.

## Details
Technical details about what was found and why it matters.

## Location
File path, line number, and PR reference.

## Suggested Action
Clear steps to fix the issue.

Write everything in English. Be professional and concise. Do NOT use markdown code fences in the description, use plain text with ## headers.

Respond ONLY with valid JSON: {"title": "...", "description": "..."}`,
        },
      ],
    });

    logAiUsage({
      provider: model.startsWith("gpt") || model.startsWith("o1") || model.startsWith("o3") ? "openai" : "anthropic",
      model,
      operation: "generate-issue-content",
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
      organizationId: orgId,
    }).catch(console.warn);

    let text = response.content[0].type === "text" ? response.content[0].text : "";

    // Strip markdown code fences if present
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) {
      text = fenceMatch[1].trim();
    }

    const parsed = JSON.parse(text);
    return {
      title: parsed.title ?? issue.title,
      description: parsed.description ?? issue.description,
    };
  } catch (err) {
    console.error("[collab-task] AI content generation failed:", err);
    // Fallback to raw issue data
    return {
      title: issue.title,
      description: `## Summary\n${issue.description}\n\n## Location\n${issue.filePath ?? "N/A"}${issue.lineNumber ? `:${issue.lineNumber}` : ""}\n\n## Source\nPR: ${issue.pullRequest.title} (#${issue.pullRequest.number})\n${issue.pullRequest.url}`,
    };
  }
}

export async function createIssueFromReview(
  issueId: string,
  title: string,
  description: string,
): Promise<{ taskId?: string; error?: string }> {
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

  const integration = await prisma.collabIntegration.findUnique({
    where: { organizationId: orgId },
    include: {
      projectMappings: {
        where: { repositoryId: repo.id },
      },
    },
  });

  if (!integration || !integration.isActive) {
    return { error: "Collab integration is not configured." };
  }

  const mapping = integration.projectMappings[0];
  if (!mapping) {
    return { error: `No Collab project mapped for ${repo.fullName}.` };
  }

  try {
    const result = await createCollabTask(
      integration.apiKey,
      mapping.collabProjectId,
      {
        title,
        description,
        severity: issue.severity,
        filePath: issue.filePath ?? undefined,
        lineNumber: issue.lineNumber ?? undefined,
        prUrl: issue.pullRequest.url,
      },
    );

    return { taskId: result.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[collab-task] Failed to create issue:", err);
    return { error: message };
  }
}
