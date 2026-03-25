import type { Article, DigestOptions } from "./types.js";
import { estimateTokens, jaccardSimilarity, truncate } from "./utils.js";

const DEFAULT_DIGEST: Required<DigestOptions> = {
  maxTokens: 12_000,
  maxArticlesPerTag: 10,
  maxContentLength: 500,
  sort: "recency",
  similarityThreshold: 0.6,
};

/**
 * Deduplicate articles by title similarity.
 * When two articles are similar above the threshold, the one with more content wins.
 */
export const dedup = (
  articles: readonly Article[],
  threshold: number,
): Article[] => {
  const kept: Article[] = [];

  for (const article of articles) {
    const isDuplicate = kept.some(
      (existing) => jaccardSimilarity(existing.title, article.title) >= threshold,
    );
    if (!isDuplicate) {
      kept.push({ ...article });
    } else {
      // If the new article has more content, replace the existing one
      const existingIdx = kept.findIndex(
        (existing) => jaccardSimilarity(existing.title, article.title) >= threshold,
      );
      if (existingIdx !== -1) {
        const existing = kept[existingIdx]!;
        const existingLen = (existing.content?.length ?? 0) + (existing.summary?.length ?? 0);
        const newLen = (article.content?.length ?? 0) + (article.summary?.length ?? 0);
        if (newLen > existingLen) {
          kept[existingIdx] = { ...article };
        }
      }
    }
  }

  return kept;
};

/**
 * Apply tag-based budget limits — keep at most N articles per tag group.
 */
const applyTagBudget = (
  articles: Article[],
  maxPerTag: number,
): Article[] => {
  const tagCounts = new Map<string, number>();
  const result: Article[] = [];

  for (const article of articles) {
    // An article passes if at least one of its tags hasn't exceeded budget
    const tags = article.tags.length > 0 ? article.tags : ["_untagged"];
    let allowed = false;

    for (const tag of tags) {
      const count = tagCounts.get(tag) ?? 0;
      if (count < maxPerTag) {
        allowed = true;
      }
    }

    if (allowed) {
      result.push(article);
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
  }

  return result;
};

/**
 * Truncate article content/summary to fit within character limits.
 */
const truncateArticles = (
  articles: Article[],
  maxContentLength: number,
): Article[] =>
  articles.map((a) => ({
    ...a,
    content: a.content ? truncate(a.content, maxContentLength) : null,
    summary: a.summary ? truncate(a.summary, maxContentLength) : null,
  }));

/**
 * Sort articles by the chosen strategy.
 */
const sortArticles = (
  articles: Article[],
  sort: "recency" | "relevance",
): Article[] => {
  if (sort === "recency") {
    return [...articles].sort((a, b) => {
      const dateA = a.publishedAt?.getTime() ?? a.fetchedAt.getTime();
      const dateB = b.publishedAt?.getTime() ?? b.fetchedAt.getTime();
      return dateB - dateA; // newest first
    });
  }
  // "relevance" — for now same as recency; could weight by content length / source priority later
  return [...articles].sort((a, b) => {
    const dateA = a.publishedAt?.getTime() ?? a.fetchedAt.getTime();
    const dateB = b.publishedAt?.getTime() ?? b.fetchedAt.getTime();
    return dateB - dateA;
  });
};

/**
 * Apply token budget — trim articles from the end until we're under budget.
 */
const applyTokenBudget = (
  articles: Article[],
  maxTokens: number,
): Article[] => {
  let totalTokens = 0;
  const result: Article[] = [];

  for (const article of articles) {
    const text = [article.title, article.summary, article.content]
      .filter(Boolean)
      .join(" ");
    const tokens = estimateTokens(text);

    if (totalTokens + tokens > maxTokens && result.length > 0) {
      break;
    }

    totalTokens += tokens;
    result.push(article);
  }

  return result;
};

/**
 * Full digest pipeline: dedup → sort → tag budget → truncate → token budget.
 */
export const buildDigest = (
  articles: readonly Article[],
  options?: DigestOptions,
): { articles: Article[]; stats: { totalFetched: number; afterDedup: number; afterBudget: number; estimatedTokens: number } } => {
  const opts = { ...DEFAULT_DIGEST, ...options };
  const totalFetched = articles.length;

  // 1. Dedup by title similarity
  let result = dedup(articles, opts.similarityThreshold);
  const afterDedup = result.length;

  // 2. Sort
  result = sortArticles(result, opts.sort);

  // 3. Tag budget
  result = applyTagBudget(result, opts.maxArticlesPerTag);
  const afterBudget = result.length;

  // 4. Truncate content
  result = truncateArticles(result, opts.maxContentLength);

  // 5. Token budget
  result = applyTokenBudget(result, opts.maxTokens);

  // Estimate final tokens
  const estimatedTokens = result.reduce((sum, a) => {
    const text = [a.title, a.summary, a.content].filter(Boolean).join(" ");
    return sum + estimateTokens(text);
  }, 0);

  return {
    articles: result,
    stats: { totalFetched, afterDedup, afterBudget, estimatedTokens },
  };
};
