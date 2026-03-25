import RssParser from "rss-parser";
import type { Article, RssSourceConfig } from "./types.js";
import { hashUrl } from "./utils.js";

const parser = new RssParser({
  timeout: 15_000,
  headers: {
    "User-Agent": "osint-feed/0.1 (+https://github.com/osint-feed)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});

/**
 * Fetch and parse an RSS/Atom feed, returning normalized Article[].
 */
export const fetchRss = async (
  source: RssSourceConfig,
  fetchFn?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
): Promise<Article[]> => {
  const now = new Date();

  if (fetchFn) {
    // Use custom fetch — allows proxies, testing, etc.
    const res = await fetchFn(source.url, {
      headers: {
        "User-Agent": "osint-feed/0.1 (+https://github.com/osint-feed)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });
    if (!res.ok) {
      throw new Error(`RSS fetch failed for ${source.id}: HTTP ${res.status}`);
    }
    const xml = await res.text();
    const feed = await parser.parseString(xml);
    return feedToArticles(feed, source, now);
  }

  const feed = await parser.parseURL(source.url);
  return feedToArticles(feed, source, now);
};

const feedToArticles = (
  feed: RssParser.Output<Record<string, unknown>>,
  source: RssSourceConfig,
  fetchedAt: Date,
): Article[] => {
  const articles: Article[] = [];

  for (const item of feed.items) {
    const url = item.link?.trim();
    if (!url) continue;

    const title = item.title?.trim() ?? "";
    if (!title) continue;

    const content = item["content:encoded"] as string | undefined
      ?? item.content
      ?? null;

    const summary = item.contentSnippet
      ?? item.summary
      ?? null;

    let publishedAt: Date | null = null;
    if (item.isoDate) {
      const d = new Date(item.isoDate);
      if (!isNaN(d.getTime())) publishedAt = d;
    } else if (item.pubDate) {
      const d = new Date(item.pubDate);
      if (!isNaN(d.getTime())) publishedAt = d;
    }

    articles.push({
      sourceId: source.id,
      url,
      title,
      content: typeof content === "string" ? content : null,
      summary: typeof summary === "string" ? summary : null,
      publishedAt,
      hash: hashUrl(url),
      fetchedAt,
      tags: [...source.tags],
    });
  }

  return articles;
};
