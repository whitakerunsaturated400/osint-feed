import type {
  Article,
  DigestOptions,
  DigestResult,
  Harvester,
  HarvesterOptions,
  SchedulerCallbacks,
  SourceConfig,
} from "./types.js";
import { fetchRss } from "./rss.js";
import { fetchHtml } from "./html.js";
import { buildDigest } from "./digest.js";
import { createScheduler } from "./scheduler.js";
import { ThrottleQueue } from "./utils.js";

/**
 * Fetch articles from a single source (RSS or HTML).
 */
const fetchSource = async (
  source: SourceConfig,
  throttle: ThrottleQueue,
  fetchFn?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
  timeout?: number,
): Promise<Article[]> => {
  return throttle.run(async () => {
    if (source.type === "rss") {
      return fetchRss(source, fetchFn);
    }
    return fetchHtml(source, fetchFn ?? globalThis.fetch, timeout);
  });
};

/**
 * Filter out articles whose hashes are already known.
 */
const filterKnown = async (
  articles: Article[],
  knownFn?: () => Promise<readonly string[]> | readonly string[],
): Promise<Article[]> => {
  if (!knownFn) return articles;
  const known = new Set(await knownFn());
  return articles.filter((a) => !known.has(a.hash));
};

/**
 * Create a configured harvester instance.
 */
export const createHarvester = (options: HarvesterOptions): Harvester => {
  const {
    sources,
    dedup: dedupOpts,
    digest: defaultDigestOpts,
    requestTimeout = 15_000,
    requestGap = 1_000,
  } = options;

  const fetchFn = options.fetch;
  const throttle = new ThrottleQueue(requestGap);

  let scheduler: { stop: () => void } | null = null;

  const getEnabledSources = (): SourceConfig[] =>
    sources.filter((s) => s.enabled !== false);

  const fetchSingle = async (source: SourceConfig): Promise<Article[]> => {
    const articles = await fetchSource(source, throttle, fetchFn, requestTimeout);
    return filterKnown(articles, dedupOpts?.known);
  };

  const fetchMany = async (selectedSources: readonly SourceConfig[]): Promise<Article[]> => {
    const results: Article[] = [];
    for (const source of selectedSources) {
      try {
        const articles = await fetchSingle(source);
        results.push(...articles);
      } catch {
        // Silently skip failed sources — consumer can use scheduler's onError for logging
      }
    }
    return results;
  };

  return {
    async fetchAll(): Promise<Article[]> {
      return fetchMany(getEnabledSources());
    },

    async fetch(sourceId: string): Promise<Article[]> {
      const source = sources.find((s) => s.id === sourceId);
      if (!source) {
        throw new Error(`Source not found: ${sourceId}`);
      }
      return fetchSingle(source);
    },

    async fetchByTags(tags: readonly string[]): Promise<Article[]> {
      const tagSet = new Set(tags);
      const matching = getEnabledSources().filter((s) =>
        s.tags.some((t) => tagSet.has(t)),
      );
      return fetchMany(matching);
    },

    async digest(overrides?: DigestOptions): Promise<DigestResult> {
      const articles = await fetchMany(getEnabledSources());
      const opts = { ...defaultDigestOpts, ...overrides };
      const result = buildDigest(articles, opts);
      return {
        articles: result.articles,
        stats: result.stats,
      };
    },

    start(callbacks: SchedulerCallbacks): void {
      if (scheduler) {
        scheduler.stop();
      }
      scheduler = createScheduler(
        getEnabledSources(),
        (source) => fetchSingle(source),
        callbacks,
      );
    },

    stop(): void {
      scheduler?.stop();
      scheduler = null;
    },
  };
};
