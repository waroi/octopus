import { QdrantClient } from "@qdrant/js-client-rest";

const COLLECTION_NAME = "code_chunks";
const VECTOR_SIZE = 3072; // text-embedding-3-large

let client: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (!client) {
    client = new QdrantClient({
      url: process.env.QDRANT_URL!,
    });
  }
  return client;
}

export async function ensureCollection() {
  const qdrant = getQdrantClient();
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some(
    (c) => c.name === COLLECTION_NAME,
  );

  if (!exists) {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: { size: VECTOR_SIZE, distance: "Cosine" },
    });
    await qdrant.createPayloadIndex(COLLECTION_NAME, {
      field_name: "repoId",
      field_schema: "keyword",
    });
  }
}

export async function upsertChunks(
  points: {
    id: string;
    vector: number[];
    payload: Record<string, unknown>;
  }[],
) {
  const qdrant = getQdrantClient();
  // Qdrant accepts max 100 points per request
  for (let i = 0; i < points.length; i += 100) {
    await qdrant.upsert(COLLECTION_NAME, {
      points: points.slice(i, i + 100),
    });
  }
}

export async function deleteRepoChunks(repoId: string) {
  const qdrant = getQdrantClient();
  await qdrant.delete(COLLECTION_NAME, {
    filter: {
      must: [{ key: "repoId", match: { value: repoId } }],
    },
  });
}

export async function getRepoChunks(
  repoId: string,
  limit = 50,
): Promise<string[]> {
  const qdrant = getQdrantClient();
  const result = await qdrant.scroll(COLLECTION_NAME, {
    filter: {
      must: [{ key: "repoId", match: { value: repoId } }],
    },
    limit,
    with_payload: true,
    with_vector: false,
  });

  return result.points
    .map((p) => (p.payload?.text as string) ?? "")
    .filter(Boolean);
}

export async function searchSimilarChunks(
  repoId: string,
  queryVector: number[],
  limit = 20,
): Promise<{ filePath: string; text: string; startLine: number; endLine: number; score: number }[]> {
  const qdrant = getQdrantClient();
  const result = await qdrant.search(COLLECTION_NAME, {
    vector: queryVector,
    filter: {
      must: [{ key: "repoId", match: { value: repoId } }],
    },
    limit,
    with_payload: true,
  });

  return result.map((point) => ({
    filePath: (point.payload?.filePath as string) ?? "",
    text: (point.payload?.text as string) ?? "",
    startLine: (point.payload?.startLine as number) ?? 0,
    endLine: (point.payload?.endLine as number) ?? 0,
    score: point.score,
  }));
}

export async function searchCodeChunksAcrossRepos(
  repoIds: string[],
  queryVector: number[],
  limit = 20,
): Promise<{ filePath: string; text: string; startLine: number; endLine: number; repoId: string; score: number }[]> {
  if (repoIds.length === 0) return [];
  const qdrant = getQdrantClient();
  const result = await qdrant.search(COLLECTION_NAME, {
    vector: queryVector,
    filter: {
      should: repoIds.map((id) => ({
        key: "repoId",
        match: { value: id },
      })),
    },
    limit,
    with_payload: true,
  });

  return result.map((point) => ({
    filePath: (point.payload?.filePath as string) ?? "",
    text: (point.payload?.text as string) ?? "",
    startLine: (point.payload?.startLine as number) ?? 0,
    endLine: (point.payload?.endLine as number) ?? 0,
    repoId: (point.payload?.repoId as string) ?? "",
    score: point.score,
  }));
}

export { COLLECTION_NAME };

// --- Knowledge Chunks ---

const KNOWLEDGE_COLLECTION_NAME = "knowledge_chunks";

export async function ensureKnowledgeCollection() {
  const qdrant = getQdrantClient();
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some(
    (c) => c.name === KNOWLEDGE_COLLECTION_NAME,
  );

  if (!exists) {
    await qdrant.createCollection(KNOWLEDGE_COLLECTION_NAME, {
      vectors: { size: VECTOR_SIZE, distance: "Cosine" },
    });
    await qdrant.createPayloadIndex(KNOWLEDGE_COLLECTION_NAME, {
      field_name: "orgId",
      field_schema: "keyword",
    });
    await qdrant.createPayloadIndex(KNOWLEDGE_COLLECTION_NAME, {
      field_name: "documentId",
      field_schema: "keyword",
    });
  }
}

export async function upsertKnowledgeChunks(
  points: {
    id: string;
    vector: number[];
    payload: Record<string, unknown>;
  }[],
) {
  const qdrant = getQdrantClient();
  for (let i = 0; i < points.length; i += 100) {
    await qdrant.upsert(KNOWLEDGE_COLLECTION_NAME, {
      points: points.slice(i, i + 100),
    });
  }
}

export async function deleteKnowledgeDocumentChunks(documentId: string) {
  const qdrant = getQdrantClient();
  await qdrant.delete(KNOWLEDGE_COLLECTION_NAME, {
    filter: {
      must: [{ key: "documentId", match: { value: documentId } }],
    },
  });
}

export async function searchKnowledgeChunks(
  orgId: string,
  queryVector: number[],
  limit = 10,
): Promise<{ title: string; text: string; score: number }[]> {
  const qdrant = getQdrantClient();
  const result = await qdrant.search(KNOWLEDGE_COLLECTION_NAME, {
    vector: queryVector,
    filter: {
      must: [{ key: "orgId", match: { value: orgId } }],
    },
    limit,
    with_payload: true,
  });

  return result.map((point) => ({
    title: (point.payload?.title as string) ?? "",
    text: (point.payload?.text as string) ?? "",
    score: point.score,
  }));
}

export async function getKnowledgeChunksByOrg(
  orgId: string,
  limit = 20,
): Promise<string[]> {
  const qdrant = getQdrantClient();
  try {
    const result = await qdrant.scroll(KNOWLEDGE_COLLECTION_NAME, {
      filter: {
        must: [{ key: "orgId", match: { value: orgId } }],
      },
      limit,
      with_payload: true,
      with_vector: false,
    });

    return result.points
      .map((p) => (p.payload?.text as string) ?? "")
      .filter(Boolean);
  } catch {
    // Collection doesn't exist yet — no knowledge docs uploaded
    return [];
  }
}

export { KNOWLEDGE_COLLECTION_NAME };

// --- Review Chunks ---

const REVIEW_COLLECTION_NAME = "review_chunks";

export async function ensureReviewCollection() {
  const qdrant = getQdrantClient();
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some(
    (c) => c.name === REVIEW_COLLECTION_NAME,
  );

  if (!exists) {
    await qdrant.createCollection(REVIEW_COLLECTION_NAME, {
      vectors: { size: VECTOR_SIZE, distance: "Cosine" },
    });
    await qdrant.createPayloadIndex(REVIEW_COLLECTION_NAME, {
      field_name: "orgId",
      field_schema: "keyword",
    });
    await qdrant.createPayloadIndex(REVIEW_COLLECTION_NAME, {
      field_name: "repoId",
      field_schema: "keyword",
    });
    await qdrant.createPayloadIndex(REVIEW_COLLECTION_NAME, {
      field_name: "pullRequestId",
      field_schema: "keyword",
    });
  }
}

export async function upsertReviewChunks(
  points: {
    id: string;
    vector: number[];
    payload: Record<string, unknown>;
  }[],
) {
  const qdrant = getQdrantClient();
  for (let i = 0; i < points.length; i += 100) {
    await qdrant.upsert(REVIEW_COLLECTION_NAME, {
      points: points.slice(i, i + 100),
    });
  }
}

export async function deleteReviewChunksByPR(pullRequestId: string) {
  const qdrant = getQdrantClient();
  await qdrant.delete(REVIEW_COLLECTION_NAME, {
    filter: {
      must: [{ key: "pullRequestId", match: { value: pullRequestId } }],
    },
  });
}

export async function searchReviewChunks(
  orgId: string,
  queryVector: number[],
  limit = 10,
): Promise<{ text: string; prTitle: string; prNumber: number; repoFullName: string; author: string; reviewDate: string; score: number }[]> {
  const qdrant = getQdrantClient();
  const result = await qdrant.search(REVIEW_COLLECTION_NAME, {
    vector: queryVector,
    filter: {
      must: [{ key: "orgId", match: { value: orgId } }],
    },
    limit,
    with_payload: true,
  });

  return result.map((point) => ({
    text: (point.payload?.text as string) ?? "",
    prTitle: (point.payload?.prTitle as string) ?? "",
    prNumber: (point.payload?.prNumber as number) ?? 0,
    repoFullName: (point.payload?.repoFullName as string) ?? "",
    author: (point.payload?.author as string) ?? "",
    reviewDate: (point.payload?.reviewDate as string) ?? "",
    score: point.score,
  }));
}

export { REVIEW_COLLECTION_NAME };

// --- Chat Chunks ---

const CHAT_COLLECTION_NAME = "chat_chunks";

export async function ensureChatCollection() {
  const qdrant = getQdrantClient();
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some(
    (c) => c.name === CHAT_COLLECTION_NAME,
  );

  if (!exists) {
    await qdrant.createCollection(CHAT_COLLECTION_NAME, {
      vectors: { size: VECTOR_SIZE, distance: "Cosine" },
    });
    await qdrant.createPayloadIndex(CHAT_COLLECTION_NAME, {
      field_name: "orgId",
      field_schema: "keyword",
    });
    await qdrant.createPayloadIndex(CHAT_COLLECTION_NAME, {
      field_name: "conversationId",
      field_schema: "keyword",
    });
    await qdrant.createPayloadIndex(CHAT_COLLECTION_NAME, {
      field_name: "userId",
      field_schema: "keyword",
    });
  }
}

export async function upsertChatChunk(point: {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}) {
  const qdrant = getQdrantClient();
  await qdrant.upsert(CHAT_COLLECTION_NAME, { points: [point] });
}

export async function searchChatChunks(
  orgId: string,
  queryVector: number[],
  limit = 5,
  excludeConversationId?: string,
): Promise<{ question: string; answer: string; conversationId: string; conversationTitle: string; score: number }[]> {
  const qdrant = getQdrantClient();
  try {
    const filter: Record<string, unknown> = {
      must: [{ key: "orgId", match: { value: orgId } }],
    };
    if (excludeConversationId) {
      (filter as { must_not?: unknown[] }).must_not = [
        { key: "conversationId", match: { value: excludeConversationId } },
      ];
    }
    const result = await qdrant.search(CHAT_COLLECTION_NAME, {
      vector: queryVector,
      filter,
      limit,
      with_payload: true,
    });

    return result.map((point) => ({
      question: (point.payload?.question as string) ?? "",
      answer: (point.payload?.answer as string) ?? "",
      conversationId: (point.payload?.conversationId as string) ?? "",
      conversationTitle: (point.payload?.conversationTitle as string) ?? "",
      score: point.score,
    }));
  } catch {
    return [];
  }
}

export async function deleteChatChunksByConversation(conversationId: string) {
  const qdrant = getQdrantClient();
  await qdrant.delete(CHAT_COLLECTION_NAME, {
    filter: {
      must: [{ key: "conversationId", match: { value: conversationId } }],
    },
  });
}

export { CHAT_COLLECTION_NAME };

// --- Diagram Chunks (collection name kept as flowchart_chunks to avoid migration) ---

const DIAGRAM_COLLECTION_NAME = "flowchart_chunks";

export async function ensureDiagramCollection() {
  const qdrant = getQdrantClient();
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some(
    (c) => c.name === DIAGRAM_COLLECTION_NAME,
  );

  if (!exists) {
    await qdrant.createCollection(DIAGRAM_COLLECTION_NAME, {
      vectors: { size: VECTOR_SIZE, distance: "Cosine" },
    });
    await qdrant.createPayloadIndex(DIAGRAM_COLLECTION_NAME, {
      field_name: "orgId",
      field_schema: "keyword",
    });
    await qdrant.createPayloadIndex(DIAGRAM_COLLECTION_NAME, {
      field_name: "repoId",
      field_schema: "keyword",
    });
    await qdrant.createPayloadIndex(DIAGRAM_COLLECTION_NAME, {
      field_name: "pullRequestId",
      field_schema: "keyword",
    });
  }

  // Add diagramType index (safe for existing collections)
  try {
    await qdrant.createPayloadIndex(DIAGRAM_COLLECTION_NAME, {
      field_name: "diagramType",
      field_schema: "keyword",
    });
  } catch {
    // Index may already exist
  }
}

export async function upsertDiagramChunk(point: {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}) {
  const qdrant = getQdrantClient();
  await qdrant.upsert(DIAGRAM_COLLECTION_NAME, { points: [point] });
}

export async function deleteDiagramChunksByPR(pullRequestId: string) {
  const qdrant = getQdrantClient();
  await qdrant.delete(DIAGRAM_COLLECTION_NAME, {
    filter: {
      must: [{ key: "pullRequestId", match: { value: pullRequestId } }],
    },
  });
}

export async function searchDiagramChunks(
  orgId: string,
  queryVector: number[],
  limit = 3,
): Promise<{ mermaidCode: string; diagramType: string; prTitle: string; prNumber: number; repoFullName: string; author: string; reviewDate: string; score: number }[]> {
  const qdrant = getQdrantClient();
  try {
    const result = await qdrant.search(DIAGRAM_COLLECTION_NAME, {
      vector: queryVector,
      filter: {
        must: [{ key: "orgId", match: { value: orgId } }],
      },
      limit,
      with_payload: true,
    });

    return result.map((point) => ({
      mermaidCode: (point.payload?.mermaidCode as string) ?? "",
      diagramType: (point.payload?.diagramType as string) ?? "flowchart",
      prTitle: (point.payload?.prTitle as string) ?? "",
      prNumber: (point.payload?.prNumber as number) ?? 0,
      repoFullName: (point.payload?.repoFullName as string) ?? "",
      author: (point.payload?.author as string) ?? "",
      reviewDate: (point.payload?.reviewDate as string) ?? "",
      score: point.score,
    }));
  } catch {
    return [];
  }
}

export { DIAGRAM_COLLECTION_NAME };

// --- Feedback Patterns ---

const FEEDBACK_COLLECTION_NAME = "feedback_patterns";

export async function ensureFeedbackCollection() {
  const qdrant = getQdrantClient();
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some(
    (c) => c.name === FEEDBACK_COLLECTION_NAME,
  );

  if (!exists) {
    await qdrant.createCollection(FEEDBACK_COLLECTION_NAME, {
      vectors: { size: VECTOR_SIZE, distance: "Cosine" },
    });
    await qdrant.createPayloadIndex(FEEDBACK_COLLECTION_NAME, {
      field_name: "repoId",
      field_schema: "keyword",
    });
    await qdrant.createPayloadIndex(FEEDBACK_COLLECTION_NAME, {
      field_name: "orgId",
      field_schema: "keyword",
    });
    await qdrant.createPayloadIndex(FEEDBACK_COLLECTION_NAME, {
      field_name: "feedback",
      field_schema: "keyword",
    });
  }
}

export async function upsertFeedbackPattern(point: {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}) {
  const qdrant = getQdrantClient();
  await qdrant.upsert(FEEDBACK_COLLECTION_NAME, { points: [point] });
}

export async function searchFeedbackPatterns(
  repoId: string,
  queryVector: number[],
  limit = 5,
  orgId?: string,
): Promise<{ title: string; description: string; feedback: string; repoId: string; score: number }[]> {
  const qdrant = getQdrantClient();
  try {
    // Search repo-scoped patterns first
    const filter: Record<string, unknown> = orgId
      ? {
          should: [
            { key: "repoId", match: { value: repoId } },
            { key: "orgId", match: { value: orgId } },
          ],
        }
      : {
          must: [{ key: "repoId", match: { value: repoId } }],
        };

    const result = await qdrant.search(FEEDBACK_COLLECTION_NAME, {
      vector: queryVector,
      filter,
      limit,
      with_payload: true,
    });

    return result.map((point) => ({
      title: (point.payload?.title as string) ?? "",
      description: (point.payload?.description as string) ?? "",
      feedback: (point.payload?.feedback as string) ?? "",
      repoId: (point.payload?.repoId as string) ?? "",
      score: point.score,
    }));
  } catch {
    return [];
  }
}

export { FEEDBACK_COLLECTION_NAME };
