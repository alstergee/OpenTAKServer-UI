/**
 * Plugin SDK v2 — `kind: 'eud_action'` renderer.
 *
 * Renders one `<Menu.Item>` inside the EUDs row-action menu. On click
 * the component POSTs `{ eud_uid }` to the plugin's `endpoint` and
 * shows a Mantine notification with the response.
 *
 * Usage from `EUDs.tsx`:
 *
 * ```tsx
 * import { useMountsByKind } from '../plugin-sdk/mount-registry';
 * import MountEudAction from '../plugin-sdk/components/MountEudAction';
 *
 * const eudActions = useMountsByKind('eud_action');
 * // …inside the row-action <Menu.Dropdown>:
 * {eudActions.map((m) => (
 *   <MountEudAction key={m._plugin + m.label} mount={m} eud={row} />
 * ))}
 * ```
 *
 * Failure mode: a non-2xx response surfaces a red notification with
 * the server's `error`/`detail` field if present, falling back to the
 * raw axios error message.
 */
import { useState } from 'react';
import { Menu, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBolt, IconCheck, IconX } from '@tabler/icons-react';
import { t } from 'i18next';
import axios from '../../axios_config';
import type { EudActionMount } from '../types';

interface ActionResponse {
  /** Standard OTS success flag. */
  success?: boolean;
  /** Optional human-readable message; surfaced into the notification. */
  message?: string;
  /** Optional error-code echo (matches OTSPluginError convention). */
  error?: string;
  /** Optional detail string, free-form. */
  detail?: string;
}

interface Props {
  mount: EudActionMount;
  eud: { uid: string; callsign: string };
}

export default function MountEudAction({ mount, eud }: Props) {
  const [running, setRunning] = useState<boolean>(false);

  function trigger(): void {
    if (running) return;
    setRunning(true);
    axios
      .post<ActionResponse>(mount.endpoint, { eud_uid: eud.uid })
      .then((r) => {
        const data = r.data ?? {};
        const ok = data.success !== false; // default to success if flag absent
        if (ok) {
          notifications.show({
            title: mount.label,
            message:
              data.message ||
              t('Sent to {{callsign}}', { callsign: eud.callsign }),
            icon: <IconCheck />,
            color: 'green',
          });
        } else {
          notifications.show({
            title: mount.label,
            message: data.detail || data.error || t('Plugin reported failure'),
            icon: <IconX />,
            color: 'red',
          });
        }
      })
      .catch((err) => {
        const responseData: ActionResponse | undefined = err?.response?.data;
        notifications.show({
          title: mount.label,
          message:
            responseData?.detail ||
            responseData?.error ||
            err?.message ||
            t('Request failed'),
          icon: <IconX />,
          color: 'red',
        });
      })
      .finally(() => {
        setRunning(false);
      });
  }

  return (
    <Menu.Item
      leftSection={running ? <Loader size="xs" /> : <IconBolt size={16} />}
      disabled={running}
      onClick={trigger}
      title={`${mount.label} — ${mount._plugin}`}
      aria-label={mount.label}
    >
      {mount.label}
    </Menu.Item>
  );
}
