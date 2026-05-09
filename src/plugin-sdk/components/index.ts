/**
 * Plugin SDK v2 — mount-component barrel.
 *
 * Re-exports the mount-kind renderers so host pages can import everything
 * from `'plugin-sdk/components'` instead of digging into per-file paths.
 *
 * Coverage (2026-05-09):
 *   * B.3a — Tab, SubTab, Frame, NavbarGroupItem
 *   * B.3b — MapOverlay, MapDrawer, CotHandler, EudAction
 *   * B.3c — DashboardWidget, Modal, ToolbarButton, SettingsSection,
 *            EudQrAction, DpGenerator, AuthBackend
 *   * helpers — `IconByName`, `role-gate` predicates
 */

// --- B.3a — routed (path) mounts -------------------------------------------
export {
  default as MountTab,
  MountTab as MountTabComponent,
} from './MountTab';
export type { MountTabProps } from './MountTab';

export {
  default as MountSubTab,
  MountSubTab as MountSubTabComponent,
  getSubTabs,
} from './MountSubTab';
export type { MountSubTabProps } from './MountSubTab';

export {
  default as MountFrame,
  MountFrame as MountFrameComponent,
} from './MountFrame';
export type { MountFrameProps } from './MountFrame';

export {
  default as MountNavbarItem,
  MountNavbarItem as MountNavbarItemComponent,
} from './MountNavbarItem';
export type { MountNavbarItemProps } from './MountNavbarItem';

// --- B.3b — map / EUD / CoT mounts -----------------------------------------
export { default as MountMapOverlay } from './MountMapOverlay';

export {
  default as MountMapDrawer,
  getMapDrawerSections,
} from './MountMapDrawer';

export {
  default as MountCotHandler,
  cotHandlerRegistry_api,
  useCotHandlerRegistration,
} from './MountCotHandler';
export type { CotHandlerEntry } from './MountCotHandler';

export { default as MountEudAction } from './MountEudAction';

// --- B.3c — endpoint + global UI mount renderers ---------------------------
export { default as MountDashboardWidget } from './MountDashboardWidget';
export type { MountDashboardWidgetProps } from './MountDashboardWidget';

export {
  default as MountModal,
  GlobalModalsHost,
  useGlobalModal,
  otsModal,
} from './MountModal';
export type {
  MountModalProps,
  UseGlobalModalResult,
} from './MountModal';

export {
  default as MountToolbarButton,
  ToolbarButtonsSlot,
} from './MountToolbarButton';
export type { MountToolbarButtonProps } from './MountToolbarButton';

export {
  default as MountSettingsSection,
  getSettingsSections,
} from './MountSettingsSection';
export type { MountSettingsSectionProps } from './MountSettingsSection';

export { default as MountEudQrAction } from './MountEudQrAction';
export type { MountEudQrActionProps } from './MountEudQrAction';

export { default as MountDpGenerator } from './MountDpGenerator';
export type { MountDpGeneratorProps } from './MountDpGenerator';

export {
  default as MountAuthBackend,
  AuthBackendsSlot,
} from './MountAuthBackend';
export type { MountAuthBackendProps } from './MountAuthBackend';

// --- helpers ---------------------------------------------------------------
export { IconByName } from './icon-by-name';
export type { IconByNameProps } from './icon-by-name';

export { getCurrentUserRoles, isMountAllowed } from './role-gate';
