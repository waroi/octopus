import crypto from "node:crypto";
import { createEmbeddings } from "@/lib/embeddings";
import {
  ensureKnowledgeCollection,
  upsertKnowledgeChunks,
} from "@/lib/qdrant";
import { generateSparseVectors } from "@/lib/sparse-vector";

const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

function chunkByParagraphs(
  content: string,
  title: string,
): { text: string }[] {
  const paragraphs = content.split(/\n\n+/);
  const chunks: { text: string }[] = [];

  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if (
      currentChunk.length + paragraph.length + 2 > CHUNK_SIZE &&
      currentChunk.length > 0
    ) {
      chunks.push({ text: `[Knowledge: ${title}]\n${currentChunk}` });

      // Overlap: keep the tail of the previous chunk
      const tail = currentChunk.slice(-CHUNK_OVERLAP);
      currentChunk = tail + "\n\n" + paragraph;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({ text: `[Knowledge: ${title}]\n${currentChunk}` });
  }

  return chunks;
}

export interface KnowledgeIndexResult {
  totalChunks: number;
  totalVectors: number;
  durationMs: number;
}

export async function indexKnowledgeDocument(
  documentId: string,
  orgId: string,
  title: string,
  content: string,
): Promise<KnowledgeIndexResult> {
  const startTime = Date.now();

  const chunks = chunkByParagraphs(content, title);

  if (chunks.length === 0) {
    return { totalChunks: 0, totalVectors: 0, durationMs: Date.now() - startTime };
  }

  await ensureKnowledgeCollection();

  const texts = chunks.map((c) => c.text);
  const vectors = await createEmbeddings(texts);
  const sparseVectors = generateSparseVectors(texts);

  const points = chunks.map((chunk, i) => ({
    id: crypto.randomUUID(),
    vector: vectors[i],
    sparseVector: sparseVectors[i],
    payload: {
      orgId,
      documentId,
      title,
      text: chunk.text,
    },
  }));

  await upsertKnowledgeChunks(points);

  return {
    totalChunks: chunks.length,
    totalVectors: points.length,
    durationMs: Date.now() - startTime,
  };
}
