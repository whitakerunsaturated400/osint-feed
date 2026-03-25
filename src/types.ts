/**
 * Configuration for a single news source.
 */
export interface RssSourceConfig {
  readonly id: string;
  readonly name: string;
  readonly type: "rss";
  readonly url: string;
  readonly tags: readonly string[];
  /** Minutes between checks. Defaults to 15. */
  readonly interval?: number;
  /** Whether this source is active. Defaults to true. */
  readonly enabled?: boolean;
}

/**
 * CSS selectors used to extract article data from an HTML page.
 */
export interface HtmlSelectors {
  /** Selector for the repeating article container element. */
  readonly article: string;
  /** Selector (within article) for the title text. */
  readonly title: string;
  /** Selector (within article) for the link href. */
  readonly link: string;
  /** Selector (within article) for the publication date. */
  readonly date?: string;
  /** Selector (within article) for summary/description text. */
  readonly summary?: string;
}

export interface HtmlSourceConfig {
  readonly id: string;
  readonly name: string;
  readonly type: "html";
  readonly url: string;
  readonly tags: readonly string[];
  readonly selectors: HtmlSelectors;
  /** Minutes between checks. Defaults to 15. */
  readonly interval?: number;
  /** Whether this source is active. Defaults to true. */
  readonly enabled?: boolean;
}

export type SourceConfig = RssSourceConfig | HtmlSourceConfig;

/**
 * A single article returned by the harvester.
 */
export interface Article {
  /** The source id that produced this article. */
  readonly sourceId: string;
  /** Canonical URL of the article. */
  readonly url: string;
  /** Article title. */
  readonly title: string;
  /** Full article content when available. */
  readonly content: string | null;
  /** Short summary / description. */
  readonly summary: string | null;
  /** Publication date when available. */
  readonly publishedAt: Date | null;
  /** SHA-256 hex hash of the url — stable dedup key. */
  readonly hash: string;
  /** Timestamp when the article was fetched. */
  readonly fetchedAt: Date;
  /** Tags inherited from the source config. */
  readonly tags: readonly string[];
}

/**
 * Options for the digest method.
 */
export interface DigestOptions {
  /** Approximate upper bound of tokens in the output. Defaults to 12000. */
  readonly maxTokens?: number;
  /** Maximum articles per tag group. Defaults to 10. */
  readonly maxArticlesPerTag?: number;
  /** Maximum character length of content/summary per article. Defaults to 500. */
  readonly maxContentLength?: number;
  /** Sort strategy. Defaults to "recency". */
  readonly sort?: "recency" | "relevance";
  /**
   * Jaccard similarity threshold (0–1) for title dedup.
   * Titles more similar than this are considered duplicates.
   * Defaults to 0.6.
   */
  readonly similarityThreshold?: number;
}

/**
 * Result returned by harvester.digest().
 */
export interface DigestResult {
  readonly articles: readonly Article[];
  readonly stats: {
    readonly totalFetched: number;
    readonly afterDedup: number;
    readonly afterBudget: number;
    readonly estimatedTokens: number;
  };
}

/**
 * Callback for known hashes — user provides this from their DB for dedup.
 */
export type KnownHashesFn = () => Promise<readonly string[]> | readonly string[];

/**
 * Options passed to createHarvester.
 */
export interface HarvesterOptions {
  readonly sources: readonly SourceConfig[];
  /** Dedup configuration. */
  readonly dedup?: {
    /** Callback returning hashes already known/stored. */
    readonly known?: KnownHashesFn;
  };
  /** Default digest options. Can be overridden per call. */
  readonly digest?: DigestOptions;
  /**
   * Request timeout in milliseconds. Defaults to 15000.
   */
  readonly requestTimeout?: number;
  /**
   * Minimum gap between HTTP requests in milliseconds. Defaults to 1000.
   */
  readonly requestGap?: number;
  /**
   * Custom fetch function. Defaults to global fetch.
   * Useful for testing or proxying.
   */
  readonly fetch?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
}

/**
 * Callbacks for the scheduler.
 */
export interface SchedulerCallbacks {
  readonly onArticles: (articles: readonly Article[], source: SourceConfig) => void | Promise<void>;
  readonly onError?: (error: unknown, source: SourceConfig) => void;
}

/**
 * The public harvester interface returned by createHarvester.
 */
export interface Harvester {
  /** Fetch articles from all enabled sources. */
  fetchAll(): Promise<Article[]>;
  /** Fetch articles from a single source by id. */
  fetch(sourceId: string): Promise<Article[]>;
  /** Fetch articles from sources matching any of the given tags. */
  fetchByTags(tags: readonly string[]): Promise<Article[]>;
  /** Fetch and produce an LLM-ready digest. */
  digest(options?: DigestOptions): Promise<DigestResult>;
  /** Start the scheduler — polls sources at their configured intervals. */
  start(callbacks: SchedulerCallbacks): void;
  /** Stop the scheduler. */
  stop(): void;
}
