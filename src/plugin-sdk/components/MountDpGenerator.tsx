/**
 * Plugin SDK v2 — `kind: 'data_package_generator'` renderer.
 *
 * Adds a `<Menu.Item>` to the Data Packages page's action menu. Click
 * triggers a GET on `mount.endpoint`. The server-side handler can either:
 *
 *   * return JSON `{ url: "/api/data_packages/..." }` — we redirect the
 *     browser to that URL (so the standard download flow + auth applies);
 *   * return a binary blob (Content-Type: application/zip etc.) — we
 *     stash it in a Blob URL and trigger a client-side download.
 *
 * Either path works; plugins pick whichever fits their architecture.
 */
import { useState } from 'react';
import { Menu } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { IconDownload } from '@tabler/icons-react';
import axios from '../../axios_config';
import type { DataPackageGeneratorMount } from '../types';

export interface MountDpGeneratorProps {
  mount: DataPackageGeneratorMount;
}

interface UrlPayload {
  url: string;
  filename?: string;
}

/** Trigger a client-side download of `blob` named `filename`. */
function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  // Append to the DOM so Firefox honours the click; remove immediately after.
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Defer revoke so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Best-effort filename extraction from a `Content-Disposition` header. */
function filenameFromHeader(header: string | undefined, fallback: string): string {
  if (!header) return fallback;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  return match?.[1] ? decodeURIComponent(match[1]) : fallback;
}

export default function MountDpGenerator({ mount }: MountDpGeneratorProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await axios.get(mount.endpoint, { responseType: 'blob' });
      const contentType = String(res.headers?.['content-type'] ?? '');
      // JSON-redirect path: server signals "fetch this canonical URL instead".
      if (contentType.includes('application/json')) {
        const text = await (res.data as Blob).text();
        const parsed = JSON.parse(text) as UrlPayload;
        if (typeof parsed?.url !== 'string' || parsed.url.length === 0) {
          throw new Error('JSON response missing url');
        }
        // Use a regular anchor click so the browser handles auth + filenames.
        const link = document.createElement('a');
        link.href = parsed.url;
        if (parsed.filename) link.download = parsed.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const filename = filenameFromHeader(
          res.headers?.['content-disposition'] as string | undefined,
          `${mount._plugin}.zip`,
        );
        triggerBlobDownload(res.data as Blob, filename);
      }
      notifications.show({
        title: mount.label,
        message: t('Data package ready'),
        color: 'green',
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        `[plugin-sdk] data_package_generator failed for ${mount._plugin}`,
        err,
      );
      notifications.show({
        title: mount.label,
        message: t('Failed to generate data package'),
        color: 'red',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Menu.Item
      leftSection={<IconDownload size={14} />}
      onClick={handleClick}
      disabled={busy}
      aria-label={mount.label}
    >
      {mount.label}
    </Menu.Item>
  );
}
