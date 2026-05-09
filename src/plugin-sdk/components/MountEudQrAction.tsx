/**
 * Plugin SDK v2 — `kind: 'eud_qr_action'` renderer.
 *
 * A row-level action on the EUDs / Markers tables: clicking opens a
 * modal containing a QR code that ATAK / iTAK can scan to receive
 * device-specific config (e.g. a video stream URL, a callsign mapping,
 * an enrolment token). The QR payload is fetched from
 * `mount.endpoint?eud_uid=<uid>` so plugins can vary the payload
 * per-EUD without a second round-trip.
 *
 * The endpoint is expected to return:
 *
 *   { qr: string, label?: string, hint?: string }
 *
 * `qr` is the literal payload encoded into the QR (string, since
 * react-qrcode-logo encodes anything you pass through `value`).
 */
import { useState } from 'react';
import {
  Center,
  Loader,
  Menu,
  Modal,
  Stack,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { IconQrcode } from '@tabler/icons-react';
import { QRCode } from 'react-qrcode-logo';
import axios from '../../axios_config';
import type { EudQrActionMount } from '../types';

interface QrPayload {
  qr: string;
  label?: string;
  hint?: string;
}

export interface MountEudQrActionProps {
  mount: EudQrActionMount;
  /** EUD UID of the row this action was triggered for. */
  eudUid: string;
}

export default function MountEudQrAction({ mount, eudUid }: MountEudQrActionProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qrData, setQrData] = useState<QrPayload | null>(null);

  const handleClick = async () => {
    setOpened(true);
    setLoading(true);
    setQrData(null);
    try {
      const res = await axios.get<QrPayload>(mount.endpoint, {
        params: { eud_uid: eudUid },
      });
      const qr = res.data?.qr;
      if (typeof qr !== 'string' || qr.length === 0) {
        throw new Error('Empty QR payload');
      }
      setQrData(res.data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        `[plugin-sdk] eud_qr_action fetch failed for ${mount._plugin}`,
        err,
      );
      notifications.show({
        title: mount.label,
        message: t('Failed to generate QR code'),
        color: 'red',
      });
      setOpened(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Menu.Item
        leftSection={<IconQrcode size={14} />}
        onClick={handleClick}
        aria-label={mount.label}
      >
        {mount.label}
      </Menu.Item>
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title={qrData?.label ?? mount.label}
        size="auto"
        centered
      >
        <Stack align="center" gap="sm">
          {loading || !qrData ? (
            <Center mih={350} miw={350}>
              <Loader />
            </Center>
          ) : (
            <>
              <QRCode
                value={qrData.qr}
                size={350}
                quietZone={10}
                eyeRadius={50}
                ecLevel="L"
                qrStyle="dots"
              />
              {qrData.hint ? (
                <Text size="sm" c="dimmed" ta="center" maw={350}>
                  {qrData.hint}
                </Text>
              ) : null}
            </>
          )}
        </Stack>
      </Modal>
    </>
  );
}
