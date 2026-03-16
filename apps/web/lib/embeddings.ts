import "server-only";
import OpenAI from "openai";
import { logAiUsage } from "@/lib/ai-usage";
import { getEmbedModel } from "@/lib/ai-client";
import { isOrgOverSpendLimit } from "@/lib/cost";

let openai: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  return openai;
}

// text-embedding-3-large max: 8191 tokens
// Conservative limit: ~3 chars/token for code → 24000 chars stays safely under 8191 tokens
const MAX_EMBEDDING_CHARS = 24_000;

export async function createEmbeddings(
  texts: string[],
  tracking?: { organizationId: string; operation: string; repositoryId?: string },
): Promise<number[][]> {
  if (tracking?.organizationId && await isOrgOverSpendLimit(tracking.organizationId)) {
    console.warn(`[embeddings] Org ${tracking.organizationId} over spend limit — skipping embeddings`);
    return texts.map(() => []);
  }

  const client = getClient();
  const embedModel = tracking?.organizationId
    ? await getEmbedModel(tracking.organizationId, tracking.repositoryId)
    : "text-embedding-3-large";

  // OpenAI allows max 2048 inputs per request
  const vectors: number[][] = [];
  let totalPromptTokens = 0;

  for (let i = 0; i < texts.length; i += 512) {
    const batch = texts
      .slice(i, i + 512)
      .map((t) => (t.length > MAX_EMBEDDING_CHARS ? t.slice(0, MAX_EMBEDDING_CHARS) : t));
    const res = await client.embeddings.create({
      model: embedModel,
      input: batch,
    });
    for (const item of res.data) {
      vectors.push(item.embedding);
    }
    totalPromptTokens += res.usage.prompt_tokens;
  }

  if (tracking) {
    await logAiUsage({
      provider: "openai",
      model: embedModel,
      operation: tracking.operation,
      inputTokens: totalPromptTokens,
      outputTokens: 0,
      organizationId: tracking.organizationId,
    });
  }

  return vectors;
}
