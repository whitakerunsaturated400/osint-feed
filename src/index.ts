export { createHarvester } from "./harvester.js";
export { buildDigest, dedup } from "./digest.js";
export { fetchRss } from "./rss.js";
export { fetchHtml } from "./html.js";

export type {
  Article,
  DigestOptions,
  DigestResult,
  Harvester,
  HarvesterOptions,
  HtmlSelectors,
  HtmlSourceConfig,
  KnownHashesFn,
  RssSourceConfig,
  SchedulerCallbacks,
  SourceConfig,
} from "./types.js";
