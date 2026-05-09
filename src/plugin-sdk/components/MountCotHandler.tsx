/**
 * Plugin SDK v2 — `kind: 'cot_handler'` registration.
 *
 * cot_handler mounts have NO direct visual surface. They contribute a
 * CoT type filter + endpoint to a module-level registry that Map.tsx's
 * CoT rendering loop consumes when picking marker icons / popup content.
 *
 * Why a module-level registry instead of React context: the registry
 * has to be readable from raw Leaflet event handlers (which run outside
 * React's tree) and from the CoT WebSocket pipeline that lives in
 * `Map.tsx`. A context would force every consumer to be a React
 * component — these consumers are imperative.
 *
 * Future tie-in (tracked under B.3b notes in SKILL.md):
 * Map.tsx will, in a follow-up commit, call
 * `cotHandlerRegistry.resolve(event.type)` while iterating CoT events
 * to look up the plugin endpoint that wants to render this CoT. That
 * endpoint returns `{ iconUrl?, popupHtml?, color? }` for the marker.
 *
 * For now this file just maintains the registry and exposes the
 * `useCotHandlerRegistration(mount)` hook so MountCotHandler instances
 * mounted in the React tree (typically by `Plugins.tsx` or a hidden
 * registration component in `DefaultLayout.tsx`) keep the registry in
 * sync with the live mount list. The component itself renders nothing.
 */
import { useEffect } from 'react';
import type { CotHandlerMount } from '../types';

/**
 * Registry entry — keyed by the CoT type string the plugin wants to
 * own. Multiple plugins MAY register the same type; last writer wins
 * (we log a warning so the operator can resolve the conflict).
 */
export interface CotHandlerEntry {
  /** The CoT type filter (e.g. `b-m-p-s-p-i`). Empty string = catch-all. */
  cotType: string;
  /** Backend endpoint the Map should hit for icon/popup data. */
  endpoint: string;
  /** Origin plugin slug. */
  plugin: string;
  /** Plugin version. */
  version: string;
  /** Original mount label — used in dev tooling / log lines. */
  label: string;
}

const cotHandlerRegistry = new Map<string, CotHandlerEntry>();
type CotListener = () => void;
const cotListeners = new Set<CotListener>();

function notifyCot(): void {
  for (const listener of Array.from(cotListeners)) {
    try {
      listener();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[plugin-sdk] cot_handler listener threw:', err);
    }
  }
}

/**
 * Module-level CoT handler registry. Map.tsx (or any imperative
 * consumer) reads from this directly. React components prefer the
 * `useCotHandlerRegistration` hook below.
 */
export const cotHandlerRegistry_api = {
  /** Look up the handler for a given CoT type. Returns `undefined` if none. */
  resolve(cotType: string): CotHandlerEntry | undefined {
    return cotHandlerRegistry.get(cotType) ?? cotHandlerRegistry.get('');
  },

  /** Snapshot of all registered handlers. Cheap copy. */
  all(): CotHandlerEntry[] {
    return Array.from(cotHandlerRegistry.values());
  },

  /** Subscribe to registry changes. Returns an unsubscribe function. */
  subscribe(listener: CotListener): () => void {
    cotListeners.add(listener);
    return () => {
      cotListeners.delete(listener);
    };
  },

  /** Used by tests + the registration hook. Not for general consumers. */
  _register(entry: CotHandlerEntry): () => void {
    const existing = cotHandlerRegistry.get(entry.cotType);
    if (existing && existing.plugin !== entry.plugin) {
      // eslint-disable-next-line no-console
      console.warn(
        `[plugin-sdk] cot_handler conflict on type '${entry.cotType}': ` +
          `${existing.plugin}@${existing.version} replaced by ${entry.plugin}@${entry.version}`,
      );
    }
    cotHandlerRegistry.set(entry.cotType, entry);
    notifyCot();
    return () => {
      // Only remove if we still own this slot — another plugin may have
      // registered after us between mount and unmount.
      const current = cotHandlerRegistry.get(entry.cotType);
      if (current && current.plugin === entry.plugin && current.endpoint === entry.endpoint) {
        cotHandlerRegistry.delete(entry.cotType);
        notifyCot();
      }
    };
  },

  /** Test helper — clears the registry without notifying listeners twice. */
  _resetForTests(): void {
    cotHandlerRegistry.clear();
    notifyCot();
  },
};

/**
 * Register a cot_handler mount with the module-level registry for the
 * lifetime of the calling component. The mount's `endpoint` field is
 * expected to encode (or default-resolve to) the CoT type the plugin
 * wants to own — convention: a query string `?cot_type=b-m-p-s-p-i`
 * inside the endpoint URL, or the entire endpoint with type encoded.
 *
 * For now we derive the CoT type from `mount.label`'s `[type]` prefix
 * if present, falling back to the endpoint's `cot_type` query param,
 * falling back to '' (catch-all).
 */
export function useCotHandlerRegistration(mount: CotHandlerMount): void {
  useEffect(() => {
    const cotType = extractCotType(mount);
    const unregister = cotHandlerRegistry_api._register({
      cotType,
      endpoint: mount.endpoint,
      plugin: mount._plugin,
      version: mount._version,
      label: mount.label,
    });
    return () => {
      unregister();
    };
  }, [mount.endpoint, mount.label, mount._plugin, mount._version]);
}

/**
 * Extract the CoT type the plugin wants to own from its mount metadata.
 *
 * Resolution order:
 *   1. `?cot_type=…` query param on the endpoint URL.
 *   2. A `[…]` prefix on the label (e.g. `[b-m-p-s-p-i] My handler`).
 *   3. Empty string — catch-all.
 */
function extractCotType(mount: CotHandlerMount): string {
  // 1. Query param. We only need the first occurrence; URLSearchParams
  // tolerates relative paths if we slap a base on, but the endpoint may
  // already be absolute — guard both.
  try {
    const url = new URL(mount.endpoint, window.location.origin);
    const param = url.searchParams.get('cot_type');
    if (param) return param;
  } catch {
    /* endpoint may be a degenerate string — fall through */
  }

  // 2. Label prefix.
  const m = mount.label.match(/^\[([^\]]+)\]/);
  if (m) return m[1].trim();

  // 3. Catch-all.
  return '';
}

interface Props {
  mount: CotHandlerMount;
}

/**
 * Hidden registration component — renders nothing. Mount one per
 * cot_handler entry inside the layout (typically inside DefaultLayout
 * via `useMountsByKind('cot_handler').map(...)`).
 */
export default function MountCotHandler({ mount }: Props) {
  useCotHandlerRegistration(mount);
  return null;
}
