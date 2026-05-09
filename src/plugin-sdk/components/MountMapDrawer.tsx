/**
 * Plugin SDK v2 — `kind: 'map_drawer'` renderer.
 *
 * Renders inside Map.tsx's slide-out drawer panel when the user clicks
 * an EUD. Each plugin contributes its own section; sections are stacked
 * vertically. The plugin endpoint is fetched as
 * `<endpoint>?eud_uid=<uid>` and the response is rendered as plain
 * key/value pairs by default.
 *
 * Usage from `Map.tsx`:
 *
 * ```tsx
 * import { getMapDrawerSections } from '../plugin-sdk/components/MountMapDrawer';
 *
 * {getMapDrawerSections().map((m) => (
 *   <MountMapDrawer key={m._plugin + m.label} mount={m} eudUid={selected.uid} />
 * ))}
 * ```
 *
 * The `getMapDrawerSections()` accessor reads the registry once at call
 * time. Map.tsx already does its own re-render dance when the selected
 * EUD changes; we don't bother subscribing to the registry inside the
 * drawer — these mounts virtually never change at runtime.
 *
 * Failure mode: a bad fetch shows a small italic "no data" line. Keeps
 * the rest of the drawer usable when one plugin's endpoint is down.
 */
import { useEffect, useState } from 'react';
import { Stack, Text, Title, Loader, Group } from '@mantine/core';
import { t } from 'i18next';
import axios from '../../axios_config';
import { mountRegistry } from '../mount-registry';
import type { MapDrawerMount } from '../types';

/** 5 minutes — same cadence as MountMapOverlay. */
const DEFAULT_REFRESH_MS = 5 * 60 * 1000;

interface DrawerPayload {
  /** Free-form key/value map rendered as a definition list. */
  fields?: Record<string, string | number | boolean | null>;
  /** Optional rich text (markdown rendered as plain pre-wrap text). */
  text?: string;
}

interface Props {
  mount: MapDrawerMount;
  /** UID of the currently-selected EUD. */
  eudUid: string;
  /** Override polling interval; 0 disables polling. Defaults to 5 minutes. */
  refreshMs?: number;
}

/**
 * Convenience accessor for `Map.tsx` — returns the live list of
 * map_drawer mounts. Re-call on every render; cheap (filter over a small
 * array). Map.tsx is the only intended caller.
 */
export function getMapDrawerSections(): MapDrawerMount[] {
  return mountRegistry.byKind('map_drawer');
}

export default function MountMapDrawer({
  mount,
  eudUid,
  refreshMs = DEFAULT_REFRESH_MS,
}: Props) {
  const [payload, setPayload] = useState<DrawerPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errored, setErrored] = useState<boolean>(false);

  useEffect(() => {
    let alive = true;

    async function load(): Promise<void> {
      try {
        const r = await axios.get<DrawerPayload>(mount.endpoint, {
          params: { eud_uid: eudUid },
        });
        if (!alive) return;
        setPayload(r.data && typeof r.data === 'object' ? r.data : {});
        setErrored(false);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          `[plugin-sdk] map_drawer '${mount._plugin}' fetch failed`,
          err,
        );
        if (!alive) return;
        setErrored(true);
      } finally {
        if (alive) setLoading(false);
      }
    }

    setLoading(true);
    void load();
    const id = refreshMs > 0 ? window.setInterval(() => void load(), refreshMs) : 0;
    return () => {
      alive = false;
      if (id) window.clearInterval(id);
    };
  }, [mount.endpoint, mount._plugin, eudUid, refreshMs]);

  return (
    <Stack
      gap="xs"
      style={{
        padding: 'var(--mantine-spacing-sm)',
        borderTop: '1px solid var(--mantine-color-default-border)',
      }}
    >
      <Group justify="space-between" align="center">
        <Title order={5}>{mount.label}</Title>
        {loading && <Loader size="xs" />}
      </Group>

      {errored && (
        <Text size="sm" c="dimmed" fs="italic">
          {t('No data available')}
        </Text>
      )}

      {!errored && payload && payload.fields && (
        <Stack gap={4}>
          {Object.entries(payload.fields).map(([k, v]) => (
            <Group key={k} gap="xs" wrap="nowrap">
              <Text size="sm" fw={600} style={{ minWidth: 120 }}>
                {k}
              </Text>
              <Text size="sm" style={{ wordBreak: 'break-word' }}>
                {v === null || v === undefined ? '—' : String(v)}
              </Text>
            </Group>
          ))}
        </Stack>
      )}

      {!errored && payload && payload.text && (
        <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
          {payload.text}
        </Text>
      )}

      {!errored &&
        !loading &&
        payload &&
        !payload.fields &&
        !payload.text && (
          <Text size="sm" c="dimmed" fs="italic">
            {t('No data available')}
          </Text>
        )}
    </Stack>
  );
}
