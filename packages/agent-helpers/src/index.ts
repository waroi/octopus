import { z } from "zod";

const REQUEST_TIMEOUT_MS = 30_000;

const OctopusConfigSchema = z.object({
  apiUrl: z.string().url(),
  apiKey: z.string().min(1),
  repo: z.string().min(1),
});

/**
 * Configuration for connecting to the Octopus API.
 */
export type OctopusConfig = z.infer<typeof OctopusConfigSchema>;

/**
 * Response from the Octopus API.
 */
export interface OctopusResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

/**
 * Conventions detected for a repository.
 */
export interface ConventionsResult {
  conventions: string;
  patterns: ReadonlyArray<string>;
}

/**
 * Context information for a specific file.
 */
export interface FileContextResult {
  file: string;
  summary: string;
  related: ReadonlyArray<string>;
}

/**
 * Combined pre-coding context returned by queryOctopusBeforeCoding.
 */
export interface PreCodingContext {
  task: string;
  repo: string;
  conventions: ConventionsResult | null;
  query: unknown | null;
  errors: ReadonlyArray<string>;
}

/**
 * Resolve Octopus configuration from environment variables.
 * Reads OCTOPUS_API_URL, OCTOPUS_API_KEY, and OCTOPUS_REPO.
 * @param overrides - Optional overrides for any config field
 * @returns Resolved configuration
 * @throws Error if required environment variables are missing
 */
export function resolveConfigFromEnv(overrides?: Partial<OctopusConfig>): OctopusConfig {
  const apiUrl = overrides?.apiUrl ?? process.env["OCTOPUS_API_URL"];
  const apiKey = overrides?.apiKey ?? process.env["OCTOPUS_API_KEY"];
  const repo = overrides?.repo ?? process.env["OCTOPUS_REPO"];

  if (!apiUrl) {
    throw new Error(
      "OCTOPUS_API_URL is required. Set the environment variable or pass apiUrl in overrides."
    );
  }
  if (!apiKey) {
    throw new Error(
      "OCTOPUS_API_KEY is required. Set the environment variable or pass apiKey in overrides."
    );
  }
  if (!repo) {
    throw new Error(
      "OCTOPUS_REPO is required. Set the environment variable or pass repo in overrides."
    );
  }

  return OctopusConfigSchema.parse({ apiUrl, apiKey, repo });
}

/**
 * Make an authenticated request to the Octopus API.
 * @param config - Octopus API configuration
 * @param path - API endpoint path
 * @param body - Request body
 * @returns Parsed API response
 */
export async function octopusRequest<T = unknown>(
  config: OctopusConfig,
  path: string,
  body: Record<string, unknown>
): Promise<OctopusResponse<T>> {
  const url = `${config.apiUrl.replace(/\/$/, "")}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unknown error");
      return { ok: false, error: `API returned ${String(response.status)}: ${errorBody}` };
    }

    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: `Request timed out after ${String(REQUEST_TIMEOUT_MS)}ms` };
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, error: `Request failed: ${message}` };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch coding conventions for a repository from Octopus.
 * @param config - Octopus API configuration
 * @returns Conventions result or null on failure
 */
export async function fetchConventions(
  config: OctopusConfig
): Promise<OctopusResponse<ConventionsResult>> {
  return octopusRequest<ConventionsResult>(config, "/api/conventions", { repo: config.repo });
}

/**
 * Query the Octopus API with a natural language question about the codebase.
 * @param config - Octopus API configuration
 * @param question - Natural language question
 * @returns Query response
 */
export async function queryCodebase<T = unknown>(
  config: OctopusConfig,
  question: string
): Promise<OctopusResponse<T>> {
  return octopusRequest<T>(config, "/api/query", { query: question, repo: config.repo });
}

/**
 * Get context information for a specific file in the codebase.
 * @param config - Octopus API configuration
 * @param filePath - Path to the file
 * @returns File context response
 */
export async function fetchFileContext(
  config: OctopusConfig,
  filePath: string
): Promise<OctopusResponse<FileContextResult>> {
  return octopusRequest<FileContextResult>(config, "/api/context", {
    file: filePath,
    repo: config.repo,
  });
}

/**
 * Find files similar to a given file in the codebase.
 * @param config - Octopus API configuration
 * @param filePath - Path to the reference file
 * @returns Similar files response
 */
export async function fetchSimilarFiles<T = unknown>(
  config: OctopusConfig,
  filePath: string
): Promise<OctopusResponse<T>> {
  return octopusRequest<T>(config, "/api/similar", { file: filePath, repo: config.repo });
}

/**
 * Query Octopus for relevant patterns and conventions before writing code.
 * This is the primary integration point for AI agents. It fetches both
 * conventions and task-specific context in parallel.
 *
 * @param task - Description of the coding task to perform
 * @param repo - Repository slug (org/repo), overrides env/config
 * @param configOverrides - Optional API config overrides
 * @returns Combined pre-coding context with conventions and task-relevant info
 *
 * @example
 * ```typescript
 * const context = await queryOctopusBeforeCoding(
 *   "Add pagination to the signals list endpoint",
 *   "Art-of-Technology/octopus"
 * );
 *
 * // Use context.conventions for coding style
 * // Use context.query for task-specific patterns
 * ```
 */
export async function queryOctopusBeforeCoding(
  task: string,
  repo: string,
  configOverrides?: Partial<Omit<OctopusConfig, "repo">>
): Promise<PreCodingContext> {
  const config = resolveConfigFromEnv({ ...configOverrides, repo });
  const errors: string[] = [];

  const [conventionsResult, queryResult] = await Promise.allSettled([
    fetchConventions(config),
    queryCodebase(config, `What patterns, conventions, and existing code are relevant for: ${task}`),
  ]);

  let conventions: ConventionsResult | null = null;
  if (conventionsResult.status === "fulfilled" && conventionsResult.value.ok) {
    conventions = conventionsResult.value.data ?? null;
  } else {
    const reason =
      conventionsResult.status === "rejected"
        ? String(conventionsResult.reason)
        : conventionsResult.value.error ?? "Unknown error";
    errors.push(`Conventions fetch failed: ${reason}`);
  }

  let query: unknown | null = null;
  if (queryResult.status === "fulfilled" && queryResult.value.ok) {
    query = queryResult.value.data ?? null;
  } else {
    const reason =
      queryResult.status === "rejected"
        ? String(queryResult.reason)
        : queryResult.value.error ?? "Unknown error";
    errors.push(`Query fetch failed: ${reason}`);
  }

  return { task, repo, conventions, query, errors };
}

/**
 * Format pre-coding context as a readable string for injection into agent prompts.
 * @param context - Pre-coding context from queryOctopusBeforeCoding
 * @returns Formatted string suitable for agent system prompts
 */
export function formatPreCodingContext(context: PreCodingContext): string {
  const sections: string[] = [];

  sections.push(`## Octopus Pre-Coding Context`);
  sections.push(`**Task:** ${context.task}`);
  sections.push(`**Repository:** ${context.repo}`);

  if (context.conventions) {
    sections.push("");
    sections.push("### Coding Conventions");
    sections.push(context.conventions.conventions);
    if (context.conventions.patterns.length > 0) {
      sections.push("");
      sections.push("**Key Patterns:**");
      for (const pattern of context.conventions.patterns) {
        sections.push(`- ${pattern}`);
      }
    }
  }

  if (context.query) {
    sections.push("");
    sections.push("### Relevant Codebase Context");
    sections.push(
      typeof context.query === "string" ? context.query : JSON.stringify(context.query, null, 2)
    );
  }

  if (context.errors.length > 0) {
    sections.push("");
    sections.push("### Warnings");
    for (const error of context.errors) {
      sections.push(`- ⚠️ ${error}`);
    }
  }

  return sections.join("\n");
}
