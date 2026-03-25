import { describe, it, expect } from "vitest";
import { dedup, buildDigest } from "../src/digest.js";
import type { Article } from "../src/types.js";

const makeArticle = (overrides: Partial<Article> = {}): Article => ({
  sourceId: "test-source",
  url: `https://example.com/${Math.random()}`,
  title: "Default Title",
  content: null,
  summary: "Default summary text for testing purposes.",
  publishedAt: new Date("2026-03-25T10:00:00Z"),
  hash: `hash-${Math.random()}`,
  fetchedAt: new Date("2026-03-25T10:00:00Z"),
  tags: ["test"],
  ...overrides,
});

describe("dedup", () => {
  it("removes duplicate titles", () => {
    const articles = [
      makeArticle({ title: "US deploys 82nd Airborne to Middle East" }),
      makeArticle({ title: "82nd Airborne Division deploys to Middle East" }),
      makeArticle({ title: "Completely different headline about weather" }),
    ];

    const result = dedup(articles, 0.5);
    expect(result).toHaveLength(2);
  });

  it("keeps article with more content on dedup", () => {
    const articles = [
      makeArticle({ title: "NATO summit results", summary: "Short" }),
      makeArticle({ title: "NATO summit results announced", summary: "A much longer summary with more detail about the NATO summit" }),
    ];

    const result = dedup(articles, 0.5);
    expect(result).toHaveLength(1);
    expect(result[0]!.summary).toContain("much longer");
  });

  it("does not dedup different headlines", () => {
    const articles = [
      makeArticle({ title: "Poland increases defense spending" }),
      makeArticle({ title: "Russia launches new satellite" }),
    ];

    const result = dedup(articles, 0.6);
    expect(result).toHaveLength(2);
  });
});

describe("buildDigest", () => {
  it("respects maxArticlesPerTag", () => {
    const articles = Array.from({ length: 20 }, (_, i) =>
      makeArticle({
        title: `Article ${i}`,
        tags: ["poland"],
        publishedAt: new Date(Date.now() - i * 60_000),
      }),
    );

    const result = buildDigest(articles, { maxArticlesPerTag: 5 });
    expect(result.articles.length).toBeLessThanOrEqual(5);
    expect(result.stats.totalFetched).toBe(20);
  });

  it("truncates content to maxContentLength", () => {
    const longContent = "A".repeat(2000);
    const articles = [
      makeArticle({ title: "Test", content: longContent }),
    ];

    const result = buildDigest(articles, { maxContentLength: 100 });
    expect(result.articles[0]!.content!.length).toBeLessThanOrEqual(103); // 100 + "..."
  });

  it("sorts by recency (newest first)", () => {
    const articles = [
      makeArticle({ title: "Old", publishedAt: new Date("2026-01-01") }),
      makeArticle({ title: "New", publishedAt: new Date("2026-03-25") }),
      makeArticle({ title: "Mid", publishedAt: new Date("2026-02-15") }),
    ];

    const result = buildDigest(articles, { sort: "recency" });
    expect(result.articles[0]!.title).toBe("New");
    expect(result.articles[2]!.title).toBe("Old");
  });

  it("respects maxTokens budget", () => {
    const articles = Array.from({ length: 50 }, (_, i) =>
      makeArticle({
        title: `Unique headline number ${i} about something`,
        summary: "Some summary text here that adds a few more tokens to the count.",
        tags: [`tag-${i % 5}`],
      }),
    );

    const result = buildDigest(articles, {
      maxTokens: 500,
      maxArticlesPerTag: 50,
    });
    expect(result.stats.estimatedTokens).toBeLessThanOrEqual(550); // small buffer
  });

  it("returns correct stats", () => {
    const articles = [
      makeArticle({ title: "US deploys troops to Gulf" }),
      makeArticle({ title: "US military deploys troops to Gulf region" }),
      makeArticle({ title: "Weather forecast sunny" }),
    ];

    const result = buildDigest(articles, { similarityThreshold: 0.5 });
    expect(result.stats.totalFetched).toBe(3);
    expect(result.stats.afterDedup).toBe(2);
  });
});
