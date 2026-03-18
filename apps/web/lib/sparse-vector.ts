/**
 * Sparse vector generation for hybrid search (BM25-like).
 *
 * Produces { indices, values } suitable for Qdrant sparse vectors.
 * Pure TypeScript — no external dependencies.
 */

const HASH_SPACE = 1 << 18; // 262144

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall",
  "should", "may", "might", "must", "can", "could", "am", "it", "its",
  "this", "that", "these", "those", "i", "you", "he", "she", "we", "they",
  "me", "him", "her", "us", "them", "my", "your", "his", "our", "their",
  "mine", "yours", "hers", "ours", "theirs", "what", "which", "who",
  "whom", "whose", "where", "when", "why", "how", "if", "then", "else",
  "so", "but", "and", "or", "not", "no", "nor", "as", "at", "by", "for",
  "in", "of", "on", "to", "up", "with", "from", "into", "about", "after",
  "before", "between", "through", "during", "above", "below", "out", "off",
  "over", "under", "again", "further", "once", "here", "there", "all",
  "each", "every", "both", "few", "more", "most", "other", "some", "such",
  "only", "own", "same", "than", "too", "very", "just", "because",
  "while", "also", "however", "well", "still", "even", "any",
  // Code noise
  "const", "let", "var", "function", "return", "import", "export",
  "from", "default", "new", "true", "false", "null", "undefined",
  "typeof", "instanceof", "void", "class", "extends", "implements",
  "interface", "type", "enum", "async", "await", "try", "catch",
  "throw", "finally", "if", "else", "switch", "case", "break",
  "continue", "for", "while", "do", "of", "in",
]);

/**
 * FNV-1a hash → bounded integer index.
 */
function hashToken(token: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = (hash * 0x01000193) | 0; // FNV prime, keep 32-bit
  }
  return ((hash >>> 0) % HASH_SPACE);
}

/**
 * Split camelCase and snake_case, lowercase, filter stop words.
 */
function tokenize(text: string): string[] {
  // Split camelCase: "handleWebhookEvent" → "handle Webhook Event"
  const expanded = text.replace(/([a-z])([A-Z])/g, "$1 $2");

  // Split on non-alphanumeric
  const raw = expanded.toLowerCase().split(/[^a-z0-9]+/);

  return raw.filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

/**
 * Generate a sparse vector from text.
 * Returns sorted indices and log-normalized TF values.
 */
export function generateSparseVector(text: string): { indices: number[]; values: number[] } {
  const tokens = tokenize(text);

  if (tokens.length === 0) {
    return { indices: [], values: [] };
  }

  // Count term frequencies
  const tf = new Map<number, number>();
  for (const token of tokens) {
    const idx = hashToken(token);
    tf.set(idx, (tf.get(idx) ?? 0) + 1);
  }

  // Sort indices (Qdrant requires sorted sparse indices)
  const entries = Array.from(tf.entries()).sort((a, b) => a[0] - b[0]);

  return {
    indices: entries.map(([idx]) => idx),
    values: entries.map(([, count]) => 1 + Math.log(count)),
  };
}

/**
 * Batch variant for convenience.
 */
export function generateSparseVectors(texts: string[]): { indices: number[]; values: number[] }[] {
  return texts.map(generateSparseVector);
}
