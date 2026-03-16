import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import {
  resolveConfigFromEnv,
  queryOctopusBeforeCoding,
  formatPreCodingContext,
  type PreCodingContext,
  type OctopusConfig,
} from "../index.js";

describe("resolveConfigFromEnv", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env["OCTOPUS_API_URL"] = "https://api.octopus.test";
    process.env["OCTOPUS_API_KEY"] = "test-key-123";
    process.env["OCTOPUS_REPO"] = "test-org/test-repo";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("resolves config from environment variables", () => {
    const config = resolveConfigFromEnv();
    expect(config.apiUrl).toBe("https://api.octopus.test");
    expect(config.apiKey).toBe("test-key-123");
    expect(config.repo).toBe("test-org/test-repo");
  });

  it("applies overrides over environment variables", () => {
    const config = resolveConfigFromEnv({ repo: "override-org/override-repo" });
    expect(config.repo).toBe("override-org/override-repo");
    expect(config.apiUrl).toBe("https://api.octopus.test");
  });

  it("throws when OCTOPUS_API_URL is missing", () => {
    delete process.env["OCTOPUS_API_URL"];
    expect(() => resolveConfigFromEnv()).toThrow("OCTOPUS_API_URL is required");
  });

  it("throws when OCTOPUS_API_KEY is missing", () => {
    delete process.env["OCTOPUS_API_KEY"];
    expect(() => resolveConfigFromEnv()).toThrow("OCTOPUS_API_KEY is required");
  });

  it("throws when OCTOPUS_REPO is missing", () => {
    delete process.env["OCTOPUS_REPO"];
    expect(() => resolveConfigFromEnv()).toThrow("OCTOPUS_REPO is required");
  });
});

describe("formatPreCodingContext", () => {
  it("formats a complete context with conventions and query", () => {
    const context: PreCodingContext = {
      task: "Add pagination to signals endpoint",
      repo: "Art-of-Technology/octopus",
      conventions: {
        conventions: "Use cursor-based pagination for all list endpoints.",
        patterns: ["Prisma findMany with take/skip", "Zod validation on inputs"],
      },
      query: "Relevant patterns found in apps/web/app/api/signals/route.ts",
      errors: [],
    };

    const formatted = formatPreCodingContext(context);
    expect(formatted).toContain("## Octopus Pre-Coding Context");
    expect(formatted).toContain("Add pagination to signals endpoint");
    expect(formatted).toContain("cursor-based pagination");
    expect(formatted).toContain("Prisma findMany with take/skip");
    expect(formatted).toContain("Relevant patterns found");
    expect(formatted).not.toContain("Warnings");
  });

  it("includes warnings when errors are present", () => {
    const context: PreCodingContext = {
      task: "Test task",
      repo: "test/repo",
      conventions: null,
      query: null,
      errors: ["Conventions fetch failed: timeout"],
    };

    const formatted = formatPreCodingContext(context);
    expect(formatted).toContain("### Warnings");
    expect(formatted).toContain("Conventions fetch failed: timeout");
  });

  it("handles context with no conventions or query", () => {
    const context: PreCodingContext = {
      task: "Test task",
      repo: "test/repo",
      conventions: null,
      query: null,
      errors: [],
    };

    const formatted = formatPreCodingContext(context);
    expect(formatted).toContain("## Octopus Pre-Coding Context");
    expect(formatted).toContain("Test task");
    expect(formatted).not.toContain("### Coding Conventions");
    expect(formatted).not.toContain("### Relevant Codebase Context");
  });
});
