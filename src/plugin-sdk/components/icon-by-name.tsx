/**
 * Plugin SDK v2 — dynamic Tabler icon lookup.
 *
 * Plugins declare their icons by string name in `plugin.toml` (e.g.
 * `icon = "tabler:icons:map-pin"` or simply `IconMapPin`). We resolve those
 * to the actual Tabler component at render time without bundling all 11k+
 * icons up front. `import.meta.glob` builds a path map at compile time but
 * leaves the modules un-fetched until a path is requested — which is exactly
 * what we want.
 *
 * If the icon name doesn't resolve we fall back to `IconPuzzle`, which is
 * the "I'm a plugin" default.
 */
import React, { Suspense, useMemo } from 'react';
import type { ComponentType } from 'react';
import type { Icon, IconProps } from '@tabler/icons-react';
import { IconPuzzle } from '@tabler/icons-react';

// Vite glob — paths only, modules lazy-imported on demand. This compiles
// down to a static map { '../../node_modules/.../IconAB.mjs': () => import(...) }
// so the bundler can code-split each icon into its own tiny chunk.
const iconModules = import.meta.glob<{ default: Icon }>(
  '/node_modules/@tabler/icons-react/dist/esm/icons/Icon*.mjs',
);

// Per-name React.lazy cache so two consumers of the same icon share one chunk.
const lazyCache = new Map<string, ComponentType<IconProps>>();

/**
 * Normalise a manifest icon name to the canonical Tabler `IconXxx` form.
 *
 * Accepts:
 *   - `IconMapPin`            → `IconMapPin`
 *   - `map-pin`               → `IconMapPin`
 *   - `tabler:icons:map-pin`  → `IconMapPin`
 *   - `tabler:icons:IconMapPin` → `IconMapPin`
 */
function normaliseIconName(raw: string): string {
  let name = raw.trim();
  // Strip a leading `tabler:icons:` prefix (manifest convenience).
  name = name.replace(/^tabler:icons?:/i, '');
  // Already in `IconFoo` form? — keep it.
  if (/^Icon[A-Z]/.test(name)) {
    return name;
  }
  // Convert kebab/snake → PascalCase and prepend `Icon`.
  const pascal = name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('');
  return `Icon${pascal}`;
}

function resolveIconLoader(componentName: string):
  | (() => Promise<{ default: Icon }>)
  | null {
  const suffix = `/icons/${componentName}.mjs`;
  for (const [path, loader] of Object.entries(iconModules)) {
    if (path.endsWith(suffix)) {
      return loader;
    }
  }
  return null;
}

function lazyIconFor(componentName: string): ComponentType<IconProps> {
  const cached = lazyCache.get(componentName);
  if (cached) return cached;

  const loader = resolveIconLoader(componentName);
  if (!loader) {
    // Unknown name — record the fallback so we don't re-search every render.
    lazyCache.set(componentName, IconPuzzle);
    return IconPuzzle;
  }

  const Lazy = React.lazy(async () => {
    try {
      const mod = await loader();
      return { default: mod.default as ComponentType<IconProps> };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[plugin-sdk] failed to load icon ${componentName}`, err);
      return { default: IconPuzzle as unknown as ComponentType<IconProps> };
    }
  });
  lazyCache.set(componentName, Lazy);
  return Lazy;
}

export type IconByNameProps = Omit<IconProps, 'name'> & {
  /**
   * Icon name from a plugin manifest. `null`/empty → fallback to IconPuzzle.
   * Renamed from `name` to avoid colliding with `IconProps.name` (which is
   * the SVG `<title>` accessible name on Tabler icons). The host's
   * `@types/react` widens `name` to `string | null | undefined` whereas
   * Tabler's own typings use `string | undefined`, so we Omit it to stay
   * portable across React-types versions.
   */
  iconName?: string | null;
};

/**
 * Render a Tabler icon by string name. Suspends while the icon chunk loads;
 * shows nothing in the interim (icons are decorative — no spinner needed).
 */
export function IconByName({ iconName, ...iconProps }: IconByNameProps): React.ReactElement {
  const Component = useMemo<ComponentType<IconProps>>(() => {
    if (!iconName) return IconPuzzle;
    return lazyIconFor(normaliseIconName(iconName));
  }, [iconName]);

  return (
    <Suspense fallback={null}>
      <Component {...iconProps} />
    </Suspense>
  );
}

export default IconByName;
