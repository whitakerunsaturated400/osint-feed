import { describe, expect, it, vi } from "vitest";
import { fetchHtml, parseHtml } from "../src/html.js";
import type { HarvesterWarning, HtmlSourceConfig } from "../src/types.js";

const source: HtmlSourceConfig = {
  id: "html-source",
  name: "HTML Source",
  type: "html",
  url: "https://example.com/news",
  tags: ["test"],
  selectors: {
    article: "article",
    title: "h2 a",
    link: "h2 a",
    date: "time",
    summary: "p.summary",
  },
};

const html = `
  <main>
    <article>
      <h2><a href="/story-1">  First   story  </a></h2>
      <time datetime="2026-03-25T12:00:00Z">March 25, 2026</time>
      <p class="summary">  Summary   one </p>
    </article>
    <article>
      <h2><a href="https://example.com/story-2">Second story</a></h2>
      <time>2026-03-24T10:30:00Z</time>
      <p class="summary">Summary two</p>
    </article>
  </main>
`;

describe("parseHtml", () => {
  it("parses normalized article data", () => {
    const articles = parseHtml(html, source, new Date("2026-03-25T13:00:00Z"));

    expect(articles).toHaveLength(2);
    expect(articles[0]).toMatchObject({
      title: "First story",
      url: "https://example.com/story-1",
      summary: "Summary one",
      sourceId: "html-source",
    });
    expect(articles[0]!.publishedAt?.toISOString()).toBe("2026-03-25T12:00:00.000Z");
    expect(articles[1]!.publishedAt?.toISOString()).toBe("2026-03-24T10:30:00.000Z");
  });

  it("respects maxItems limit", () => {
    const articles = parseHtml(html, source, new Date("2026-03-25T13:00:00Z"), 1);
    expect(articles).toHaveLength(1);
    expect(articles[0]!.title).toBe("First story");
  });
});

describe("fetchHtml", () => {
  it("emits warnings for empty results and truncation", async () => {
    const warnings: HarvesterWarning[] = [];
    const fetchFn = vi.fn(async () => new Response(html, { status: 200 }));

    const articles = await fetchHtml(source, {
      fetchFn,
      maxItems: 1,
      onWarning: (warning) => warnings.push(warning),
    });

    expect(articles).toHaveLength(1);
    expect(warnings.some((warning) => warning.code === "truncated-source")).toBe(true);
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("warns when selectors match nothing", async () => {
    const warnings: HarvesterWarning[] = [];

    await fetchHtml(
      { ...source, selectors: { ...source.selectors, article: ".missing" } },
      {
        fetchFn: async () => new Response(html, { status: 200 }),
        onWarning: (warning) => warnings.push(warning),
      },
    );

    expect(warnings).toContainEqual(
      expect.objectContaining({ code: "empty-html-result" }),
    );
  });
});
