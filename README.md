# osint-feed

Config-driven news harvester for Node.js. Pulls articles from RSS feeds and HTML pages, deduplicates them, and produces a compact digest ready to feed into an LLM context window.

No AI inside. No opinions about your stack. Just articles in, structured data out.

## Why

You're building something that needs fresh news context — a SITREP generator, a threat monitor, a research assistant. You have 30+ sources across languages and formats. You need the data compact enough to fit in a Llama/GPT context window without blowing the budget.

Existing tools are either Python-only (newspaper4k), heavy self-hosted platforms (Huginn), or commercial APIs (Newscatcher, NewsAPI). Nothing in the JS/TS ecosystem does config-driven multi-source harvesting with built-in LLM-ready compression.

`osint-feed` fills that gap.

## Install

```bash
npm install osint-feed
```

Requires Node.js 18+.

## Quick Start

```typescript
import { createHarvester } from "osint-feed";

const harvester = createHarvester({
  sources: [
    {
      id: "bbc-world",
      name: "BBC World",
      type: "rss",
      url: "https://feeds.bbci.co.uk/news/world/rss.xml",
      tags: ["global", "uk"],
      interval: 15,
    },
    {
      id: "nato",
      name: "NATO Newsroom",
      type: "html",
      url: "https://www.nato.int/cps/en/natohq/news.htm",
      tags: ["nato"],
      interval: 30,
      selectors: {
        article: ".event-list-item",
        title: "a span:first-child",
        link: "a",
        date: ".event-date",
      },
    },
  ],
});

// Fetch everything
const articles = await harvester.fetchAll();

// Or get an LLM-ready digest
const { articles: digest, stats } = await harvester.digest();
console.log(`${stats.totalFetched} articles -> ${stats.afterDedup} unique -> ${stats.estimatedTokens} tokens`);
```

## Source Types

### RSS / Atom

Works out of the box. No selectors needed — feeds are parsed automatically.

```typescript
{
  id: "france24",
  name: "France24",
  type: "rss",
  url: "https://www.france24.com/en/rss",
  tags: ["global", "europe"],
  interval: 15,
}
```

### HTML Scraping

You define CSS selectors per source. The library uses [cheerio](https://github.com/cheeriojs/cheerio) — no headless browser, no Puppeteer overhead.

```typescript
{
  id: "defence24",
  name: "Defence24",
  type: "html",
  url: "https://defence24.pl/",
  tags: ["poland", "defence"],
  interval: 15,
  selectors: {
    article: "article",        // repeating container
    title: "h2 a",             // title text (within article)
    link: "h2 a",              // link href (within article)
    date: "time",              // optional: publication date
    summary: ".lead",          // optional: description text
  },
}
```

## API

### `createHarvester(options)`

Creates a harvester instance. Options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sources` | `SourceConfig[]` | required | Array of source definitions |
| `dedup.known` | `() => string[]` | — | Returns hashes already in your DB (for cross-session dedup) |
| `digest` | `DigestOptions` | see below | Default digest settings |
| `requestTimeout` | `number` | `15000` | HTTP timeout in ms |
| `requestGap` | `number` | `1000` | Minimum ms between requests (rate limiting) |
| `fetch` | `Function` | global fetch | Custom fetch for proxies/testing |

### `harvester.fetchAll()`

Fetches all enabled sources. Returns `Article[]`.

### `harvester.fetch(sourceId)`

Fetches a single source by ID.

### `harvester.fetchByTags(tags)`

Fetches sources matching any of the given tags.

### `harvester.digest(options?)`

The main event. Fetches all sources, then runs the compression pipeline:

1. **Dedup** — Groups similar headlines (Jaccard similarity) and keeps the richest version
2. **Sort** — Newest first (or by relevance)
3. **Tag budget** — Caps articles per tag so no single region dominates
4. **Truncate** — Cuts content to N characters per article
5. **Token budget** — Trims from the bottom until under the token limit

```typescript
const { articles, stats } = await harvester.digest({
  maxTokens: 12_000,           // total token budget
  maxArticlesPerTag: 10,       // max articles per tag group
  maxContentLength: 500,       // chars per article content
  similarityThreshold: 0.6,    // title dedup threshold (0-1)
  sort: "recency",             // "recency" | "relevance"
});

// stats.totalFetched     → 700  (raw from all sources)
// stats.afterDedup       → 200  (unique stories)
// stats.afterBudget      → 80   (within tag limits)
// stats.estimatedTokens  → 18000 (final token count)
```

### `harvester.start(callbacks)` / `harvester.stop()`

Runs sources on their configured intervals. You handle storage.

```typescript
harvester.start({
  onArticles: async (articles, source) => {
    await db.insert("articles", articles);
    console.log(`${articles.length} new from ${source.name}`);
  },
  onError: (err, source) => {
    console.error(`${source.name} failed:`, err);
  },
});

// Later:
harvester.stop();
```

## Article Schema

```typescript
interface Article {
  sourceId: string;          // matches source config id
  url: string;               // canonical article URL
  title: string;
  content: string | null;    // full text (when available)
  summary: string | null;    // short description
  publishedAt: Date | null;
  hash: string;              // SHA-256 of URL (dedup key)
  fetchedAt: Date;
  tags: string[];            // inherited from source
}
```

## Dedup Across Sessions

The library handles within-batch dedup automatically. For cross-session dedup (don't re-process articles already in your DB), pass a `known` callback:

```typescript
const harvester = createHarvester({
  sources,
  dedup: {
    known: async () => {
      const rows = await db.query("SELECT hash FROM articles");
      return rows.map(r => r.hash);
    },
  },
});

// fetchAll() now skips articles whose URL hash is already known
```

## Use with Next.js

```typescript
// app/api/feed/route.ts
import { createHarvester } from "osint-feed";

const harvester = createHarvester({ sources: [...] });

export async function GET() {
  const { articles, stats } = await harvester.digest({ maxTokens: 8000 });
  return Response.json({ articles, stats });
}
```

## Use with Express

```typescript
import express from "express";
import { createHarvester } from "osint-feed";

const app = express();
const harvester = createHarvester({ sources: [...] });

app.get("/digest", async (_req, res) => {
  const result = await harvester.digest();
  res.json(result);
});
```

## How the Digest Math Works

Real numbers from a smoke test with 10 RSS + 3 HTML sources:

```
Raw fetch:         324 articles
After title dedup: 319 unique stories
After tag budget:  47  (8 per tag, 6 tags)
Estimated tokens:  5,781
```

That's **1.8% of Llama 3's 128k context**. Plenty of room for system prompt, history, and reasoning.

With 35 sources polling every 15 min you'd get ~700 articles/hour. The digest pipeline compresses that to ~80 articles / ~18k tokens. Adjust `maxArticlesPerTag` and `maxTokens` to taste.

## Dependencies

Just two:

- [`cheerio`](https://github.com/cheeriojs/cheerio) — HTML parsing
- [`rss-parser`](https://github.com/rbren/rss-parser) — RSS/Atom parsing

No headless browsers. No native modules. No bloat.

## License

MIT

## Disclaimer

This library is a tool for fetching and parsing publicly available web content. Users are responsible for compliance with target websites' terms of service and applicable laws. The authors assume no liability for how the library is used.
