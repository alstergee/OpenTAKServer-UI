/**
 * Plugin SDK v2 — `kind: 'settings_section'` renderer.
 *
 * Renders one `<Paper>` panel per plugin in a future Settings page. The
 * body is fetched from `mount.endpoint` on mount; the endpoint typically
 * returns rendered HTML (settings form) that the plugin handles via its
 * own POST.
 *
 * The Settings page calls `getSettingsSections()` to list every registered
 * settings_section mount in declared order, then maps each into a
 * `<MountSettingsSection mount={...} />`.
 */
import { useEffect, useState } from 'react';
import { Box, Paper, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import axios from '../../axios_config';
import { mountRegistry } from '../mount-registry';
import type { MountSpec, SettingsSectionMount } from '../types';

export interface MountSettingsSectionProps {
  mount: SettingsSectionMount;
}

/** Snapshot the current `settings_section` mounts (non-React contexts welcome). */
export function getSettingsSections(): MountSpec[] {
  return mountRegistry.byKind('settings_section');
}

/** Single settings panel — server-rendered HTML in an iframe. */
export default function MountSettingsSection({ mount }: MountSettingsSectionProps) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  // Health-check the endpoint once so we can surface a friendly error
  // instead of a stuck/blank iframe when the plugin's blueprint is broken.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await axios.head(mount.endpoint);
        if (!cancelled) setError(null);
      } catch (err) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.warn(
          `[plugin-sdk] settings_section endpoint unreachable for ${mount._plugin}`,
          err,
        );
        setError(t('Plugin settings endpoint unreachable'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mount.endpoint, mount._plugin, t]);

  return (
    <Paper
      withBorder
      shadow="xs"
      p="md"
      radius="md"
      aria-label={t('Plugin settings: {{label}}', { label: mount.label })}
    >
      <Stack gap="sm">
        <Title order={4}>{mount.label}</Title>
        <Text size="xs" c="dimmed">
          {mount._plugin} v{mount._version}
        </Text>
        {error ? (
          <Text size="sm" c="red">
            {error}
          </Text>
        ) : (
          <Box
            component="iframe"
            src={mount.endpoint}
            title={mount.label}
            sandbox="allow-scripts allow-forms allow-same-origin"
            style={{
              width: '100%',
              minHeight: '300px',
              border: 0,
              borderRadius: 'var(--mantine-radius-md)',
            }}
          />
        )}
      </Stack>
    </Paper>
  );
}
