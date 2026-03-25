import { describe, expect, it, vi } from "vitest";
import { createHarvester } from "../src/harvester.js";
import type { HarvesterWarning, SourceConfig } from "../src/types.js";

const sources: SourceConfig[] = [
  {
    id: "rss-source",
    name: "RSS Source",
    type: "rss",
    url: "https://example.com/feed.xml",
    tags: ["rss"],
  },
  {
    id: "html-source",
    name: "HTML Source",
    type: "html",
    url: "https://example.com/news",
    tags: ["html"],
    selectors: {
      article: "article",
      title: "h2 a",
      link: "h2 a",
      date: "time",
    },
  },
];

const rssXml = `
  <rss version="2.0">
    <channel>
      <title>Feed</title>
      <item>
        <title>Item one</title>
        <link>https://example.com/story-1</link>
        <pubDate>Tue, 25 Mar 2026 12:00:00 GMT</pubDate>
      </item>
      <item>
        <title>Item two</title>
        <link>https://example.com/story-1b</link>
        <pubDate>Tue, 25 Mar 2026 12:05:00 GMT</pubDate>
      </item>
    </channel>
  </rss>
`;

const html = `
  <article>
    <h2><a href="/story-2">Story two</a></h2>
    <time datetime="2026-03-24T10:30:00Z">2026-03-24</time>
  </article>
`;

describe("createHarvester", () => {
  it("fetchAll returns partial success and reports errors", async () => {
    const onError = vi.fn();
    const harvester = createHarvester({
      sources,
      onError,
      fetch: async (input) => {
        const url = String(input);
        if (url.endsWith("feed.xml")) {
          return new Response(rssXml, { status: 200 });
        }
        return new Response("boom", { status: 500 });
      },
    });

    const articles = await harvester.fetchAll();

    expect(articles).toHaveLength(2);
    expect(onError).toHaveBeenCalledOnce();
  });

  it("fetch throws for a broken single source", async () => {
    const harvester = createHarvester({
      sources,
      fetch: async () => new Response("boom", { status: 500 }),
    });

    await expect(harvester.fetch("rss-source")).rejects.toThrow(
      "RSS fetch failed for rss-source: HTTP 500",
    );
  });

  it("forwards warnings from source fetchers", async () => {
    const warnings: HarvesterWarning[] = [];
    const harvester = createHarvester({
      sources,
      maxItemsPerSource: 1,
      onWarning: (warning) => warnings.push(warning),
      fetch: async (input) => {
        const url = String(input);
        if (url.endsWith("feed.xml")) {
          return new Response(rssXml, { status: 200 });
        }
        return new Response(html, { status: 200 });
      },
    });

    await harvester.fetchAll();

    expect(warnings.length).toBeGreaterThan(0);
  });

  it("digest still works when one source fails", async () => {
    const harvester = createHarvester({
      sources,
      fetch: async (input) => {
        const url = String(input);
        if (url.endsWith("feed.xml")) {
          return new Response(rssXml, { status: 200 });
        }
        return new Response(html, { status: 200 });
      },
    });

    const result = await harvester.digest();

    expect(result.articles.length).toBeGreaterThan(0);
    expect(result.stats.totalFetched).toBe(3);
  });
});
