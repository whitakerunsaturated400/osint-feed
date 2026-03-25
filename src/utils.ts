import { createHash } from "node:crypto";

/**
 * SHA-256 hex hash of a string — used for article dedup by URL.
 */
export const hashUrl = (url: string): string =>
  createHash("sha256").update(url).digest("hex");

/**
 * Tokenize a string into a set of lowercased words.
 */
const tokenize = (text: string): Set<string> => {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F\u0400-\u04FF]+/gi, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 1);
  return new Set(words);
};

/**
 * Jaccard similarity between two strings (0–1).
 * Used for title-based dedup.
 */
export const jaccardSimilarity = (a: string, b: string): number => {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

/**
 * Rough token count estimate. ~4 chars per token for English, slightly more for
 * non-Latin scripts. Good enough for budget estimation without a tokenizer dep.
 */
export const estimateTokens = (text: string): number =>
  Math.ceil(text.length / 4);

/**
 * Truncate a string to maxLength characters, breaking at a word boundary.
 */
export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  const cut = text.lastIndexOf(" ", maxLength);
  return (cut > 0 ? text.slice(0, cut) : text.slice(0, maxLength)) + "...";
};

/**
 * Simple throttle queue — ensures minimum gap between async operations.
 */
export class ThrottleQueue {
  private lastRun = 0;

  constructor(private readonly gapMs: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const wait = Math.max(0, this.gapMs - (now - this.lastRun));
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    this.lastRun = Date.now();
    return fn();
  }
}

/**
 * Resolve a potentially relative URL against a base URL.
 */
export const resolveUrl = (href: string, base: string): string => {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
};
