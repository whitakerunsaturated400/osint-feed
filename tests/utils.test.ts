import { describe, it, expect } from "vitest";
import { jaccardSimilarity, estimateTokens, truncate, hashUrl, resolveUrl, ThrottleQueue } from "../src/utils.js";

describe("hashUrl", () => {
  it("returns consistent sha256 hex", () => {
    const h1 = hashUrl("https://example.com/article-1");
    const h2 = hashUrl("https://example.com/article-1");
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it("returns different hashes for different urls", () => {
    const h1 = hashUrl("https://example.com/article-1");
    const h2 = hashUrl("https://example.com/article-2");
    expect(h1).not.toBe(h2);
  });
});

describe("jaccardSimilarity", () => {
  it("returns 1 for identical strings", () => {
    expect(jaccardSimilarity("hello world", "hello world")).toBe(1);
  });

  it("returns 0 for completely different strings", () => {
    expect(jaccardSimilarity("hello world", "foo bar baz")).toBe(0);
  });

  it("returns value between 0 and 1 for partial overlap", () => {
    const sim = jaccardSimilarity(
      "US deploys 82nd Airborne to Middle East",
      "82nd Airborne Division ordered to deploy to Middle East region",
    );
    expect(sim).toBeGreaterThan(0.3);
    expect(sim).toBeLessThan(1);
  });

  it("detects similar news headlines", () => {
    const sim = jaccardSimilarity(
      "NATO condemns Russian missile strikes on Ukraine",
      "Russia launches missile strikes against Ukraine NATO responds",
    );
    expect(sim).toBeGreaterThan(0.3);
  });

  it("returns 1 for two empty strings", () => {
    expect(jaccardSimilarity("", "")).toBe(1);
  });

  it("returns 0 when one string is empty", () => {
    expect(jaccardSimilarity("hello", "")).toBe(0);
  });
});

describe("estimateTokens", () => {
  it("estimates roughly 1 token per 4 chars", () => {
    const text = "This is a test string with some words in it.";
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBe(Math.ceil(text.length / 4));
  });

  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });
});

describe("truncate", () => {
  it("returns original if under limit", () => {
    expect(truncate("short", 100)).toBe("short");
  });

  it("truncates at word boundary", () => {
    const result = truncate("hello beautiful world", 15);
    // "hello beautiful" is 15 chars, fits; word boundary cut at last space before limit
    expect(result).toBe("hello beautiful...");
  });

  it("adds ellipsis", () => {
    const result = truncate("a".repeat(200), 50);
    expect(result).toContain("...");
    // The base part before "..." should be <= 50
    expect(result.length).toBeLessThanOrEqual(53); // 50 + "..."
  });
});

describe("resolveUrl", () => {
  it("resolves relative URL", () => {
    expect(resolveUrl("/news/article-1", "https://example.com")).toBe(
      "https://example.com/news/article-1",
    );
  });

  it("returns absolute URL as-is", () => {
    expect(resolveUrl("https://other.com/page", "https://example.com")).toBe(
      "https://other.com/page",
    );
  });

  it("returns href on invalid input", () => {
    expect(resolveUrl("not a url", "also not a url")).toBe("not a url");
  });
});

describe("ThrottleQueue", () => {
  it("enforces minimum gap between calls", async () => {
    const queue = new ThrottleQueue(100);
    const times: number[] = [];

    await queue.run(async () => { times.push(Date.now()); });
    await queue.run(async () => { times.push(Date.now()); });

    expect(times).toHaveLength(2);
    const gap = times[1]! - times[0]!;
    expect(gap).toBeGreaterThanOrEqual(90); // allow small jitter
  });
});
