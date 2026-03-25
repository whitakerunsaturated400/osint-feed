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

export type HarvesterWarningCode =
  | "empty-html-result"
  | "empty-rss-result"
  | "missing-published-at"
  | "truncated-source";

export interface HarvesterWarning {
  readonly code: HarvesterWarningCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, string | number | boolean>>;
}

export interface Article {
  readonly sourceId: string;
  readonly url: string;
  readonly title: string;
  readonly content: string | null;
  readonly summary: string | null;
  readonly publishedAt: Date | null;
  /** SHA-256 hex hash of the url — stable dedup key. */
  readonly hash: string;
  readonly fetchedAt: Date;
  readonly tags: readonly string[];
}

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

export interface DigestResult {
  readonly articles: readonly Article[];
  readonly stats: {
    readonly totalFetched: number;
    readonly afterDedup: number;
    readonly afterBudget: number;
    readonly estimatedTokens: number;
  };
}

/** Callback returning hashes already known/stored — used for dedup. */
export type KnownHashesFn = () => Promise<readonly string[]> | readonly string[];

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
  /** Maximum number of articles returned per source. Defaults to 50. */
  readonly maxItemsPerSource?: number;
  /**
   * Custom fetch function. Defaults to global fetch.
   * Useful for testing or proxying.
   */
  readonly fetch?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
  /** Optional callback for per-source fetch or parse failures. */
  readonly onError?: (error: unknown, source: SourceConfig) => void;
  /** Optional callback for non-fatal source diagnostics. */
  readonly onWarning?: (warning: HarvesterWarning, source: SourceConfig) => void;
}

export interface SchedulerCallbacks {
  readonly onArticles: (articles: readonly Article[], source: SourceConfig) => void | Promise<void>;
  readonly onError?: (error: unknown, source: SourceConfig) => void;
  readonly onWarning?: (warning: HarvesterWarning, source: SourceConfig) => void;
}

export interface Harvester {
  fetchAll(): Promise<Article[]>;
  fetch(sourceId: string): Promise<Article[]>;
  fetchByTags(tags: readonly string[]): Promise<Article[]>;
  digest(options?: DigestOptions): Promise<DigestResult>;
  start(callbacks: SchedulerCallbacks): void;
  stop(): void;
}
