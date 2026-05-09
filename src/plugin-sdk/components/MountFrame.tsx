/**
 * Plugin SDK v2 — `kind: 'frame'` renderer.
 *
 * Sandboxed iframe for embedding external/legacy content (e.g. a Grafana
 * panel, a third-party map, a vendor UI). Strict sandbox: only
 * `allow-scripts` + `allow-same-origin` so embedded pages can run JS but
 * can't pop new windows, submit forms across origins, or initiate top-level
 * navigation away from the dashboard.
 *
 * Unlike `MountTab`, the iframe `src` is taken from the manifest's `path`
 * directly — frame mounts often point at off-server URLs (or at a different
 * server-side blueprint than `/api/plugins/<slug>/ui`).
 */
import React from 'react';
import { Box, Stack, Text, Title } from '@mantine/core';
import { t } from 'i18next';
import { useRouteTitle } from '../../useRouteTitle';
import type { FrameMount } from '../types';
import { IconByName } from './icon-by-name';
import { isMountAllowed } from './role-gate';

export interface MountFrameProps {
  mount: FrameMount;
}

export function MountFrame({ mount }: MountFrameProps): React.ReactElement {
  // Hooks must run unconditionally — call before the role check.
  useRouteTitle(mount.label);

  if (!isMountAllowed(mount.roles)) {
    // Users navigating directly to a frame route should see *something* —
    // a blank page would look broken. A short "denied" notice is friendlier.
    return (
      <Box p="md">
        <Text c="dimmed">{t('Access denied')}</Text>
      </Box>
    );
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
          src={mount.path}
          sandbox="allow-scripts allow-same-origin"
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

export default MountFrame;
