import { describe, expect, it, vi } from "vitest";
import { fetchRss } from "../src/rss.js";
import type { HarvesterWarning, RssSourceConfig } from "../src/types.js";

const source: RssSourceConfig = {
  id: "rss-source",
  name: "RSS Source",
  type: "rss",
  url: "https://example.com/feed.xml",
  tags: ["rss"],
};

const xml = `
  <rss version="2.0">
    <channel>
      <title>Feed</title>
      <item>
        <title>  First   item </title>
        <link>https://example.com/story-1</link>
        <pubDate>Tue, 25 Mar 2026 12:00:00 GMT</pubDate>
        <description>  Summary   one </description>
      </item>
      <item>
        <title>Second item</title>
        <link>https://example.com/story-2</link>
        <description>Summary two</description>
      </item>
    </channel>
  </rss>
`;

describe("fetchRss", () => {
  it("parses feed items through injected fetch", async () => {
    const fetchFn = vi.fn(async () => new Response(xml, { status: 200 }));
    const articles = await fetchRss(source, { fetchFn });

    expect(fetchFn).toHaveBeenCalledOnce();
    expect(articles).toHaveLength(2);
    expect(articles[0]).toMatchObject({
      title: "First item",
      summary: "Summary one",
      url: "https://example.com/story-1",
    });
    expect(articles[0]!.publishedAt?.toISOString()).toBe("2026-03-25T12:00:00.000Z");
  });

  it("emits warnings for missing dates and truncation", async () => {
    const warnings: HarvesterWarning[] = [];

    const articles = await fetchRss(source, {
      fetchFn: async () => new Response(xml, { status: 200 }),
      maxItems: 1,
      onWarning: (warning) => warnings.push(warning),
    });

    expect(articles).toHaveLength(1);
    expect(warnings.some((warning) => warning.code === "truncated-source")).toBe(true);
  });

  it("throws on http errors", async () => {
    await expect(fetchRss(source, {
      fetchFn: async () => new Response("", { status: 503 }),
    })).rejects.toThrow("RSS fetch failed for rss-source: HTTP 503");
  });
});
