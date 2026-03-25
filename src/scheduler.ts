import type { SchedulerCallbacks, SourceConfig, Article } from "./types.js";

interface SchedulerEntry {
  source: SourceConfig;
  timer: ReturnType<typeof setInterval>;
}

export const createScheduler = (
  sources: readonly SourceConfig[],
  fetchSource: (source: SourceConfig) => Promise<Article[]>,
  callbacks: SchedulerCallbacks,
): { stop: () => void } => {
  const entries: SchedulerEntry[] = [];

  for (const source of sources) {
    if (source.enabled === false) continue;

    const intervalMs = (source.interval ?? 15) * 60_000;

    const tick = async (): Promise<void> => {
      try {
        const articles = await fetchSource(source);
        if (articles.length > 0) {
          await callbacks.onArticles(articles, source);
        }
      } catch (error) {
        callbacks.onError?.(error, source);
      }
    };

    void tick();

    const timer = setInterval(() => void tick(), intervalMs);
    entries.push({ source, timer });
  }

  return {
    stop: () => {
      for (const entry of entries) {
        clearInterval(entry.timer);
      }
      entries.length = 0;
    },
  };
};
