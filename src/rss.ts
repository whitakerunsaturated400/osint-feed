import RssParser from "rss-parser";
import type { Article, HarvesterWarning, RssSourceConfig } from "./types.js";
import { hashUrl, normalizeText } from "./utils.js";

const DEFAULT_UA = "osint-feed/0.1 (+https://github.com/osint-feed)";

const createRssParser = (): RssParser => new RssParser();

interface FetchRssOptions {
  readonly fetchFn?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
  readonly timeout?: number;
  readonly maxItems?: number;
  readonly onWarning?: (warning: HarvesterWarning) => void;
}

export const fetchRss = async (
  source: RssSourceConfig,
  options: FetchRssOptions = {},
): Promise<Article[]> => {
  const now = new Date();
  const {
    fetchFn = globalThis.fetch,
    timeout = 15_000,
    maxItems = Number.POSITIVE_INFINITY,
    onWarning,
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetchFn(source.url, {
      headers: {
        "User-Agent": DEFAULT_UA,
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`RSS fetch failed for ${source.id}: HTTP ${res.status}`);
    }

    const xml = await res.text();
    const feed = await createRssParser().parseString(xml);
    const totalItems = feed.items.length;
    const articles = feedToArticles(feed, source, now, maxItems);

    if (articles.length === 0) {
      onWarning?.({
        code: "empty-rss-result",
        message: `RSS source '${source.id}' returned zero articles`,
      });
    }

    if (articles.some((article) => article.publishedAt === null)) {
      const missingDates = articles.filter((article) => article.publishedAt === null).length;
      onWarning?.({
        code: "missing-published-at",
        message: `RSS source '${source.id}' returned articles without publication dates`,
        details: { missingDates, totalArticles: articles.length },
      });
    }

    if (Number.isFinite(maxItems) && totalItems > maxItems) {
      onWarning?.({
        code: "truncated-source",
        message: `RSS source '${source.id}' was truncated to ${maxItems} articles`,
        details: { maxItems, totalItems },
      });
    }

    return articles;
  } finally {
    clearTimeout(timer);
  }
};

const feedToArticles = (
  feed: RssParser.Output<Record<string, unknown>>,
  source: RssSourceConfig,
  fetchedAt: Date,
  maxItems: number,
): Article[] => {
  const articles: Article[] = [];

  for (const item of feed.items) {
    if (articles.length >= maxItems) break;

    const url = item.link?.trim();
    if (!url) continue;

    const title = normalizeText(item.title ?? "");
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
      content: typeof content === "string" ? normalizeText(content) : null,
      summary: typeof summary === "string" ? normalizeText(summary) : null,
      publishedAt,
      hash: hashUrl(url),
      fetchedAt,
      tags: [...source.tags],
    });
  }

  return articles;
};
