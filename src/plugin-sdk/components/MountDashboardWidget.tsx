/**
 * Plugin SDK v2 — `kind: 'dashboard_widget'` renderer.
 *
 * Renders a single Mantine `<Card>` whose contents are fetched from
 * `mount.endpoint`. The endpoint is expected to return JSON of shape
 * `{ title?, value?, subtitle?, color?, icon? }` — a simple KPI card that
 * any plugin can produce without owning a React component.
 *
 * The widget polls the endpoint every 30 s. On error the existing values
 * remain — we never wipe a working widget because of a transient failure.
 *
 * Used by the host Dashboard page, which iterates
 * `useMountsByKind('dashboard_widget')` into a grid:
 *
 *   const widgets = useMountsByKind('dashboard_widget');
 *   return widgets.map(m => <MountDashboardWidget key={m._plugin + m.label} mount={m} />);
 */
import { useEffect, useRef, useState } from 'react';
import { Card, Group, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import axios from '../../axios_config';
import type { DashboardWidgetMount } from '../types';

/** Server-supplied widget payload. All fields optional — missing pieces collapse. */
interface WidgetPayload {
  title?: string;
  value?: string | number;
  subtitle?: string;
  /** Mantine theme color name (e.g. `'paleBlue'`, `'red'`, `'green'`). */
  color?: string;
  /** Optional emoji or short string rendered as the leading glyph. */
  icon?: string;
}

export interface MountDashboardWidgetProps {
  mount: DashboardWidgetMount;
}

/** Polling interval in ms — long enough to be polite, short enough to feel live. */
const POLL_INTERVAL_MS = 30_000;

export default function MountDashboardWidget({ mount }: MountDashboardWidgetProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<WidgetPayload | null>(null);
  const [hadError, setHadError] = useState(false);
  // Latest endpoint reference so the polling effect re-subscribes if it changes.
  const endpointRef = useRef(mount.endpoint);
  endpointRef.current = mount.endpoint;

  useEffect(() => {
    let cancelled = false;

    const fetchOnce = async () => {
      try {
        const res = await axios.get<WidgetPayload>(endpointRef.current);
        if (cancelled) return;
        setData(res.data ?? {});
        setHadError(false);
      } catch (err) {
        if (cancelled) return;
        // Don't wipe last-known-good data — only surface that something went wrong.
        // eslint-disable-next-line no-console
        console.warn(
          `[plugin-sdk] dashboard_widget fetch failed for ${mount._plugin} (${endpointRef.current})`,
          err,
        );
        setHadError(true);
      }
    };

    void fetchOnce();
    const handle = window.setInterval(() => {
      void fetchOnce();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
    // mount.endpoint is the only thing that can change; re-subscribe on change.
  }, [mount.endpoint, mount._plugin]);

  const title = data?.title ?? mount.label;
  const accent = data?.color;

  return (
    <Card
      withBorder
      shadow="sm"
      padding="md"
      radius="md"
      aria-label={`${mount._plugin} dashboard widget: ${title}`}
    >
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Text fw={500} size="sm" c={accent ?? undefined}>
            {title}
          </Text>
          {data?.icon ? (
            <Text size="lg" aria-hidden>
              {data.icon}
            </Text>
          ) : null}
        </Group>
        <Title order={2} c={accent ?? undefined}>
          {data?.value ?? (hadError ? t('—') : '…')}
        </Title>
        {data?.subtitle ? (
          <Text size="xs" c="dimmed">
            {data.subtitle}
          </Text>
        ) : null}
        {hadError ? (
          <Text size="xs" c="red">
            {t('Plugin widget unavailable')}
          </Text>
        ) : null}
      </Stack>
    </Card>
  );
}
