import crypto from "node:crypto";
import { prisma } from "@octopus/db";
import { pubby } from "@/lib/pubby";
import {
  searchSimilarChunks,
  searchKnowledgeChunks,
  ensureReviewCollection,
  upsertReviewChunks,
  deleteReviewChunksByPR,
  ensureDiagramCollection,
  upsertDiagramChunk,
  deleteDiagramChunksByPR,
  searchFeedbackPatterns,
  ensureFeedbackCollection,
} from "@/lib/qdrant";
import { extractAllMermaidBlocks, extractNodeLabels, DIAGRAM_TYPE_LABELS } from "@/lib/mermaid-utils";
import { createEmbeddings } from "@/lib/embeddings";
import { rerankDocuments } from "@/lib/reranker";
import {
  getPullRequestDiff as ghGetPullRequestDiff,
  createPullRequestComment as ghCreatePullRequestComment,
  updatePullRequestComment as ghUpdatePullRequestComment,
  createPullRequestReview as ghCreatePullRequestReview,
  createCheckRun as ghCreateCheckRun,
  updateCheckRun as ghUpdateCheckRun,
  getRepositoryTree as ghGetRepositoryTree,
  getFileContent as ghGetFileContent,
  listReviewComments as ghListReviewComments,
} from "@/lib/github";
import * as bitbucket from "@/lib/bitbucket";
import { parseOctopusIgnore, filterDiff, detectBadCommits } from "@/lib/octopus-ignore";
import type { ReviewComment } from "@/lib/github";
import { eventBus } from "@/lib/events";
import { indexRepository } from "@/lib/indexer";
import type { LogLevel } from "@/lib/indexer";
import { summarizeRepository } from "@/lib/summarizer";
import { analyzeRepository } from "@/lib/analyzer";
import { writeSyncLog, deleteSyncLogs } from "@/lib/elasticsearch";
import { logAiUsage } from "@/lib/ai-usage";
import { getReviewModel } from "@/lib/ai-client";
import { createAiMessage, resolveProvider } from "@/lib/ai-router";
import { isOrgOverSpendLimit } from "@/lib/cost";
import fs from "node:fs";
import path from "node:path";

// Load system prompt template once (with diagram rules injected)
let systemPromptTemplate: string | null = null;
let conflictDetectionTemplate: string | null = null;

function getSystemPrompt(): string {
  if (!systemPromptTemplate) {
    const promptsDir = path.join(process.cwd(), "prompts");
    let template = fs.readFileSync(path.join(promptsDir, "SYSTEM_PROMPT.md"), "utf-8");
    const diagramRules = fs.readFileSync(path.join(promptsDir, "DIAGRAM_RULES.md"), "utf-8");
    template = template.replace("{{DIAGRAM_RULES}}", diagramRules);
    systemPromptTemplate = template;
  }
  return systemPromptTemplate;
}

function getConflictDetectionPrompt(): string {
  if (!conflictDetectionTemplate) {
    const promptsDir = path.join(process.cwd(), "prompts");
    conflictDetectionTemplate = fs.readFileSync(path.join(promptsDir, "CONFLICT_DETECTION.md"), "utf-8");
  }
  return conflictDetectionTemplate;
}

/** Check if a diff touches shared files (types, utils, config, schema) that warrant conflict detection. */
function touchesSharedFiles(diff: string): boolean {
  const sharedPatterns = [
    /^diff --git a\/.*(?:types|interfaces|schema|models)\//m,
    /^diff --git a\/.*(?:utils|helpers|shared|common)\//m,
    /^diff --git a\/.*(?:config|\.env|docker|ci)\b/m,
    /^diff --git a\/.*\.d\.ts\b/m,
    /^diff --git a\/.*(?:prisma\/schema|migrations)\//m,
    /^diff --git a\/.*(?:package\.json|tsconfig)/m,
  ];
  return sharedPatterns.some((p) => p.test(diff));
}

function extractUserInstruction(commentBody: string): string {
  // Match @octopus or @octopus-review, then capture everything after
  const match = commentBody.match(/@octopus(?:-review)?\b\s*([\s\S]*)/i);
  const raw = match?.[1]?.trim() ?? "";
  // Strip bare "review" keyword that people use to trigger re-reviews
  return raw.replace(/^review\b\s*/i, "").trim();
}

/** Count unique files changed in a unified diff */
function countDiffFiles(diff: string): number {
  const files = new Set<string>();
  for (const match of diff.matchAll(/^diff --git a\/(.+?) b\//gm)) {
    files.add(match[1]);
  }
  return files.size;
}

/** Count findings (#### [SEVERITY] patterns) in the review body */
function countFindings(reviewBody: string): number {
  const matches = reviewBody.match(/^####\s+(?:🔴|🟠|🟡|🔵|💡)/gm);
  return matches?.length ?? 0;
}

/**
 * Parse a unified diff to get valid (file → line numbers) on the RIGHT side.
 * GitHub Reviews API only accepts comments on lines visible in the diff.
 */
function parseDiffLines(diff: string): Map<string, Set<number>> {
  const fileLines = new Map<string, Set<number>>();
  let currentFile = "";
  let newLine = 0;

  for (const line of diff.split("\n")) {
    const fileMatch = line.match(/^diff --git a\/(.+?) b\/(.+)/);
    if (fileMatch) {
      currentFile = fileMatch[2];
      if (!fileLines.has(currentFile)) {
        fileLines.set(currentFile, new Set());
      }
      continue;
    }

    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      newLine = parseInt(hunkMatch[1], 10);
      continue;
    }

    if (!currentFile) continue;

    if (line.startsWith("-") && !line.startsWith("---")) {
      // deleted line — don't increment newLine
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      fileLines.get(currentFile)?.add(newLine);
      newLine++;
    } else if (!line.startsWith("\\")) {
      // context line
      fileLines.get(currentFile)?.add(newLine);
      newLine++;
    }
  }

  return fileLines;
}

type InlineFinding = {
  severity: string;
  title: string;
  filePath: string;
  startLine: number;
  endLine: number;
  category: string;
  description: string;
  suggestion: string;
  confidence: string;
};

const MAX_FINDINGS_PER_REVIEW = 30;

const SEVERITY_PRIORITY: Record<string, number> = {
  "🔴": 0,
  "🟠": 1,
  "🟡": 2,
  "🔵": 3,
  "💡": 4,
};

/** Sort findings by severity priority and cap at max. Returns kept findings and truncated count. */
function sortAndCapFindings(
  findings: InlineFinding[],
  max: number,
): { kept: InlineFinding[]; truncatedCount: number } {
  const sorted = [...findings].sort(
    (a, b) => (SEVERITY_PRIORITY[a.severity] ?? 99) - (SEVERITY_PRIORITY[b.severity] ?? 99),
  );
  if (sorted.length <= max) return { kept: sorted, truncatedCount: 0 };
  return { kept: sorted.slice(0, max), truncatedCount: sorted.length - max };
}

/** Build a collapsed summary block for low-severity findings (🔵/💡) that won't get inline comments. */
function buildLowSeveritySummary(findings: InlineFinding[]): string {
  if (findings.length === 0) return "";
  const rows = findings.map(
    (f) => `| ${f.severity} | \`${f.filePath}:L${f.startLine}\` | ${f.title} | ${f.description.slice(0, 120)}${f.description.length > 120 ? "…" : ""} |`,
  );
  return [
    "",
    "<details>",
    "<summary>🔵💡 Low-priority findings (" + findings.length + ")</summary>",
    "",
    "| Severity | File | Title | Description |",
    "|----------|------|-------|-------------|",
    ...rows,
    "",
    "</details>",
    "",
  ].join("\n");
}

/**
 * Parse findings from the review body.
 * Expected format per SYSTEM_PROMPT.md:
 *   #### 🔴 CRITICAL — Title
 *   - **File:** `path/to/file.ts:L42-L58`
 *   - **Description:** ...
 *   - **Suggestion:**
 *   ```lang
 *   code
 *   ```
 */
function parseFindings(reviewBody: string): InlineFinding[] {
  const findings: InlineFinding[] = [];
  const parts = reviewBody.split(/^####\s+/m);

  for (const part of parts) {
    if (!part.trim()) continue;

    const severityMatch = part.match(/^(🔴|🟠|🟡|🔵|💡)\s+(.+)/);
    if (!severityMatch) continue;

    const severity = severityMatch[1];
    const title = severityMatch[2].split("\n")[0].trim();

    const fileMatch = part.match(/\*\*File:\*\*\s*`([^`:]+):L(\d+)(?:-L(\d+))?`/);
    if (!fileMatch) continue;

    const filePath = fileMatch[1];
    const startLine = parseInt(fileMatch[2], 10);
    const endLine = fileMatch[3] ? parseInt(fileMatch[3], 10) : startLine;

    const catMatch = part.match(/\*\*Category:\*\*\s*(.+)/);
    const category = catMatch?.[1]?.trim() ?? "";

    const descMatch = part.match(/\*\*Description:\*\*\s*([\s\S]+?)(?=\n-\s*\*\*|$)/);
    const description = descMatch?.[1]?.trim() ?? "";

    const suggMatch = part.match(/\*\*Suggestion:\*\*\s*\n```\w*\n([\s\S]+?)```/);
    const suggestion = suggMatch?.[1]?.trimEnd() ?? "";

    const confMatch = part.match(/\*\*Confidence:\*\*\s*(HIGH|MEDIUM|LOW)/i);
    const confidence = confMatch?.[1]?.toUpperCase() ?? "MEDIUM";

    findings.push({ severity, title, filePath, startLine, endLine, category, description, suggestion, confidence });
  }

  return findings;
}

/**
 * Strip the <details>Detailed Findings</details> block from the review body
 * so the main PR comment stays concise. Findings are posted as inline comments instead.
 */
function stripDetailedFindings(reviewBody: string): string {
  return reviewBody.replace(
    /\n*<details>\s*\n\s*<summary>\s*Detailed Findings\s*<\/summary>[\s\S]*?<\/details>\s*/i,
    "",
  );
}

/**
 * Convert parsed findings into GitHub review comments, filtering to valid diff lines.
 */
function buildInlineComments(
  findings: InlineFinding[],
  diffLines: Map<string, Set<number>>,
  provider: string = "github",
): ReviewComment[] {
  const comments: ReviewComment[] = [];

  for (const f of findings) {
    const validLines = diffLines.get(f.filePath);
    if (!validLines) continue;

    // Find a valid line to attach the comment to (prefer endLine, fallback to startLine)
    let targetLine = validLines.has(f.endLine) ? f.endLine : 0;
    if (!targetLine && validLines.has(f.startLine)) {
      targetLine = f.startLine;
    }
    if (!targetLine) {
      // Find the closest valid line within the range
      for (let l = f.endLine; l >= f.startLine; l--) {
        if (validLines.has(l)) {
          targetLine = l;
          break;
        }
      }
    }
    if (!targetLine) continue;

    let body = `**${f.severity} ${f.title}**\n\n${f.description}`;
    if (f.suggestion) {
      // GitHub supports native ```suggestion blocks; Bitbucket uses plain code blocks
      const suggestionBlock = provider === "github"
        ? `\`\`\`suggestion\n${f.suggestion}\n\`\`\``
        : `**Suggested fix:**\n\`\`\`\n${f.suggestion}\n\`\`\``;
      body += `\n\n${suggestionBlock}`;
    }

    // AI Fix Prompt — collapsible section with copy-pasteable prompt
    const severityLabel = f.severity === "🔴" ? "Critical" : f.severity === "🟠" ? "High" : f.severity === "🟡" ? "Medium" : f.severity === "🔵" ? "Low" : "Nit";
    const categoryNote = f.category ? ` (${f.category})` : "";
    const lineRange = f.startLine === f.endLine ? `line ${f.startLine}` : `lines ${f.startLine}-${f.endLine}`;
    let aiPrompt = `Fix the following ${severityLabel}${categoryNote} issue in \`${f.filePath}\` at ${lineRange}:\n\n`;
    aiPrompt += `Problem: ${f.description}`;
    if (f.suggestion) {
      aiPrompt += `\n\nSuggested fix:\n${f.suggestion}`;
    }
    body += `\n\n<details><summary>🤖 AI Fix Prompt</summary>\n\n\`\`\`\n${aiPrompt}\n\`\`\`\n\n</details>`;

    comments.push({
      path: f.filePath,
      line: targetLine,
      side: "RIGHT" as const,
      body,
    });
  }

  return comments;
}

type ReviewConfig = {
  maxFindings?: number;
  inlineThreshold?: string; // severity threshold for inline comments: "critical" | "high" | "medium" (default)
  enableConflictDetection?: boolean;
  disabledCategories?: string[];
  confidenceThreshold?: string; // "HIGH" | "MEDIUM" (default)
  enableTwoPassReview?: boolean;
};

function parseReviewConfig(raw: unknown): ReviewConfig {
  if (!raw || typeof raw !== "object") return {};
  return raw as ReviewConfig;
}

/** Merge review configs: system defaults -> org defaults -> repo overrides. Later values win. */
function mergeReviewConfigs(...configs: ReviewConfig[]): ReviewConfig {
  const merged: ReviewConfig = {};
  for (const cfg of configs) {
    if (cfg.maxFindings !== undefined) merged.maxFindings = cfg.maxFindings;
    if (cfg.inlineThreshold !== undefined) merged.inlineThreshold = cfg.inlineThreshold;
    if (cfg.enableConflictDetection !== undefined) merged.enableConflictDetection = cfg.enableConflictDetection;
    if (cfg.disabledCategories !== undefined) merged.disabledCategories = cfg.disabledCategories;
    if (cfg.confidenceThreshold !== undefined) merged.confidenceThreshold = cfg.confidenceThreshold;
    if (cfg.enableTwoPassReview !== undefined) merged.enableTwoPassReview = cfg.enableTwoPassReview;
  }
  return merged;
}

/** Validate findings with a second LLM pass. Returns only the findings that pass validation. */
async function validateFindings(
  findings: InlineFinding[],
  diff: string,
  orgId: string,
  model: string,
): Promise<InlineFinding[]> {
  if (findings.length === 0) return findings;

  const findingsSummary = findings
    .map((f, i) => `[${i}] ${f.severity} ${f.title}\nFile: ${f.filePath}:L${f.startLine}\nDescription: ${f.description}`)
    .join("\n\n");

  const response = await createAiMessage(
    {
      model,
      maxTokens: 2048,
      messages: [
        {
          role: "user",
          content: `You are a senior code reviewer validating findings from an automated review. For each finding below, determine if it is a genuine issue based on the diff provided.

FINDINGS:
${findingsSummary}

DIFF:
\`\`\`diff
${diff.slice(0, 12000)}
\`\`\`

For each finding, respond with ONLY a JSON array of verdicts:
[{"index": 0, "verdict": "KEEP"}, {"index": 1, "verdict": "DISCARD"}, ...]

KEEP = the finding is a real, actionable issue visible in the diff
DISCARD = the finding is speculative, a false positive, or not supported by the diff

Output ONLY the JSON array, nothing else.`,
        },
      ],
    },
    orgId,
  );

  await logAiUsage({
    provider: response.provider,
    model,
    operation: "review-validation",
    inputTokens: response.usage.inputTokens,
    outputTokens: response.usage.outputTokens,
    cacheReadTokens: response.usage.cacheReadTokens,
    cacheWriteTokens: response.usage.cacheWriteTokens,
    organizationId: orgId,
  });

  try {
    const jsonMatch = response.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return findings;
    const verdicts = JSON.parse(jsonMatch[0]) as { index: number; verdict: string }[];
    const keepIndexes = new Set(
      verdicts.filter((v) => v.verdict === "KEEP").map((v) => v.index),
    );
    const validated = findings.filter((_, i) => keepIndexes.has(i));
    console.log(`[reviewer] Two-pass validation: ${validated.length}/${findings.length} findings kept`);
    return validated;
  } catch {
    console.warn("[reviewer] Failed to parse two-pass validation response, keeping all findings");
    return findings;
  }
}

type ReviewEvent = {
  repoId: string;
  pullRequestId: string;
  number: number;
  status: "reviewing" | "completed" | "failed";
  step:
    | "started"
    | "fetching-diff"
    | "searching-context"
    | "generating-review"
    | "posting-comment"
    | "completed"
    | "failed";
  detail?: string;
  error?: string;
};

async function emitReviewStatus(orgId: string, event: ReviewEvent) {
  await pubby
    .trigger(`presence-org-${orgId}`, "review-status", event)
    .catch((err) =>
      console.error("[reviewer] Pubby trigger failed:", err),
    );
}

export async function processReview(pullRequestId: string): Promise<void> {
  // Load PR with repo and org info
  const pr = await prisma.pullRequest.findUnique({
    where: { id: pullRequestId },
    include: {
      repository: {
        include: { organization: true },
      },
    },
  });

  if (!pr) {
    console.error(`[reviewer] PullRequest not found: ${pullRequestId}`);
    return;
  }

  const repo = pr.repository;
  const org = repo.organization;

  // 3-tier config: system defaults -> org defaults -> repo overrides
  let systemConfig: ReviewConfig = {};
  try {
    const sysRow = await prisma.systemConfig.findUnique({ where: { id: "singleton" } });
    if (sysRow) systemConfig = parseReviewConfig(sysRow.defaultReviewConfig);
  } catch { /* table may not exist yet */ }
  const orgConfig = parseReviewConfig(org.defaultReviewConfig);
  const repoConfig = parseReviewConfig(repo.reviewConfig);
  const reviewConfig = mergeReviewConfigs(systemConfig, orgConfig, repoConfig);

  if (org.reviewsPaused) {
    console.log(`[reviewer] Reviews paused for org ${org.id}, skipping PR ${pr.id}`);
    return;
  }

  const isGitHub = repo.provider === "github";
  const isBitbucket = repo.provider === "bitbucket";
  const installationId = repo.installationId ?? org.githubInstallationId;

  if (isGitHub && !installationId) {
    console.error(`[reviewer] No GitHub installation for repo: ${repo.id}`);
    return;
  }

  const [owner, repoName] = repo.fullName.split("/");

  // Provider-aware helper functions
  const providerGetDiff = (prNumber: number) =>
    isGitHub
      ? ghGetPullRequestDiff(installationId!, owner, repoName, prNumber)
      : bitbucket.getPullRequestDiff(org.id, owner, repoName, prNumber);

  const providerCreateComment = (prNumber: number, body: string) =>
    isGitHub
      ? ghCreatePullRequestComment(installationId!, owner, repoName, prNumber, body)
      : bitbucket.createPullRequestComment(org.id, owner, repoName, prNumber, body);

  const providerUpdateComment = (commentId: number, body: string) =>
    isGitHub
      ? ghUpdatePullRequestComment(installationId!, owner, repoName, commentId, body)
      : bitbucket.updatePullRequestComment(org.id, owner, repoName, pr.number, commentId, body);

  const providerGetTree = (branch: string) =>
    isGitHub
      ? ghGetRepositoryTree(installationId!, owner, repoName, branch)
      : bitbucket.getRepositoryTree(org.id, owner, repoName, branch);
  const reviewCommentId = pr.reviewCommentId ? Number(pr.reviewCommentId) : null;
  const baseEvent = {
    repoId: repo.id,
    pullRequestId: pr.id,
    number: pr.number,
  };

  // Create check run if we have a head SHA (GitHub only — Bitbucket has no checks API)
  let checkRunId: number | null = null;
  if (pr.headSha && isGitHub && installationId) {
    try {
      checkRunId = await ghCreateCheckRun(
        installationId,
        owner,
        repoName,
        pr.headSha,
        "Octopus Review",
      );
      console.log(`[reviewer] Check run created — id: ${checkRunId}`);

      // Clear permission flag if it was previously set
      if (org.needsPermissionGrant) {
        await prisma.organization.update({
          where: { id: org.id },
          data: { needsPermissionGrant: false },
        });
        console.log(`[reviewer] Permission grant flag cleared for org: ${org.id}`);
      }
    } catch (err) {
      console.error("[reviewer] Failed to create check run:", err);

      // 403 means the GitHub App needs new permissions accepted
      if (err instanceof Error && err.message.includes("403")) {
        await prisma.organization.update({
          where: { id: org.id },
          data: { needsPermissionGrant: true },
        }).catch((e) => console.error("[reviewer] Failed to set permission flag:", e));
        console.warn(`[reviewer] Permission grant needed for org: ${org.id}`);
      }
    }
  }

  try {
    // Phase 0: Auto-index & analyze if repository hasn't been indexed yet
    if (repo.indexStatus !== "indexed") {
      console.log(`[reviewer] Repository ${repo.fullName} not indexed (status: ${repo.indexStatus}). Starting auto-index...`);

      // 0a. Update placeholder comment — indexing
      if (reviewCommentId) {
        await providerUpdateComment(
          reviewCommentId,
          "> 🐙 **Octopus Review** — This repository hasn't been indexed yet.\n>\n> Indexing in progress... this may take a few minutes. (Step 1/3)",
        );
      }

      // 0b. Run indexing (with real-time logs via Pubby + Elasticsearch)
      const indexChannel = `presence-org-${org.id}`;

      await deleteSyncLogs(org.id, repo.id);

      await prisma.repository.update({
        where: { id: repo.id },
        data: { indexStatus: "indexing" },
      });

      pubby.trigger(indexChannel, "index-status", {
        repoId: repo.id,
        status: "indexing",
      }).catch((err) => console.error("[reviewer] Pubby index-status trigger failed:", err));

      const emitIndexLog = (message: string, level: LogLevel = "info") => {
        const timestamp = Date.now();
        pubby.trigger(indexChannel, "index-log", {
          repoId: repo.id,
          message,
          level,
          timestamp,
        }).catch((err) => console.error("[reviewer] Pubby index-log trigger failed:", err));
        writeSyncLog({
          orgId: org.id,
          repoId: repo.id,
          message,
          level,
          timestamp,
        });
      };

      const indexStats = await indexRepository(
        repo.id,
        repo.fullName,
        repo.defaultBranch,
        installationId ?? 0,
        emitIndexLog,
        undefined,
        repo.provider,
        repo.organizationId,
      );

      // 0c. Update DB with index results
      await prisma.repository.update({
        where: { id: repo.id },
        data: {
          indexStatus: "indexed",
          indexedAt: new Date(),
          indexedFiles: indexStats.indexedFiles,
          totalFiles: indexStats.totalFiles,
          totalChunks: indexStats.totalChunks,
          totalVectors: indexStats.totalVectors,
          indexDurationMs: indexStats.durationMs,
          contributorCount: indexStats.contributorCount,
          contributors: JSON.parse(JSON.stringify(indexStats.contributors)),
        },
      });

      emitIndexLog(`Indexing complete: ${indexStats.indexedFiles} files, ${indexStats.totalVectors} vectors`, "success");

      pubby.trigger(indexChannel, "index-status", {
        repoId: repo.id,
        status: "indexed",
      }).catch((err) => console.error("[reviewer] Pubby index-status trigger failed:", err));

      console.log(`[reviewer] Indexing complete: ${indexStats.indexedFiles} files, ${indexStats.totalVectors} vectors`);

      // 0d. Update placeholder comment — analyzing
      if (reviewCommentId) {
        await providerUpdateComment(
          reviewCommentId,
          `> 🐙 **Octopus Review** — Indexing complete ✓ (${indexStats.indexedFiles} files, ${indexStats.totalVectors} vectors).\n>\n> Analyzing repository... (Step 2/3)`,
        );
      }

      // 0e. Summarize repository
      const { summary, purpose } = await summarizeRepository(repo.id, repo.fullName, org.id);
      await prisma.repository.update({
        where: { id: repo.id },
        data: { summary, purpose },
      });

      console.log(`[reviewer] Summary complete: ${purpose}`);

      // 0f. Analyze repository
      await prisma.repository.update({
        where: { id: repo.id },
        data: { analysisStatus: "analyzing" },
      });

      pubby.trigger(indexChannel, "analysis-status", {
        repoId: repo.id,
        status: "analyzing",
      }).catch((err) => console.error("[reviewer] Pubby analysis-status trigger failed:", err));

      const analysis = await analyzeRepository(repo.id, repo.fullName, org.id);
      await prisma.repository.update({
        where: { id: repo.id },
        data: {
          analysis,
          analysisStatus: "analyzed",
          analyzedAt: new Date(),
        },
      });

      pubby.trigger(indexChannel, "analysis-status", {
        repoId: repo.id,
        status: "analyzed",
      }).catch((err) => console.error("[reviewer] Pubby analysis-status trigger failed:", err));

      console.log(`[reviewer] Analysis complete`);

      // 0g. Update placeholder comment — ready for review
      if (reviewCommentId) {
        await providerUpdateComment(
          reviewCommentId,
          "> 🐙 **Octopus Review** — Repository indexed and analyzed ✓.\n>\n> Starting PR review... (Step 3/3)",
        );
      }

      // 0h. Enable auto-review for this repo
      await prisma.repository.update({
        where: { id: repo.id },
        data: { autoReview: true },
      });

      // 0i. Emit Pubby events for dashboard updates
      await pubby.trigger(`presence-org-${org.id}`, "repo-indexed", {
        repoId: repo.id,
        fullName: repo.fullName,
        indexedFiles: indexStats.indexedFiles,
        totalVectors: indexStats.totalVectors,
      }).catch((err) => console.error("[reviewer] Pubby repo-indexed trigger failed:", err));

      eventBus.emit({
        type: "repo-indexed",
        orgId: org.id,
        repoFullName: repo.fullName,
        success: true,
        indexedFiles: indexStats.indexedFiles,
        totalVectors: indexStats.totalVectors,
        durationMs: indexStats.durationMs,
      });

      await pubby.trigger(`presence-org-${org.id}`, "repo-analyzed", {
        repoId: repo.id,
        fullName: repo.fullName,
      }).catch((err) => console.error("[reviewer] Pubby repo-analyzed trigger failed:", err));

      eventBus.emit({
        type: "repo-analyzed",
        orgId: org.id,
        repoFullName: repo.fullName,
      });

      console.log(`[reviewer] Phase 0 complete — ${repo.fullName} indexed, analyzed, auto-review enabled`);
    }

    // Resolve the model to use for this org (with repo-level override)
    const reviewModel = await getReviewModel(org.id, repo.id);
    console.log(`[reviewer] Using model: ${reviewModel}`);

    // Spend limit check
    const overLimit = await isOrgOverSpendLimit(org.id);
    if (overLimit) {
      console.warn(`[reviewer] Org ${org.id} is over spend limit — skipping review`);
      const limitMsg = "> 🐙 **Octopus Review** — Your organization has reached its monthly AI usage limit.\n>\n> Please add your own API keys in Settings to continue receiving reviews.";
      if (reviewCommentId) {
        await providerUpdateComment(reviewCommentId, limitMsg);
      } else {
        await providerCreateComment(pr.number, limitMsg);
      }
      await prisma.pullRequest.update({
        where: { id: pr.id },
        data: { status: "failed", errorMessage: "Monthly spend limit reached" },
      });
      return;
    }

    // Step 1: Mark as reviewing
    await prisma.pullRequest.update({
      where: { id: pr.id },
      data: { status: "reviewing" },
    });
    await emitReviewStatus(org.id, {
      ...baseEvent,
      status: "reviewing",
      step: "started",
    });

    // Step 2: Fetch diff from GitHub
    await emitReviewStatus(org.id, {
      ...baseEvent,
      status: "reviewing",
      step: "fetching-diff",
    });

    const [rawDiff, repoTree] = await Promise.all([
      providerGetDiff(pr.number),
      providerGetTree(repo.defaultBranch),
    ]);

    // Detect committed build artifacts / dependency folders
    const badFiles = detectBadCommits(rawDiff);
    if (badFiles.length > 0) {
      console.log(`[reviewer] Detected ${badFiles.length} build artifact / dependency files in diff`);
    }

    // Fetch .octopusignore if it exists in the repo
    let diff = rawDiff;
    let octopusIg: ReturnType<typeof parseOctopusIgnore> | undefined;
    if (repoTree.includes(".octopusignore")) {
      try {
        const ignoreContent = isGitHub && installationId
          ? await ghGetFileContent(installationId, owner, repoName, repo.defaultBranch, ".octopusignore")
          : isBitbucket
            ? await bitbucket.getFileContent(org.id, owner, repoName, repo.defaultBranch, ".octopusignore")
            : null;

        if (ignoreContent) {
          octopusIg = parseOctopusIgnore(ignoreContent);
          diff = filterDiff(diff, octopusIg);
          console.log(`[reviewer] Applied .octopusignore — diff reduced from ${rawDiff.length} to ${diff.length} chars`);
        }
      } catch (err) {
        console.warn("[reviewer] Failed to fetch .octopusignore, continuing without it:", err);
      }
    }

    const filesChanged = countDiffFiles(diff);
    console.log(`[reviewer] Diff fetched: ${diff.length} chars, ${filesChanged} files, tree: ${repoTree.length} files`);

    // Step 3: Embed diff → semantic search for codebase context
    await emitReviewStatus(org.id, {
      ...baseEvent,
      status: "reviewing",
      step: "searching-context",
    });

    // Take first 8000 chars of diff as search query
    const searchText = diff.slice(0, 8000);
    const [queryVector] = await createEmbeddings([searchText], {
      organizationId: org.id,
      operation: "embedding",
      repositoryId: repo.id,
    });

    // Over-fetch from Qdrant, then rerank with Cohere
    const rerankQuery = `${pr.title}\n${diff.slice(0, 2000)}`;

    const [rawCodeChunks, rawKnowledgeChunks] = await Promise.all([
      searchSimilarChunks(repo.id, queryVector, 50),
      searchKnowledgeChunks(org.id, queryVector, 25).catch(() => [] as { title: string; text: string; score: number }[]),
    ]);

    const [contextChunks, knowledgeChunks] = await Promise.all([
      rerankDocuments(rerankQuery, rawCodeChunks, {
        topK: 15,
        scoreThreshold: 0.25,
        minResults: 3,
        organizationId: org.id,
        operation: "review-rerank",
      }),
      rerankDocuments(rerankQuery, rawKnowledgeChunks, {
        topK: 8,
        scoreThreshold: 0.20,
        minResults: 1,
        organizationId: org.id,
        operation: "review-rerank",
      }),
    ]);

    const codebaseContext = contextChunks
      .map(
        (c) =>
          `// ${c.filePath}:L${c.startLine}-L${c.endLine}\n${c.text}`,
      )
      .join("\n\n---\n\n");

    const knowledgeContext = knowledgeChunks.length > 0
      ? knowledgeChunks.map((c) => c.text).join("\n\n---\n\n")
      : "";

    await emitReviewStatus(org.id, {
      ...baseEvent,
      status: "reviewing",
      step: "searching-context",
      detail: `${contextChunks.length}/${rawCodeChunks.length} code chunks after rerank, ${knowledgeChunks.length}/${rawKnowledgeChunks.length} knowledge chunks after rerank`,
    });

    console.log(
      `[reviewer] Context: ${contextChunks.length}/${rawCodeChunks.length} code chunks, ${knowledgeChunks.length}/${rawKnowledgeChunks.length} knowledge chunks (after rerank)`,
    );

    // Step 4: Build prompt and call Anthropic
    await emitReviewStatus(org.id, {
      ...baseEvent,
      status: "reviewing",
      step: "generating-review",
    });

    const userInstruction = extractUserInstruction(
      pr.triggerCommentBody,
    );

    // Fetch past feedback (disliked = false positive, liked = valuable) for this repo
    // Aggregate into compact patterns instead of dumping raw findings
    let falsePositiveContext = "";
    try {
      const feedbackIssues = await prisma.reviewIssue.findMany({
        where: {
          feedback: { not: null },
          pullRequest: { repositoryId: repo.id },
        },
        select: {
          title: true,
          severity: true,
          feedback: true,
        },
        orderBy: { feedbackAt: "desc" },
        take: 200,
      });

      if (feedbackIssues.length > 0) {
        // Group by feedback type + normalized title to deduplicate
        const normalize = (t: string) => t.replace(/`[^`]+`/g, "...").replace(/\s+/g, " ").trim().toLowerCase();
        const groups = new Map<string, { title: string; severity: string; count: number; feedback: string }>();

        for (const issue of feedbackIssues) {
          const key = `${issue.feedback}:${normalize(issue.title)}`;
          const existing = groups.get(key);
          if (existing) {
            existing.count++;
          } else {
            groups.set(key, { title: issue.title, severity: issue.severity, count: 1, feedback: issue.feedback! });
          }
        }

        // Sort by count (most frequent feedback first), take top patterns
        const sorted = [...groups.values()].sort((a, b) => b.count - a.count);
        const disliked = sorted.filter((g) => g.feedback === "down").slice(0, 10);
        const liked = sorted.filter((g) => g.feedback === "up").slice(0, 5);

        const parts: string[] = [];
        if (disliked.length > 0) {
          parts.push(
            "FALSE POSITIVES (the team marked these as unhelpful — do NOT repeat similar findings):",
            ...disliked.map((g) => `- "${g.title}" (${g.count}x, ${g.severity})`),
          );
        }
        if (liked.length > 0) {
          parts.push(
            "",
            "VALUED FINDINGS (the team found these helpful — prioritize similar patterns):",
            ...liked.map((g) => `- "${g.title}" (${g.count}x, ${g.severity})`),
          );
        }

        if (parts.length > 0) {
          falsePositiveContext = parts.join("\n");
          console.log(`[reviewer] Feedback context: ${disliked.length} false positive patterns, ${liked.length} valued patterns (from ${feedbackIssues.length} total feedback)`);
        }
      }
    } catch (err) {
      console.warn("[reviewer] Failed to fetch feedback context:", err);
    }

    const FILE_TREE_IGNORE = [
      // JS/TS ecosystem
      "node_modules/", "dist/", "build/", ".next/", ".nuxt/",
      ".svelte-kit/", ".output/", ".turbo/", ".cache/",
      // C# / .NET
      "bin/", "obj/", "packages/", ".vs/",
      // Java / Kotlin
      "target/", ".gradle/", ".mvn/",
      // Python
      "__pycache__/", ".venv/", "venv/", ".tox/", ".mypy_cache/",
      // Go / Rust
      "vendor/",
      // IDE / editor configs
      ".vscode/", ".idea/", ".eclipse/", ".settings/",
      // Git / CI artifacts
      ".git/", "coverage/",
      // Lock files
      "package-lock.json", "bun.lock", "yarn.lock", "pnpm-lock.yaml",
    ];
    const MAX_TREE_FILES = 2000;

    const filteredTree = repoTree
      .filter((p) => !FILE_TREE_IGNORE.some((ig) => p.includes(ig)))
      .filter((p) => !octopusIg?.ignores(p));
    const fileTree = filteredTree.length > MAX_TREE_FILES
      ? filteredTree.slice(0, MAX_TREE_FILES).join("\n") + `\n... and ${filteredTree.length - MAX_TREE_FILES} more files`
      : filteredTree.join("\n");

    const enableConflict = reviewConfig.enableConflictDetection !== undefined
      ? reviewConfig.enableConflictDetection
      : touchesSharedFiles(diff);
    const conflictPrompt = enableConflict ? getConflictDetectionPrompt() : "";
    const systemPrompt = getSystemPrompt()
      .replace("{{CODEBASE_CONTEXT}}", codebaseContext)
      .replace("{{FILE_TREE}}", fileTree)
      .replace("{{KNOWLEDGE_CONTEXT}}", knowledgeContext)
      .replace("{{PR_NUMBER}}", String(pr.number))
      .replace("{{USER_INSTRUCTION}}", userInstruction)
      .replace("{{PROVIDER}}", isGitHub ? "GitHub" : isBitbucket ? "Bitbucket" : repo.provider)
      .replace("{{FALSE_POSITIVE_CONTEXT}}", falsePositiveContext)
      .replace("{{CONFLICT_DETECTION}}", conflictPrompt);

    const response = await createAiMessage(
      {
        model: reviewModel,
        maxTokens: 8192,
        system: systemPrompt,
        cacheSystem: true,
        messages: [
          {
            role: "user",
            content: `Review the following Pull Request diff:\n\n**PR #${pr.number}: ${pr.title}**\nAuthor: ${pr.author}\n${userInstruction ? `\nUser instruction: ${userInstruction}\n` : ""}\n\`\`\`diff\n${diff}\n\`\`\``,
          },
        ],
      },
      org.id,
    );

    // Fix malformed mermaid block closings: ``` merged with next line (e.g. "```### Checklist")
    // Only match ``` followed by non-language-tag chars (uppercase, #, -, *) to preserve ```mermaid etc.
    let reviewBody = response.text.replace(/```([^`\n\sa-z])/g, "```\n$1");

    // Prepend build artifact warning if bad files were detected in the diff
    if (badFiles.length > 0) {
      const badFilesSection = [
        "#### 🔴 Critical: Build artifacts / dependency folders committed",
        "",
        "The following files should NOT be committed to the repository. Add them to `.gitignore` and remove them from version control:",
        "",
        ...badFiles.slice(0, 20).map((f) => `- \`${f}\``),
        badFiles.length > 20 ? `- ... and ${badFiles.length - 20} more` : "",
        "",
      ].filter(Boolean).join("\n");
      reviewBody = badFilesSection + "\n\n" + reviewBody;
    }

    await logAiUsage({
      provider: response.provider,
      model: reviewModel,
      operation: "review",
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      cacheReadTokens: response.usage.cacheReadTokens,
      cacheWriteTokens: response.usage.cacheWriteTokens,
      organizationId: org.id,
    });

    const findingsCount = countFindings(reviewBody);
    console.log(`[reviewer] Review generated: ${reviewBody.length} chars, ${findingsCount} findings`);

    // Step 5: Post review to PR
    await emitReviewStatus(org.id, {
      ...baseEvent,
      status: "reviewing",
      step: "posting-comment",
    });

    // 5a: Update placeholder (or create new) with review body (findings stripped — they go inline)
    const mainCommentBody = stripDetailedFindings(reviewBody);

    if (reviewCommentId) {
      await providerUpdateComment(reviewCommentId, mainCommentBody);
      console.log(`[reviewer] Placeholder comment updated — commentId: ${reviewCommentId}`);
    } else {
      const newCommentId = await providerCreateComment(pr.number, mainCommentBody);
      await prisma.pullRequest.update({
        where: { id: pr.id },
        data: { reviewCommentId: newCommentId },
      });
      console.log(`[reviewer] New review comment created — commentId: ${newCommentId}`);
    }

    // 5b: Parse findings and submit inline review comments
    let findings = parseFindings(reviewBody);
    let effectiveReviewBody = reviewBody;

    // Fallback: if Findings Summary table has counts but AI omitted the Detailed Findings block,
    // make a follow-up call to extract just the findings
    if (findingsCount === 0 && findings.length === 0) {
      const hasFindingsTable = /\|\s*(?:🔴|🟠|🟡|🔵|💡).*[1-9]\d*\s*\|/m.test(reviewBody);
      if (hasFindingsTable) {
        console.warn(`[reviewer] ⚠️ Findings table has counts but no parseable findings — requesting findings via follow-up call`);
        try {
          const followUp = await createAiMessage(
            {
              model: reviewModel,
              maxTokens: 4096,
              messages: [
                {
                  role: "user",
                  content: `You previously wrote this code review but omitted the Detailed Findings block. The review mentioned findings in the Findings Summary table but did not include the machine-readable findings section.

Here is the review you wrote:
${reviewBody}

Now output ONLY the missing findings block. Use this EXACT format for each finding:

#### [SEVERITY_EMOJI] [SEVERITY_LABEL] — Title
- **File:** \`path/to/file.ts:L42-L58\`
- **Category:** Bug | Security | Performance | Style | Architecture | Logic Error | Race Condition
- **Description:** Clear explanation of the issue
- **Suggestion:**
\`\`\`language
// suggested fix
\`\`\`

Output ALL findings that match the counts in your Findings Summary table. Nothing else — no intro text, no summary, just the #### blocks.`,
                },
              ],
            },
            org.id,
          );

          const findingsBlock = followUp.text;

          await logAiUsage({
            provider: followUp.provider,
            model: reviewModel,
            operation: "review-findings-followup",
            inputTokens: followUp.usage.inputTokens,
            outputTokens: followUp.usage.outputTokens,
            cacheReadTokens: followUp.usage.cacheReadTokens,
            cacheWriteTokens: followUp.usage.cacheWriteTokens,
            organizationId: org.id,
          });

          const followUpFindings = parseFindings(findingsBlock);
          if (followUpFindings.length > 0) {
            findings = followUpFindings;
            // Append findings block to reviewBody so it gets stored in DB
            effectiveReviewBody = `${reviewBody}\n\n<details>\n<summary>Detailed Findings</summary>\n\n${findingsBlock}\n\n</details>`;
            console.log(`[reviewer] Follow-up recovered ${followUpFindings.length} findings (provider: ${repo.provider}, pr: #${pr.number})`);
          } else {
            console.warn(`[reviewer] Follow-up also returned no parseable findings (provider: ${repo.provider}, pr: #${pr.number})`);
          }
        } catch (err) {
          console.error("[reviewer] Follow-up findings call failed:", err);
        }
      }
    }

    // Filter out findings below confidence threshold
    const confidenceThreshold = reviewConfig.confidenceThreshold ?? "MEDIUM";
    const allFindings = findings;
    if (confidenceThreshold === "HIGH") {
      findings = findings.filter((f) => f.confidence === "HIGH");
    } else {
      // Default: filter out LOW
      findings = findings.filter((f) => f.confidence !== "LOW");
    }
    if (allFindings.length !== findings.length) {
      console.log(`[reviewer] Filtered out ${allFindings.length - findings.length} findings below confidence threshold (${confidenceThreshold})`);
    }

    // Filter out disabled categories
    if (reviewConfig.disabledCategories && reviewConfig.disabledCategories.length > 0) {
      const disabled = new Set(reviewConfig.disabledCategories.map((c) => c.toLowerCase()));
      const before = findings.length;
      findings = findings.filter((f) => !disabled.has(f.category.toLowerCase()));
      if (findings.length !== before) {
        console.log(`[reviewer] Filtered out ${before - findings.length} findings from disabled categories`);
      }
    }

    // Semantic feedback matching: suppress findings that match known false positive patterns
    try {
      await ensureFeedbackCollection();
      const findingTexts = findings.map((f) => `${f.title} ${f.description}`);
      if (findingTexts.length > 0) {
        const findingVectors = await createEmbeddings(findingTexts, {
          organizationId: org.id,
          operation: "embedding",
          repositoryId: repo.id,
        });

        const suppressedIndexes = new Set<number>();
        for (let i = 0; i < findings.length; i++) {
          const matches = await searchFeedbackPatterns(repo.id, findingVectors[i], 3, org.id);
          const falsePositiveMatch = matches.find(
            (m) => m.feedback === "down" && m.score > 0.85,
          );
          if (falsePositiveMatch) {
            suppressedIndexes.add(i);
          }
        }

        if (suppressedIndexes.size > 0) {
          findings = findings.filter((_, i) => !suppressedIndexes.has(i));
          console.log(`[reviewer] Suppressed ${suppressedIndexes.size} findings via semantic feedback matching`);
        }
      }
    } catch (err) {
      console.warn("[reviewer] Semantic feedback matching failed, continuing:", err);
    }

    // Two-pass validation: use a second LLM call to validate findings (feature flag)
    const enableTwoPass = reviewConfig.enableTwoPassReview || process.env.ENABLE_TWO_PASS_REVIEW === "true";
    if (enableTwoPass && findings.length > 0) {
      try {
        findings = await validateFindings(findings, diff, org.id, reviewModel);
      } catch (err) {
        console.warn("[reviewer] Two-pass validation failed, keeping all findings:", err);
      }
    }

    // Cap findings to top N by severity
    const maxFindings = reviewConfig.maxFindings ?? MAX_FINDINGS_PER_REVIEW;
    const { kept: cappedFindings, truncatedCount } = sortAndCapFindings(findings, maxFindings);
    findings = cappedFindings;
    if (truncatedCount > 0) {
      console.log(`[reviewer] Capped findings: showing ${findings.length} of ${findings.length + truncatedCount}`);
    }

    // Split findings: inline (above threshold) vs summary-only (below threshold)
    const inlineThreshold = reviewConfig.inlineThreshold ?? "medium";
    const inlineSeverities = inlineThreshold === "critical"
      ? ["🔴"]
      : inlineThreshold === "high"
        ? ["🔴", "🟠"]
        : ["🔴", "🟠", "🟡"]; // default: medium
    const inlineFindings = findings.filter((f) => inlineSeverities.includes(f.severity));
    const summaryOnlyFindings = findings.filter((f) => !inlineSeverities.includes(f.severity));

    const diffLines = parseDiffLines(diff);
    const inlineComments = buildInlineComments(inlineFindings, diffLines, repo.provider);

    // Append low-severity summary and truncation note to main comment if needed
    if (summaryOnlyFindings.length > 0 || truncatedCount > 0) {
      let appendix = "";
      if (truncatedCount > 0) {
        appendix += `\n\n> **Note:** Showing top ${findings.length} of ${findings.length + truncatedCount} findings, prioritized by severity.\n`;
      }
      appendix += buildLowSeveritySummary(summaryOnlyFindings);
      if (appendix) {
        // Re-update main comment with the appendix
        const updatedMainBody = mainCommentBody + appendix;
        if (reviewCommentId) {
          await providerUpdateComment(reviewCommentId, updatedMainBody);
        }
      }
    }

    // Use findings.length as the authoritative count (accounts for follow-up recovery)
    const effectiveFindingsCount = findings.length || findingsCount;

    console.log(`[reviewer] Parsed ${findings.length} findings, ${inlineComments.length} inline comments`);

    const hasCritical = findings.some((f) => f.severity === "🔴") || badFiles.length > 0;
    const hasHigh = findings.some((f) => f.severity === "🟠");
    const hasMedium = findings.some((f) => f.severity === "🟡");

    const threshold = org.checkFailureThreshold || "critical";
    const shouldRequestChanges =
      threshold !== "none" && (
        hasCritical ||
        (threshold !== "critical" && hasHigh) ||
        (threshold === "medium" && hasMedium)
      );
    const reviewEvent = shouldRequestChanges ? "REQUEST_CHANGES" : "COMMENT";

    if (isGitHub && installationId) {
      // GitHub: use the PR review API for inline comments
      if (inlineComments.length > 0) {
        const summaryLine = `${filesChanged} file${filesChanged !== 1 ? "s" : ""} reviewed, ${inlineComments.length} comment${inlineComments.length !== 1 ? "s" : ""}\n\n[Octopus Review](https://github.com/apps/octopus-review)`;
        try {
          const reviewId = await ghCreatePullRequestReview(
            installationId, owner, repoName, pr.number,
            summaryLine, reviewEvent as "COMMENT" | "REQUEST_CHANGES", inlineComments,
          );
          console.log(`[reviewer] PR review submitted with ${inlineComments.length} inline comments (${reviewEvent}), reviewId: ${reviewId}`);

          // Match GitHub review comments to ReviewIssue records by file+line
          try {
            const ghComments = await ghListReviewComments(
              installationId, owner, repoName, pr.number, reviewId,
            );
            const issueRecords = await prisma.reviewIssue.findMany({
              where: { pullRequestId: pr.id },
              select: { id: true, filePath: true, lineNumber: true },
            });

            for (const issue of issueRecords) {
              if (!issue.filePath) continue;
              const match = ghComments.find(
                (c) => c.path === issue.filePath && c.line === issue.lineNumber,
              );
              if (match) {
                await prisma.reviewIssue.update({
                  where: { id: issue.id },
                  data: { githubCommentId: BigInt(match.id) },
                });
              }
            }
            console.log(`[reviewer] Matched ${issueRecords.filter((i) => i.filePath).length} review issues to GitHub comment IDs`);
          } catch (matchErr) {
            console.error("[reviewer] Failed to match GitHub comment IDs:", matchErr);
          }
        } catch (err) {
          console.error("[reviewer] Failed to submit inline review, falling back to summary comment:", err);
          const fallbackSummary = `${filesChanged} file${filesChanged !== 1 ? "s" : ""} reviewed, ${effectiveFindingsCount} finding${effectiveFindingsCount !== 1 ? "s" : ""}\n\n[Octopus Review](https://github.com/apps/octopus-review)`;
          await ghCreatePullRequestComment(installationId, owner, repoName, pr.number, fallbackSummary);
        }
      } else {
        const summaryBody = `${filesChanged} file${filesChanged !== 1 ? "s" : ""} reviewed, ${effectiveFindingsCount} finding${effectiveFindingsCount !== 1 ? "s" : ""}\n\n[Octopus Review](https://github.com/apps/octopus-review)`;
        try {
          await ghCreatePullRequestReview(
            installationId, owner, repoName, pr.number,
            summaryBody, reviewEvent as "COMMENT" | "REQUEST_CHANGES", [],
          );
          console.log(`[reviewer] PR review submitted without inline comments (${reviewEvent})`);
        } catch (err) {
          console.error("[reviewer] Failed to submit PR review, falling back to comment:", err);
          await ghCreatePullRequestComment(installationId, owner, repoName, pr.number, summaryBody);
        }
      }
    } else if (isBitbucket) {
      // Bitbucket: post inline comments individually, then a summary comment
      for (const comment of inlineComments) {
        try {
          await bitbucket.createInlineComment(
            org.id, owner, repoName, pr.number,
            comment.path, comment.line, comment.body,
          );
        } catch (err) {
          console.error(`[reviewer] Failed to post Bitbucket inline comment on ${comment.path}:${comment.line}:`, err);
        }
      }
      const summaryBody = `${filesChanged} file${filesChanged !== 1 ? "s" : ""} reviewed, ${effectiveFindingsCount} finding${effectiveFindingsCount !== 1 ? "s" : ""}`;
      await providerCreateComment(pr.number, summaryBody);
      console.log(`[reviewer] Bitbucket review posted with ${inlineComments.length} inline comments`);
    }

    // Step 6: Persist parsed findings as ReviewIssue records (ALL findings, not just capped/inline)
    // Clear previous findings first (re-review idempotency)
    await prisma.reviewIssue.deleteMany({
      where: { pullRequestId: pr.id },
    });

    // Persist all findings (including low-severity summary-only ones) for dashboard/scoring
    const allPersistFindings = [...findings, ...summaryOnlyFindings.filter((f) => !findings.includes(f))];
    if (allPersistFindings.length > 0) {
      const severityMap: Record<string, string> = {
        "🔴": "critical",
        "🟠": "high",
        "🟡": "medium",
        "🔵": "low",
        "💡": "low",
      };

      await prisma.reviewIssue.createMany({
        data: allPersistFindings.map((f) => ({
          title: f.title.replace(/^(CRITICAL|HIGH|MEDIUM|LOW|INFO)\s*—\s*/i, "").trim(),
          description: f.description || f.category,
          severity: severityMap[f.severity] ?? "medium",
          filePath: f.filePath || null,
          lineNumber: f.startLine || null,
          confidence: f.confidence || null,
          pullRequestId: pr.id,
        })),
      });
      console.log(`[reviewer] Saved ${allPersistFindings.length} review issues to DB`);
    }

    // Step 7: Mark as completed + update check run
    await prisma.pullRequest.update({
      where: { id: pr.id },
      data: {
        status: "completed",
        reviewBody: effectiveReviewBody,
      },
    });

    if (checkRunId && isGitHub && installationId) {
      const checkShouldFail =
        threshold !== "none" && (
          hasCritical ||
          (threshold !== "critical" && hasHigh) ||
          (threshold === "medium" && hasMedium)
        );
      const conclusion = checkShouldFail ? "failure" : "success";

      const summaryText = checkShouldFail
        ? hasCritical
          ? "Critical issues found that must be fixed before merge."
          : hasHigh
            ? "High severity issues found that should be fixed before merge."
            : "Medium severity issues found that should be fixed before merge."
        : effectiveFindingsCount > 0
          ? "Review complete. No issues above the configured threshold."
          : "Review complete. No issues found.";

      await ghUpdateCheckRun(
        installationId,
        owner,
        repoName,
        checkRunId,
        conclusion,
        {
          title: `${filesChanged} file${filesChanged !== 1 ? "s" : ""} reviewed, ${effectiveFindingsCount} finding${effectiveFindingsCount !== 1 ? "s" : ""}`,
          summary: summaryText,
        },
      );
      console.log(`[reviewer] Check run updated — conclusion: ${conclusion} (threshold: ${threshold})`);
    }

    // Step 7: Store review in vector DB for timeline/search
    try {
      await ensureReviewCollection();
      const [reviewVector] = await createEmbeddings(
        [effectiveReviewBody.slice(0, 8000)],
        { organizationId: org.id, operation: "embedding", repositoryId: repo.id },
      );
      // Delete previous review point for this PR (re-review case)
      await deleteReviewChunksByPR(pr.id);
      await upsertReviewChunks([
        {
          id: crypto.randomUUID(),
          vector: reviewVector,
          payload: {
            orgId: org.id,
            repoId: repo.id,
            pullRequestId: pr.id,
            prNumber: pr.number,
            prTitle: pr.title,
            prUrl: pr.url,
            author: pr.author,
            repoFullName: repo.fullName,
            reviewDate: new Date().toISOString().split("T")[0],
            text: effectiveReviewBody,
          },
        },
      ]);
      console.log(`[reviewer] Review stored in vector DB — prId: ${pr.id}`);
    } catch (err) {
      console.error("[reviewer] Failed to store review in vector DB:", err);
    }

    // Step 8: Store diagrams in vector DB (all mermaid blocks)
    try {
      const mermaidBlocks = extractAllMermaidBlocks(reviewBody);
      if (mermaidBlocks.length > 0) {
        await ensureDiagramCollection();
        await deleteDiagramChunksByPR(pr.id);

        const descriptions = mermaidBlocks.map((block) => {
          const nodeLabels = extractNodeLabels(block.code);
          const typeLabel = DIAGRAM_TYPE_LABELS[block.type];
          return `${typeLabel} for PR #${pr.number}: ${pr.title} in ${repo.fullName} by ${pr.author}. ${nodeLabels.join(", ")}`;
        });

        const vectors = await createEmbeddings(descriptions, {
          organizationId: org.id,
          operation: "embedding",
          repositoryId: repo.id,
        });

        const reviewDate = new Date().toISOString().split("T")[0];
        for (let i = 0; i < mermaidBlocks.length; i++) {
          await upsertDiagramChunk({
            id: crypto.randomUUID(),
            vector: vectors[i],
            payload: {
              orgId: org.id,
              repoId: repo.id,
              pullRequestId: pr.id,
              prNumber: pr.number,
              prTitle: pr.title,
              repoFullName: repo.fullName,
              author: pr.author,
              mermaidCode: mermaidBlocks[i].code,
              diagramType: mermaidBlocks[i].type,
              description: descriptions[i],
              reviewDate,
            },
          });
        }
        console.log(`[reviewer] ${mermaidBlocks.length} diagram(s) stored in vector DB — prId: ${pr.id}`);
      }
    } catch (err) {
      console.error("[reviewer] Failed to store diagrams in vector DB:", err);
    }

    await emitReviewStatus(org.id, {
      ...baseEvent,
      status: "completed",
      step: "completed",
    });

    eventBus.emit({
      type: "review-completed",
      orgId: org.id,
      prNumber: pr.number,
      prTitle: pr.title,
      prUrl: pr.url,
      findingsCount: effectiveFindingsCount,
      filesChanged,
    });

    console.log(`[reviewer] Review completed for PR #${pr.number}`);
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error";
    console.error(`[reviewer] Review failed for PR #${pr.number}:`, err);

    // Update placeholder comment with error if possible
    if (reviewCommentId) {
      await providerUpdateComment(
        reviewCommentId,
        `> 🐙 **Octopus Review** encountered an error while analyzing this pull request.\n>\n> \`${errorMessage}\`\n>\n> Please try again by commenting \`@octopus\` on this PR.`,
      ).catch((e) => console.error("[reviewer] Failed to update placeholder with error:", e));
    }

    // Update check run as failed (GitHub only)
    if (checkRunId && isGitHub && installationId) {
      await ghUpdateCheckRun(
        installationId,
        owner,
        repoName,
        checkRunId,
        "failure",
        {
          title: "Review failed",
          summary: `Octopus Review encountered an error: ${errorMessage}`,
        },
      ).catch((e) => console.error("[reviewer] Failed to update check run:", e));
    }

    // If indexing was in progress, mark it as failed
    if (repo.indexStatus !== "indexed") {
      await prisma.repository.update({
        where: { id: repo.id },
        data: { indexStatus: "failed" },
      }).catch((e) => console.error("[reviewer] Failed to update repo index status:", e));

      pubby.trigger(`presence-org-${org.id}`, "index-status", {
        repoId: repo.id,
        status: "failed",
      }).catch((e) => console.error("[reviewer] Pubby index-status failed trigger failed:", e));
    }

    await prisma.pullRequest
      .update({
        where: { id: pr.id },
        data: {
          status: "failed",
          errorMessage,
        },
      })
      .catch((e) => console.error("[reviewer] Failed to update PR status:", e));

    await emitReviewStatus(org.id, {
      ...baseEvent,
      status: "failed",
      step: "failed",
      error: errorMessage,
    });

    eventBus.emit({
      type: "review-failed",
      orgId: org.id,
      prNumber: pr.number,
      prTitle: pr.title,
      error: errorMessage,
    });
  }
}
