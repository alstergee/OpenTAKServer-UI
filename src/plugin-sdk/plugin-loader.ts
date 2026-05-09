/**
 * Plugin SDK v2 — plugin loader.
 *
 * Pulls the live mount list from the server and pushes it into the
 * runtime registry. Consumed by `DefaultLayout` on mount via
 * `startPluginLoader()`, which polls every 60 s by default so that
 * server-side plugin add / remove / enable / disable shows up in the UI
 * without a full page refresh.
 *
 * Failure mode: a bad fetch leaves the registry contents *unchanged* —
 * never wipe an in-memory snapshot just because the API blipped. The
 * console gets a `console.warn` so the operator can see something went
 * wrong without breaking the rendered UI.
 */
import axios from '../axios_config';
import { apiRoutes } from '../apiRoutes';
import { mountRegistry } from './mount-registry';
import type { MountsResponse } from './types';

/** Default polling interval (ms). */
export const DEFAULT_POLL_INTERVAL_MS = 60_000;

/**
 * One-shot fetch of the current mount list. Resolves on success; on any
 * error, logs a warning and leaves the registry unchanged.
 */
export async function loadPluginMounts(): Promise<void> {
  try {
    const response = await axios.get<MountsResponse>(apiRoutes.pluginsV2Mounts);
    const mounts = response.data?.mounts;
    if (!Array.isArray(mounts)) {
      // eslint-disable-next-line no-console
      console.warn(
        '[plugin-sdk] /api/plugins/v2/mounts returned non-array payload; keeping existing registry',
        response.data,
      );
      return;
    }
    mountRegistry.setAll(mounts);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[plugin-sdk] failed to load plugin mounts; keeping existing registry',
      err,
    );
  }
}

/**
 * Start polling the server for mount updates.
 *
 * Returns a stop function that clears the interval. Caller is responsible
 * for invoking the stop function on unmount — the loader does NOT try to
 * deduplicate against multiple `startPluginLoader` calls because every
 * mount slot owns its own lifecycle (host components decide when to start
 * and stop).
 *
 * @param intervalMs polling interval; defaults to {@link DEFAULT_POLL_INTERVAL_MS}.
 * @returns stop function — invoke to halt polling.
 */
export function startPluginLoader(
  intervalMs: number = DEFAULT_POLL_INTERVAL_MS,
): () => void {
  // Fire one immediately so the first paint isn't blocked on the timer.
  // Floating promise — errors are already swallowed inside loadPluginMounts.
  void loadPluginMounts();

  const handle = window.setInterval(() => {
    void loadPluginMounts();
  }, intervalMs);

  return () => {
    window.clearInterval(handle);
  };
}
