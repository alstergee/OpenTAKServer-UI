/**
 * Plugin SDK v2 — `kind: 'toolbar_button'` renderer.
 *
 * Renders a single icon-button that lives in a global toolbar slot at the
 * top-right of the Header. Click sends a POST to `mount.endpoint`; the
 * server-side blueprint decides what that means for the plugin (queue a
 * job, push CoT, open a modal, etc.).
 *
 * The host Header reads `useMountsByKind('toolbar_button')` and renders
 * each in declared order. We export `MountToolbarButton` for the per-row
 * render and a convenience `<ToolbarButtonsSlot />` that the Header can
 * drop into place without iterating itself.
 */
import { useState } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { IconBolt } from '@tabler/icons-react';
import axios from '../../axios_config';
import { useMountsByKind } from '../mount-registry';
import type { ToolbarButtonMount } from '../types';

export interface MountToolbarButtonProps {
  mount: ToolbarButtonMount;
}

/** Single toolbar button. */
export function MountToolbarButton({ mount }: MountToolbarButtonProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await axios.post(mount.endpoint);
      notifications.show({
        title: mount.label,
        message: t('Action triggered'),
        color: 'green',
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        `[plugin-sdk] toolbar_button POST failed for ${mount._plugin}`,
        err,
      );
      notifications.show({
        title: mount.label,
        message: t('Plugin action failed'),
        color: 'red',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Tooltip label={mount.label} withArrow>
      <ActionIcon
        variant="subtle"
        color="paleBlue"
        size="lg"
        radius="md"
        loading={busy}
        onClick={handleClick}
        aria-label={mount.label}
      >
        <IconBolt size={18} />
      </ActionIcon>
    </Tooltip>
  );
}

/**
 * Full slot — drop into the Header. Renders every registered toolbar
 * button in registry order.
 */
export function ToolbarButtonsSlot() {
  const buttons = useMountsByKind('toolbar_button');
  return (
    <>
      {buttons.map((mount) => (
        <MountToolbarButton
          key={`${mount._plugin}:${mount._version}:${mount.label}`}
          mount={mount}
        />
      ))}
    </>
  );
}

export default MountToolbarButton;
