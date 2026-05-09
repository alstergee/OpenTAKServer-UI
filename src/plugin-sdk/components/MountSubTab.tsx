/**
 * Plugin SDK v2 — `kind: 'subtab'` renderer.
 *
 * A subtab is NOT a route. It's a tab that gets injected into a host page's
 * `<Tabs>` component (e.g. inside Settings, EUDs, Map). The host page calls
 * `getSubTabs(parent)` to fetch the plugin-contributed entries for its slot
 * and renders them inline using `<MountSubTab mount={...} />`.
 *
 * Each subtab still calls into `/api/plugins/<slug>/ui` over an iframe for
 * now — same shape as `MountTab` — but rendered inside the host page's
 * tab body rather than as a full-page route.
 */
import React from 'react';
import { Box, Stack, Text } from '@mantine/core';
import { t } from 'i18next';
import { mountRegistry } from '../mount-registry';
import type { MountSpec, SubTabMount } from '../types';
import { IconByName } from './icon-by-name';
import { isMountAllowed } from './role-gate';

/**
 * Return all subtab mounts targeting a given host-page parent slug.
 *
 * Host pages (e.g. `pages/Settings.tsx`) call this in render to splice
 * plugin-supplied tabs into their `<Tabs>` component. The result is a
 * `MountSpec[]` (subtab variants only) — caller maps each to a `<Tabs.Tab>`
 * trigger and a `<Tabs.Panel>` body containing `<MountSubTab mount=…/>`.
 *
 * NOTE: this is NOT a hook — it reads the registry imperatively. Host pages
 * that want live updates should pair it with `useMounts()` so the registry
 * subscription drives re-renders.
 */
export function getSubTabs(parent: string): MountSpec[] {
  return mountRegistry
    .byKind('subtab')
    .filter((m) => m.parent === parent && isMountAllowed(m.roles));
}

function pluginUiUrl(slug: string, path: string): string {
  // Plugin's manifest `path` is the per-tab route inside its iframe app.
  // Server serves at `/api/plugins/<slug>/ui` — append the path so the
  // plugin's hash-router (or static page tree) can switch on it.
  const base = `/api/plugins/${encodeURIComponent(slug)}/ui`;
  if (!path || path === '/') return base;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export interface MountSubTabProps {
  mount: SubTabMount;
}

/**
 * Render a single subtab's body content. Designed to live inside a Mantine
 * `<Tabs.Panel>` — fills the panel's height. Caller is responsible for
 * gating the corresponding `<Tabs.Tab>` trigger via the same `isMountAllowed`
 * check (re-export below).
 */
export function MountSubTab({ mount }: MountSubTabProps): React.ReactElement | null {
  if (!isMountAllowed(mount.roles)) {
    return null;
  }

  return (
    <Stack gap="xs" h="100%">
      <Box
        px="sm"
        py="xs"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--mantine-spacing-xs)',
        }}
      >
        <IconByName iconName={mount.icon} stroke={1.5} size={18} />
        <Text fw={500}>{t(mount.label)}</Text>
        <Text c="dimmed" size="xs">
          {mount._plugin}
        </Text>
      </Box>
      <Box style={{ flex: 1, minHeight: 'min(60vh, 480px)' }}>
        <iframe
          title={mount.label}
          aria-label={mount.label}
          src={pluginUiUrl(mount._plugin, mount.path)}
          style={{
            width: '100%',
            height: '100%',
            border: 0,
            display: 'block',
            backgroundColor: 'var(--mantine-color-body)',
          }}
        />
      </Box>
    </Stack>
  );
}

export default MountSubTab;
