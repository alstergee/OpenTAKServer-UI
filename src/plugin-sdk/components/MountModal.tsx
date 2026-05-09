/**
 * Plugin SDK v2 — `kind: 'modal'` renderer + global modal host.
 *
 * Plugins declare a modal mount and expose its body via `mount.endpoint`
 * (an HTML page rendered inside an iframe). Any code in the host UI can
 * then trigger that modal by slug, regardless of which page is active.
 *
 *   import { useGlobalModal } from '../plugin-sdk/components/MountModal';
 *
 *   const { open, close } = useGlobalModal(myModalMount);
 *   <Button onClick={open}>{t('Pick file')}</Button>
 *
 * The host wires `<GlobalModalsHost />` once at the App root so that *all*
 * registered modal mounts have a live `<Modal>` in the React tree. Plugins
 * that don't open their modal stay invisible.
 *
 * `OTS.modal.open(slug)` — exported below — is the imperative API plugin
 * code can call from anywhere (e.g. from a notification handler).
 */
import { useCallback, useEffect, useState } from 'react';
import { Box, Modal } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useMountsByKind } from '../mount-registry';
import type { ModalMount } from '../types';

/** Internal pub/sub for `OTS.modal.open(slug)` — keeps the host reactive. */
type OpenListener = (slug: string) => void;
const openListeners = new Set<OpenListener>();

function emitOpen(slug: string): void {
  for (const listener of Array.from(openListeners)) {
    try {
      listener(slug);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[plugin-sdk] modal open listener threw:', err);
    }
  }
}

/**
 * Imperative API. Plugins call this from anywhere — including non-React
 * contexts — to pop their modal. The slug is the plugin slug; the host
 * matches it against the registered modal mounts and shows the first one.
 */
export const otsModal = {
  open(slug: string): void {
    emitOpen(slug);
  },
};

/**
 * Hook for a *specific* modal mount. Returns the same `{ open, close,
 * isOpen }` triple regardless of whether the host has rendered the modal
 * yet — keeping the call-site stable.
 */
export interface UseGlobalModalResult {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

export function useGlobalModal(mount: ModalMount): UseGlobalModalResult {
  const [isOpen, setIsOpen] = useState(false);

  // React to imperative `OTS.modal.open(slug)` calls.
  useEffect(() => {
    const listener: OpenListener = (slug) => {
      if (slug === mount._plugin) setIsOpen(true);
    };
    openListeners.add(listener);
    return () => {
      openListeners.delete(listener);
    };
  }, [mount._plugin]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  return { open, close, isOpen };
}

export interface MountModalProps {
  mount: ModalMount;
}

/**
 * One `<Modal>` per registered modal mount. Rendered by `<GlobalModalsHost />`
 * — not used directly by plugin code.
 */
export function MountModal({ mount }: MountModalProps) {
  const { t } = useTranslation();
  const { isOpen, close } = useGlobalModal(mount);

  return (
    <Modal
      opened={isOpen}
      onClose={close}
      title={mount.label}
      size="lg"
      centered
      aria-label={t('Plugin modal: {{label}}', { label: mount.label })}
    >
      {/* iframe sandboxed so plugin content can't steal focus or rewrite the host. */}
      <Box
        component="iframe"
        src={mount.endpoint}
        title={mount.label}
        sandbox="allow-scripts allow-forms allow-same-origin"
        style={{
          width: '100%',
          height: '60vh',
          border: 0,
          borderRadius: 'var(--mantine-radius-md)',
        }}
      />
    </Modal>
  );
}

/**
 * Global host — drop *once* at the App root (`App.tsx`). Subscribes to the
 * mount registry and renders one `<MountModal>` per registered modal mount.
 */
export function GlobalModalsHost() {
  const modals = useMountsByKind('modal');
  return (
    <>
      {modals.map((mount) => (
        <MountModal
          key={`${mount._plugin}:${mount._version}:${mount.label}`}
          mount={mount}
        />
      ))}
    </>
  );
}

export default MountModal;
