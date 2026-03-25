/**
 * Smoke test — fetches from real sources and prints a digest.
 * Run with: npm run dev
 */
import { createHarvester } from "./index.js";
import type { SourceConfig } from "./types.js";

const sources: SourceConfig[] = [
  // ── RSS sources ──────────────────────────────────────────
  {
    id: "bbc-world",
    name: "BBC World News",
    type: "rss",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    tags: ["global", "uk"],
    interval: 15,
  },
  {
    id: "aljazeera",
    name: "Al Jazeera",
    type: "rss",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
    tags: ["global", "middle-east"],
    interval: 15,
  },
  {
    id: "bellingcat",
    name: "Bellingcat",
    type: "rss",
    url: "https://www.bellingcat.com/feed/",
    tags: ["osint"],
    interval: 30,
  },
  {
    id: "theaviationist",
    name: "The Aviationist",
    type: "rss",
    url: "https://theaviationist.com/feed/",
    tags: ["aviation", "osint"],
    interval: 30,
  },
  {
    id: "jpost",
    name: "Jerusalem Post",
    type: "rss",
    url: "https://www.jpost.com/rss/rssfeedsfrontpage.aspx",
    tags: ["middle-east", "israel"],
    interval: 15,
  },
  {
    id: "israel-hayom",
    name: "Israel Hayom",
    type: "rss",
    url: "https://www.israelhayom.com/feed/",
    tags: ["middle-east", "israel"],
    interval: 15,
  },
  {
    id: "toi",
    name: "Times of Israel",
    type: "rss",
    url: "https://www.timesofisrael.com/feed/",
    tags: ["middle-east", "israel"],
    interval: 15,
  },
  {
    id: "france24",
    name: "France24",
    type: "rss",
    url: "https://www.france24.com/en/rss",
    tags: ["global", "europe"],
    interval: 15,
  },
  {
    id: "dw",
    name: "Deutsche Welle",
    type: "rss",
    url: "https://rss.dw.com/rdf/rss-en-all",
    tags: ["global", "europe", "germany"],
    interval: 15,
  },
  {
    id: "eu-parliament",
    name: "European Parliament Press",
    type: "rss",
    url: "https://www.europarl.europa.eu/rss/doc/press-releases/en.xml",
    tags: ["eu", "europe"],
    interval: 30,
  },

  // ── HTML sources ─────────────────────────────────────────
  {
    id: "nato",
    name: "NATO Newsroom",
    type: "html",
    url: "https://www.nato.int/cps/en/natohq/news.htm",
    tags: ["nato", "alliance"],
    interval: 30,
    selectors: {
      article: ".event-list-item",
      title: "a span:first-child",
      link: "a",
      date: ".event-date",
    },
  },
  {
    id: "idf",
    name: "IDF Press Releases",
    type: "html",
    url: "https://www.idf.il/en/mini-sites/press-releases/",
    tags: ["middle-east", "israel", "military"],
    interval: 30,
    selectors: {
      article: "[class*='articleCard']",
      title: "h3, [class*='title']",
      link: "a",
      date: "[class*='date'], time",
    },
  },
  {
    id: "defence24",
    name: "Defence24",
    type: "html",
    url: "https://defence24.pl/",
    tags: ["poland", "defence"],
    interval: 15,
    selectors: {
      article: "article, .article-item",
      title: "h2 a, h3 a",
      link: "h2 a, h3 a",
      date: "time",
      summary: ".lead, .excerpt, p",
    },
  },
];

const main = async (): Promise<void> => {
  console.log("osint-feed smoke test");
  console.log("=".repeat(60));
  console.log(`Sources: ${sources.length} (${sources.filter((s) => s.type === "rss").length} RSS, ${sources.filter((s) => s.type === "html").length} HTML)`);
  console.log();

  const harvester = createHarvester({
    sources,
    requestGap: 1_500,
    digest: {
      maxTokens: 8_000,
      maxArticlesPerTag: 8,
      maxContentLength: 300,
      similarityThreshold: 0.6,
    },
  });

  // ── Test 1: fetchAll ──────────────────────────────────────
  console.log("[1/3] Fetching all sources...");
  const t0 = Date.now();
  const allArticles = await harvester.fetchAll();
  const fetchTime = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  Fetched ${allArticles.length} articles in ${fetchTime}s`);
  console.log();

  // Print per-source breakdown
  const bySrc = new Map<string, number>();
  for (const a of allArticles) {
    bySrc.set(a.sourceId, (bySrc.get(a.sourceId) ?? 0) + 1);
  }
  console.log("  Per source:");
  for (const [id, count] of [...bySrc.entries()].sort((a, b) => b[1] - a[1])) {
    const src = sources.find((s) => s.id === id);
    const icon = src?.type === "rss" ? "RSS" : "HTML";
    console.log(`    [${icon}] ${id}: ${count} articles`);
  }
  console.log();

  // ── Test 2: fetchByTags ───────────────────────────────────
  console.log("[2/3] Fetching by tags: ['middle-east']...");
  const meArticles = await harvester.fetchByTags(["middle-east"]);
  console.log(`  Got ${meArticles.length} articles`);
  console.log();

  // ── Test 3: digest ────────────────────────────────────────
  console.log("[3/3] Building LLM digest...");
  const { articles: digestArticles, stats } = await harvester.digest();
  console.log(`  Stats:`);
  console.log(`    Total fetched:    ${stats.totalFetched}`);
  console.log(`    After dedup:      ${stats.afterDedup}`);
  console.log(`    After budget:     ${stats.afterBudget}`);
  console.log(`    Estimated tokens: ${stats.estimatedTokens}`);
  console.log();

  // Print digest articles
  console.log("  Digest articles:");
  console.log("  " + "-".repeat(56));
  for (const a of digestArticles.slice(0, 15)) {
    const date = a.publishedAt
      ? a.publishedAt.toISOString().slice(0, 16)
      : "no date";
    console.log(`  [${a.sourceId}] ${date}`);
    console.log(`    ${a.title}`);
    if (a.summary) {
      console.log(`    ${a.summary.slice(0, 120)}${a.summary.length > 120 ? "..." : ""}`);
    }
    console.log();
  }
  if (digestArticles.length > 15) {
    console.log(`  ... and ${digestArticles.length - 15} more`);
  }

  console.log("=".repeat(60));
  console.log("Done.");
};

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
