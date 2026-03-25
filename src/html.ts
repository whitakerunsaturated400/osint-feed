import * as cheerio from "cheerio";
import type { Article, HtmlSourceConfig } from "./types.js";
import { hashUrl, resolveUrl } from "./utils.js";

const DEFAULT_UA = "osint-feed/0.1 (+https://github.com/osint-feed)";

/**
 * Scrape an HTML page using CSS selectors from config, returning normalized Article[].
 */
export const fetchHtml = async (
  source: HtmlSourceConfig,
  fetchFn: (input: string | URL | Request, init?: RequestInit) => Promise<Response> = globalThis.fetch,
  timeout = 15_000,
): Promise<Article[]> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let html: string;
  try {
    const res = await fetchFn(source.url, {
      headers: {
        "User-Agent": DEFAULT_UA,
        Accept: "text/html, application/xhtml+xml, */*",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTML fetch failed for ${source.id}: HTTP ${res.status}`);
    }
    html = await res.text();
  } finally {
    clearTimeout(timer);
  }

  const $ = cheerio.load(html);
  const { selectors } = source;
  const now = new Date();
  const articles: Article[] = [];

  $(selectors.article).each((_i, el) => {
    const $el = $(el);

    const title = $el.find(selectors.title).first().text().trim();
    if (!title) return;

    const rawHref = $el.find(selectors.link).first().attr("href")?.trim();
    if (!rawHref) return;
    const url = resolveUrl(rawHref, source.url);

    let publishedAt: Date | null = null;
    if (selectors.date) {
      const dateText = $el.find(selectors.date).first().text().trim();
      if (dateText) {
        const d = new Date(dateText);
        if (!isNaN(d.getTime())) publishedAt = d;
      }
    }

    const summary = selectors.summary
      ? $el.find(selectors.summary).first().text().trim() || null
      : null;

    articles.push({
      sourceId: source.id,
      url,
      title,
      content: null,
      summary,
      publishedAt,
      hash: hashUrl(url),
      fetchedAt: now,
      tags: [...source.tags],
    });
  });

  return articles;
};
