/**
 * Plugin SDK v2 — runtime mount registry.
 *
 * Holds the full `MountSpec[]` produced by the server's
 * `MountRegistry.serialize_for_ui()` helper. Layout components
 * (Navbar, Map, Settings, …) subscribe to changes and render the mounts
 * relevant to their slot.
 *
 * Threading model
 * ---------------
 * Single-threaded JS — no locks needed. We expose the snapshot as a
 * referentially-stable array reference between updates so React's
 * `useSyncExternalStore` can short-circuit re-renders when nothing changed.
 *
 * The hooks are built on `useSyncExternalStore` (React 18+) so they behave
 * correctly under React 19 concurrent mode and StrictMode double-invoke.
 */
import { useSyncExternalStore } from 'react';
import type { MountSpec } from './types';

export type MountListener = (mounts: MountSpec[]) => void;

/** Empty constant — referentially stable initial snapshot. */
const EMPTY_MOUNTS: readonly MountSpec[] = Object.freeze([]);

let currentMounts: MountSpec[] = EMPTY_MOUNTS as MountSpec[];
const listeners = new Set<MountListener>();

function notify(): void {
  // Iterate over a copy so listeners that unsubscribe during the callback
  // don't mutate the live set mid-iteration.
  for (const listener of Array.from(listeners)) {
    try {
      listener(currentMounts);
    } catch (err) {
      // A failing listener must not break the rest of the chain.
      // eslint-disable-next-line no-console
      console.error('[plugin-sdk] mount registry listener threw:', err);
    }
  }
}

/**
 * Replace the entire mount list. Always fires listeners — even if the array
 * is shallow-equal to the previous one — because callers cannot guarantee
 * referential equality of mount objects across server fetches.
 */
function setAll(mounts: MountSpec[]): void {
  // Defensive copy so external mutation can't corrupt the registry state.
  currentMounts = [...mounts];
  notify();
}

function get(): MountSpec[] {
  return currentMounts;
}

function byKind<K extends MountSpec['kind']>(
  kind: K,
): Extract<MountSpec, { kind: K }>[] {
  return currentMounts.filter(
    (m): m is Extract<MountSpec, { kind: K }> => m.kind === kind,
  );
}

function byPlugin(slug: string): MountSpec[] {
  return currentMounts.filter((m) => m._plugin === slug);
}

function subscribe(listener: MountListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const mountRegistry = {
  setAll,
  get,
  byKind,
  byPlugin,
  subscribe,
};

// ---------------------------------------------------------------------------
// React hooks (useSyncExternalStore)
// ---------------------------------------------------------------------------

/**
 * `useSyncExternalStore` requires `subscribe(onStoreChange)` to return an
 * unsubscribe function — exactly what `mountRegistry.subscribe` already
 * does. We adapt it (drop the `mounts` arg) so the React contract is met.
 */
function subscribeReact(onStoreChange: () => void): () => void {
  return mountRegistry.subscribe(() => onStoreChange());
}

function getSnapshot(): MountSpec[] {
  return currentMounts;
}

/**
 * Server snapshot — used during SSR, but also during the initial hydration
 * on the client when `useSyncExternalStore` checks for tearing. Returning
 * the same value as the client snapshot is correct here because the registry
 * is purely client-side state and starts empty.
 */
function getServerSnapshot(): MountSpec[] {
  return EMPTY_MOUNTS as MountSpec[];
}

/** Subscribe to the live mount list. Re-renders on `setAll()`. */
export function useMounts(): MountSpec[] {
  return useSyncExternalStore(subscribeReact, getSnapshot, getServerSnapshot);
}

/**
 * Subscribe to mounts of a single kind.
 *
 * Memoised internally so consumers receive a stable reference between
 * updates that didn't change the filtered subset — avoids spurious
 * re-renders of expensive consumers like Map layer groups.
 */
export function useMountsByKind<K extends MountSpec['kind']>(
  kind: K,
): Extract<MountSpec, { kind: K }>[] {
  // We deliberately recompute inside `useSyncExternalStore`'s snapshot
  // function rather than calling `useMemo(() => mounts.filter(...), [mounts])`
  // because the latter still allocates on every store change even when the
  // filtered view is unchanged. Caching by `(snapshot, kind)` keys gives us
  // referential stability across renders that didn't touch our subset.
  const subscribeForKind = (onStoreChange: () => void): (() => void) =>
    mountRegistry.subscribe(() => onStoreChange());

  const getKindSnapshot = (): Extract<MountSpec, { kind: K }>[] =>
    getCachedFilter(kind);

  const getKindServerSnapshot = (): Extract<MountSpec, { kind: K }>[] =>
    EMPTY_MOUNTS as Extract<MountSpec, { kind: K }>[];

  return useSyncExternalStore(
    subscribeForKind,
    getKindSnapshot,
    getKindServerSnapshot,
  );
}

// Per-kind filter cache: key = the live snapshot reference + kind. The
// cache is invalidated implicitly when `currentMounts` is replaced (the
// `WeakMap` key is the array itself, so the next call with the new array
// will miss and recompute).
const filterCache = new WeakMap<MountSpec[], Map<string, MountSpec[]>>();

function getCachedFilter<K extends MountSpec['kind']>(
  kind: K,
): Extract<MountSpec, { kind: K }>[] {
  let perSnapshot = filterCache.get(currentMounts);
  if (!perSnapshot) {
    perSnapshot = new Map();
    filterCache.set(currentMounts, perSnapshot);
  }
  const cached = perSnapshot.get(kind);
  if (cached) {
    return cached as Extract<MountSpec, { kind: K }>[];
  }
  const fresh = currentMounts.filter(
    (m): m is Extract<MountSpec, { kind: K }> => m.kind === kind,
  );
  perSnapshot.set(kind, fresh);
  return fresh;
}
