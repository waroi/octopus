const adjectives = [
  "bold", "calm", "cool", "dark", "deep", "fair", "fast", "fine",
  "free", "glad", "good", "keen", "kind", "lean", "live", "neat",
  "nice", "open", "pure", "rare", "rich", "safe", "slim", "soft",
  "sure", "tall", "tiny", "true", "warm", "wide", "wild", "wise",
];

const animals = [
  "ant", "bat", "bee", "cat", "cow", "dog", "elk", "emu",
  "fox", "gnu", "hen", "jay", "koi", "owl", "pig", "ram",
  "ray", "yak", "ape", "cod", "cub", "doe", "eel", "fly",
  "kit", "newt", "puma", "seal", "swan", "toad", "wasp", "wren",
];

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Converts a name to a base slug: lowercase, alphanumeric + hyphens only.
 */
export function toBaseSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Generates a random adjective-animal suffix (e.g. "bold-fox", "calm-owl").
 */
export function randomSlugSuffix(): string {
  return `${randomPick(adjectives)}-${randomPick(animals)}`;
}
