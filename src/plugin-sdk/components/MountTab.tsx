/**
 * Plugin SDK v2 — `kind: 'tab'` renderer.
 *
 * Renders a plugin's UI as a full-page route. For now we always render an
 * iframe that points at `/api/plugins/<slug>/ui` — the server-side blueprint
 * registered by `loader_v2.py` serves the plugin's static UI from there.
 *
 * Once plugins start shipping native React component bundles (a future B.x
 * task) we'll replace the iframe with a `React.lazy(() => import(...))` of
 * the plugin-supplied module. The route shape stays the same, so consumers
 * (App.tsx) don't have to change.
 *
 * Page-title behaviour: we call `useRouteTitle(mount.label)` so the browser
 * tab updates when the user navigates here. The hook reads the current
 * pathname so the suffix is appended automatically.
 */
import React from 'react';
import { Box, Stack, Text, Title } from '@mantine/core';
import { useParams } from 'react-router';
import { t } from 'i18next';
import { useRouteTitle } from '../../useRouteTitle';
import type { TabMount } from '../types';
import { IconByName } from './icon-by-name';
import { isMountAllowed } from './role-gate';

export interface MountTabProps {
  mount: TabMount;
}

/**
 * Build the iframe URL for a plugin tab.
 *
 * Server contract (loader_v2.py): every v2 plugin's static UI is mounted at
 * `/api/plugins/<slug>/ui`. The dashboard route is `/plugin/<slug>/*` — a
 * wildcard, so the user can deep-link to any sub-path under the plugin
 * (e.g. `/plugin/<slug>/config`). We forward that captured tail to the
 * iframe via URL hash so plugins that route internally on `location.hash`
 * land on the right view, while plugins that ignore the hash just show
 * their index page (unchanged behaviour). Hash routing keeps everything
 * inside one iframe load — no per-subpath server route required.
 */
function pluginUiUrl(slug: string, splat: string): string {
  const base = `/api/plugins/${encodeURIComponent(slug)}/ui`;
  const trimmed = splat.replace(/^\/+/, '').replace(/\/+$/, '');
  return trimmed ? `${base}#${trimmed}` : base;
}

export function MountTab({ mount }: MountTabProps): React.ReactElement | null {
  // Hooks must run unconditionally per the rules of hooks; the role gate
  // check happens after.
  useRouteTitle(mount.label);
  const params = useParams();
  const splat = (params['*'] ?? '').toString();

  if (!isMountAllowed(mount.roles)) {
    return null;
  }

  return (
    <Stack
      gap="sm"
      style={{
        height: '100%',
        minHeight: 'calc(100vh - var(--app-shell-header-height, 60px))',
      }}
    >
      <Box
        px="md"
        pt="md"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--mantine-spacing-sm)',
        }}
      >
        <IconByName iconName={mount.icon} stroke={1.5} size={24} />
        <Title order={3}>{t(mount.label)}</Title>
        <Text c="dimmed" size="sm">
          {mount._plugin}
        </Text>
      </Box>
      <Box style={{ flex: 1, minHeight: 0 }}>
        <iframe
          title={mount.label}
          aria-label={mount.label}
          // `key` forces the iframe to remount when the splat changes so a
          // user navigating between sub-paths gets the new hash applied
          // (browsers don't reload an iframe for a hash-only src change).
          key={`${mount._plugin}:${splat}`}
          src={pluginUiUrl(mount._plugin, splat)}
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

export default MountTab;
