/**
 * Backfill script: Scan existing PRs with reviewBody, extract ALL mermaid diagrams,
 * and store them in Qdrant's flowchart_chunks collection with diagramType.
 *
 * Usage: bun run --cwd apps/web scripts/backfill-flowcharts.ts
 */

import crypto from "node:crypto";
import { prisma } from "@octopus/db";
import { extractAllMermaidBlocks, extractNodeLabels, DIAGRAM_TYPE_LABELS } from "@/lib/mermaid-utils";
import {
  ensureDiagramCollection,
  upsertDiagramChunk,
  deleteDiagramChunksByPR,
} from "@/lib/qdrant";
import { createEmbeddings } from "@/lib/embeddings";

async function main() {
  console.log("[backfill] Starting diagram backfill...\n");

  // Find all PRs with a reviewBody
  const prs = await prisma.pullRequest.findMany({
    where: {
      reviewBody: { not: null },
      status: "completed",
    },
    select: {
      id: true,
      number: true,
      title: true,
      author: true,
      reviewBody: true,
      repository: {
        select: {
          id: true,
          fullName: true,
          organization: {
            select: { id: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`[backfill] Found ${prs.length} completed PRs with reviewBody\n`);

  let storedDiagrams = 0;
  let skipped = 0;

  // Ensure collection exists (+ diagramType index)
  await ensureDiagramCollection();
  console.log("[backfill] Diagram collection ready\n");

  for (const pr of prs) {
    const blocks = extractAllMermaidBlocks(pr.reviewBody);

    if (blocks.length === 0) {
      skipped++;
      continue;
    }

    const orgId = pr.repository.organization.id;
    const repoId = pr.repository.id;
    const repoFullName = pr.repository.fullName;

    console.log(`[backfill] PR #${pr.number}: ${pr.title} — ${blocks.length} diagram(s)`);
    console.log(`           Repo: ${repoFullName}`);

    try {
      // Build descriptions for all blocks
      const descriptions = blocks.map((block) => {
        const nodeLabels = extractNodeLabels(block.code);
        const typeLabel = DIAGRAM_TYPE_LABELS[block.type];
        return `${typeLabel} for PR #${pr.number}: ${pr.title} in ${repoFullName} by ${pr.author}. ${nodeLabels.join(", ")}`;
      });

      // Batch embed all descriptions
      const vectors = await createEmbeddings(descriptions, {
        organizationId: orgId,
        operation: "embedding",
      });

      // Clean up any existing diagrams for this PR
      await deleteDiagramChunksByPR(pr.id);

      const reviewDate = new Date().toISOString().split("T")[0];
      for (let i = 0; i < blocks.length; i++) {
        await upsertDiagramChunk({
          id: crypto.randomUUID(),
          vector: vectors[i],
          payload: {
            orgId,
            repoId,
            pullRequestId: pr.id,
            prNumber: pr.number,
            prTitle: pr.title,
            repoFullName,
            author: pr.author,
            mermaidCode: blocks[i].code,
            diagramType: blocks[i].type,
            description: descriptions[i],
            reviewDate,
          },
        });
        storedDiagrams++;
      }
      console.log(`           -> Stored ${blocks.length} diagram(s) [${blocks.map((b) => b.type).join(", ")}]\n`);
    } catch (err) {
      console.error(`           -> FAILED:`, err instanceof Error ? err.message : err, "\n");
    }
  }

  console.log(`\n[backfill] Done!`);
  console.log(`  Diagrams stored: ${storedDiagrams}`);
  console.log(`  Skipped (no mermaid): ${skipped}`);
  console.log(`  Total PRs scanned: ${prs.length}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[backfill] Fatal error:", err);
  process.exit(1);
});
