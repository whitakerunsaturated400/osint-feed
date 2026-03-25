import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { Article, HarvesterWarning, HtmlSourceConfig } from "./types.js";
import { hashUrl, normalizeText, resolveUrl } from "./utils.js";

/**
 * Many government / military sites block non-browser user agents, so we default
 * to a real-looking UA.  Consumers can override via HarvesterOptions.fetch.
 */
const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface FetchHtmlOptions {
  readonly fetchFn?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
  readonly timeout?: number;
  readonly maxItems?: number;
  readonly onWarning?: (warning: HarvesterWarning) => void;
}

const parsePublishedAt = ($el: cheerio.Cheerio<AnyNode>, selector?: string): Date | null => {
  if (!selector) return null;

  const dateEl = $el.find(selector).first();
  const candidates = [
    dateEl.attr("datetime"),
    dateEl.attr("content"),
    dateEl.text(),
  ];

  for (const candidate of candidates) {
    const raw = normalizeText(candidate ?? "");
    if (!raw) continue;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
};

export const parseHtml = (
  html: string,
  source: HtmlSourceConfig,
  fetchedAt = new Date(),
  maxItems = Number.POSITIVE_INFINITY,
): Article[] => {
  const $ = cheerio.load(html);
  const { selectors } = source;
  const articles: Article[] = [];

  $(selectors.article).each((_i, el) => {
    if (articles.length >= maxItems) return false;

    const $el = $(el);
    const title = normalizeText($el.find(selectors.title).first().text());
    if (!title) return;

    const rawHref = normalizeText($el.find(selectors.link).first().attr("href") ?? "");
    if (!rawHref) return;

    const url = resolveUrl(rawHref, source.url);
    const publishedAt = parsePublishedAt($el, selectors.date);
    const summary = selectors.summary
      ? normalizeText($el.find(selectors.summary).first().text()) || null
      : null;

    articles.push({
      sourceId: source.id,
      url,
      title,
      content: null,
      summary,
      publishedAt,
      hash: hashUrl(url),
      fetchedAt,
      tags: [...source.tags],
    });

    return undefined;
  });

  return articles;
};

export const fetchHtml = async (
  source: HtmlSourceConfig,
  options: FetchHtmlOptions = {},
): Promise<Article[]> => {
  const {
    fetchFn = globalThis.fetch,
    timeout = 15_000,
    maxItems = Number.POSITIVE_INFINITY,
    onWarning,
  } = options;
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

  const totalMatches = cheerio.load(html)(source.selectors.article).length;
  const articles = parseHtml(html, source, new Date(), maxItems);

  if (articles.length === 0) {
    onWarning?.({
      code: "empty-html-result",
      message: `HTML source '${source.id}' returned zero articles`,
    });
  }

  if (articles.some((article) => article.publishedAt === null)) {
    const missingDates = articles.filter((article) => article.publishedAt === null).length;
    onWarning?.({
      code: "missing-published-at",
      message: `HTML source '${source.id}' returned articles without publication dates`,
      details: { missingDates, totalArticles: articles.length },
    });
  }

  if (Number.isFinite(maxItems) && totalMatches > maxItems) {
    onWarning?.({
      code: "truncated-source",
      message: `HTML source '${source.id}' was truncated to ${maxItems} articles`,
      details: { maxItems, totalMatches },
    });
  }

  return articles;
};
