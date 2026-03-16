export type DiagramType = "flowchart" | "sequence" | "er" | "state";

export interface MermaidBlock {
  code: string;
  type: DiagramType;
}

export const DIAGRAM_TYPE_LABELS: Record<DiagramType, string> = {
  flowchart: "Flowchart",
  sequence: "Sequence",
  er: "ER Diagram",
  state: "State",
};

/**
 * Detect diagram type from the first meaningful line of mermaid code.
 */
export function detectDiagramType(code: string): DiagramType {
  const firstLine = code.trimStart().split("\n")[0].trim().toLowerCase();
  if (firstLine.startsWith("sequencediagram")) return "sequence";
  if (firstLine.startsWith("erdiagram")) return "er";
  if (firstLine.startsWith("statediagram")) return "state";
  return "flowchart";
}

/**
 * Extract ALL mermaid code blocks from a text string with type detection.
 */
export function extractAllMermaidBlocks(text: string | null | undefined): MermaidBlock[] {
  if (!text) return [];
  const blocks: MermaidBlock[] = [];
  const regex = /```mermaid\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const code = match[1].trim();
    if (code) {
      blocks.push({ code, type: detectDiagramType(code) });
    }
  }
  return blocks;
}

/**
 * Extract the first mermaid code block from a text string (backward compat).
 * Returns the raw mermaid code (without the fences) or null if not found.
 */
export function extractMermaidCode(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(/```mermaid\n([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

/**
 * Extract human-readable node labels from mermaid code.
 * Looks for quoted strings and bracket-enclosed labels that contain
 * meaningful text for semantic search (e.g. "LoginComponent", "AuthService").
 */
export function extractNodeLabels(mermaidCode: string): string[] {
  const labels = new Set<string>();

  // Match quoted strings: "Label" or 'Label'
  for (const match of mermaidCode.matchAll(/["']([^"']+)["']/g)) {
    const label = match[1].trim();
    if (label.length > 1 && !/^[\s\->=|]+$/.test(label)) {
      labels.add(label);
    }
  }

  // Match bracket-enclosed labels: [Label], (Label), {Label}, ([Label])
  for (const match of mermaidCode.matchAll(/[\[({]([^\[\](){}|]+)[\])}]/g)) {
    const label = match[1].trim();
    if (label.length > 1 && !/^[\s\->=|]+$/.test(label) && !label.startsWith("```")) {
      labels.add(label);
    }
  }

  return Array.from(labels);
}
