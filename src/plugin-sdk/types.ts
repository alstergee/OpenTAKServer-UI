/**
 * Plugin SDK v2 — UI-side type definitions.
 *
 * Mirrors the server-side Pydantic models in
 * `forks/OpenTAKServer/opentakserver/sdk/manifest.py` so that the runtime
 * mount registry and components can rely on a single, explicit shape per
 * mount kind.
 *
 * Conventions
 * -----------
 * * Every mount carries the server-injected `_plugin` (plugin slug) and
 *   `_version` (plugin version) fields — produced by
 *   `MountRegistry.serialize_for_ui()` on the server.
 * * `MountSpec` is a discriminated union on `kind`. Use TypeScript narrowing
 *   (`if (m.kind === 'tab')`) to unlock per-variant fields.
 * * Forward-compat: extra unknown fields the server may add are tolerated by
 *   keeping each variant as an interface (TypeScript ignores excess keys
 *   when narrowing through `kind`).
 */
export type Role = string;

/** Fields stamped onto every mount by the server before delivery. */
export interface MountServerMeta {
  /** Plugin slug — matches the manifest's `slug` (and pip dist name). */
  _plugin: string;
  /** Plugin version — matches the manifest's `version`. */
  _version: string;
}

export interface MountBase extends MountServerMeta {
  label: string;
  roles: Role[];
}

/** Mounts that occupy a UI route slot (path + optional icon). */
export interface RoutedMountBase extends MountBase {
  path: string;
  icon?: string | null;
}

/** Mounts that hit a server endpoint (data fetch / action). */
export interface EndpointMountBase extends MountBase {
  endpoint: string;
}

/** Server-only event-driven mounts (no UI surface). */
export interface EventHandlerMountBase extends MountBase {
  event: string;
  /** Python dotted path: `my.module:func` or `my.module.func`. */
  handler: string;
}

// --- routed (path) mounts ---------------------------------------------------

export interface TabMount extends RoutedMountBase {
  kind: 'tab';
}

export interface SubTabMount extends RoutedMountBase {
  kind: 'subtab';
  /** Host page slug (e.g. 'eud', 'map', 'settings'). */
  parent: string;
}

export interface FrameMount extends RoutedMountBase {
  kind: 'frame';
}

export interface NavbarGroupItemMount extends RoutedMountBase {
  kind: 'navbar_group_item';
}

// --- endpoint mounts --------------------------------------------------------

export interface MapOverlayMount extends EndpointMountBase {
  kind: 'map_overlay';
}

export interface MapDrawerMount extends EndpointMountBase {
  kind: 'map_drawer';
}

export interface DashboardWidgetMount extends EndpointMountBase {
  kind: 'dashboard_widget';
}

export interface CotHandlerMount extends EndpointMountBase {
  kind: 'cot_handler';
}

export interface EudActionMount extends EndpointMountBase {
  kind: 'eud_action';
}

export interface EudQrActionMount extends EndpointMountBase {
  kind: 'eud_qr_action';
}

export interface DataPackageGeneratorMount extends EndpointMountBase {
  kind: 'data_package_generator';
}

export interface ModalMount extends EndpointMountBase {
  kind: 'modal';
}

export interface ToolbarButtonMount extends EndpointMountBase {
  kind: 'toolbar_button';
}

export interface SettingsSectionMount extends EndpointMountBase {
  kind: 'settings_section';
}

// --- event-handler (server-only) mounts -------------------------------------

export interface NotificationHandlerMount extends EventHandlerMountBase {
  kind: 'notification_handler';
}

export interface MissionContentProviderMount extends EventHandlerMountBase {
  kind: 'mission_content_provider';
}

export interface SocketEventMount extends EventHandlerMountBase {
  kind: 'socket_event';
}

export interface MeshChannelHandlerMount extends EventHandlerMountBase {
  kind: 'mesh_channel_handler';
}

// --- specials ---------------------------------------------------------------

export interface BackgroundWorkerMount extends MountBase {
  kind: 'background_worker';
  /** apscheduler-compatible cron expression. */
  cron: string;
  /** Python dotted path. */
  handler: string;
}

export interface WebhookMount extends MountBase {
  kind: 'webhook';
  path: string;
  /** Optional env var name holding the HMAC secret used to sign payloads. */
  hmac_secret_env?: string | null;
}

export interface CliCommandMount extends MountBase {
  kind: 'cli_command';
  name: string;
  /** Python dotted path. */
  handler: string;
}

export interface AuthBackendMount extends MountBase {
  kind: 'auth_backend';
  name: string;
  /** Python dotted path. */
  handler: string;
}

/** Discriminated union over every supported `[[plugin.mount]]` kind. */
export type MountSpec =
  | TabMount
  | SubTabMount
  | FrameMount
  | NavbarGroupItemMount
  | MapOverlayMount
  | MapDrawerMount
  | DashboardWidgetMount
  | CotHandlerMount
  | EudActionMount
  | EudQrActionMount
  | DataPackageGeneratorMount
  | ModalMount
  | ToolbarButtonMount
  | SettingsSectionMount
  | NotificationHandlerMount
  | MissionContentProviderMount
  | SocketEventMount
  | MeshChannelHandlerMount
  | BackgroundWorkerMount
  | WebhookMount
  | CliCommandMount
  | AuthBackendMount;

/** Convenience alias for the `kind` literals. */
export type MountKind = MountSpec['kind'];

// ---------------------------------------------------------------------------
// /api/plugins/v2/installed response
// ---------------------------------------------------------------------------

export type MissionLevel = 'none' | 'read' | 'write';

/** Permissions table from the manifest's `[plugin.permissions]` block. */
export interface PluginPermissions {
  read: string[];
  write: string[];
  mesh: boolean;
  mission: MissionLevel;
  admin_routes: boolean;
}

/** A single installed plugin row, as returned by `/api/plugins/v2/installed`. */
export interface PluginInstalled {
  /** Plugin slug — primary key from the user's perspective. */
  slug: string;
  name: string;
  version: string;
  /** Latest known version (from marketplace metadata) — `null` if unknown. */
  latest_version: string | null;
  author: string;
  license: string;
  description: string;
  docs_url: string | null;
  /** Path (under `/api/plugins/v2/<slug>/icon`) or absolute URL — `null` if unset. */
  icon: string | null;
  /** Plugin SDK API version. `1` = vanilla legacy, `2` = SDK v2. */
  api_version: 1 | 2;
  /** True when the user has the plugin enabled (loader will activate it). */
  enabled: boolean;
  permissions: PluginPermissions;
  /** Distinct mount kinds declared in the manifest — used in the listing UI. */
  mount_kinds: MountKind[];
}

/** Response shape from `GET /api/plugins/v2/installed`. */
export interface PluginInstalledResponse {
  plugins: PluginInstalled[];
}

/** Response shape from `GET /api/plugins/v2/mounts`. */
export interface MountsResponse {
  mounts: MountSpec[];
}
