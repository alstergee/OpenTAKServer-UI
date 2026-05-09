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
 * The server contract (Phase A.4 loader_v2.py) is that every v2 plugin gets
 * its static UI mounted at `/api/plugins/<slug>/ui`. The manifest's `path`
 * field is the *route* on the dashboard (e.g. `/plugin/mapmarker`), not the
 * iframe URL — so we always derive the iframe URL from the slug.
 */
function pluginUiUrl(slug: string): string {
  return `/api/plugins/${encodeURIComponent(slug)}/ui`;
}

export function MountTab({ mount }: MountTabProps): React.ReactElement | null {
  // Title hook must be called unconditionally (rules of hooks) — even when
  // we're about to bail out below. The role check happens after.
  useRouteTitle(mount.label);

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
          src={pluginUiUrl(mount._plugin)}
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
