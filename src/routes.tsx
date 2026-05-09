import React from 'react';
import { mountRegistry } from './plugin-sdk/mount-registry';
import type { TabMount } from './plugin-sdk/types';

const Login = React.lazy(() => import('./pages/Login/Login'));
const Error404 = React.lazy(() => import('./pages/Errors/Error404'));
const Dashboard = React.lazy(() => import('./pages/Dashboard/Dashboard'));
const Map = React.lazy(() => import('./pages/Map/Map'));
const EUDs = React.lazy(() => import('./pages/EUDs'));
const Casevac = React.lazy(() => import('./pages/Casevac'));
const DataPackages = React.lazy(() => import('./pages/DataPackages'));
const VideoStreams = React.lazy(() => import('./pages/VideoStreams'));
const Users = React.lazy(() => import('./pages/Users'));
const TFASetup = React.lazy(() => import('./pages/TFASetup'));
const Alerts = React.lazy(() => import('./pages/Alerts'));
const PasswordReset = React.lazy(() => import('./pages/PasswordReset'));
const ScheduledJobs = React.lazy(() => import('./pages/ScheduledJobs'));
const VideoRecordings = React.lazy(() => import('./pages/VideoRecordings'));
const Meshtastic = React.lazy(() => import('./pages/Meshtastic'));
const DeviceProfiles = React.lazy(() => import('./pages/DeviceProfiles'));
const Missions = React.lazy(() => import('./pages/Missions'))
const Groups = React.lazy(() => import('./pages/Groups'))
const EUDStats = React.lazy(() => import('./pages/EUDStats'));
const Plugins = React.lazy(() => import('./pages/Plugins'));
const PluginsDocs = React.lazy(() => import('./pages/PluginsDocs'));
const PluginLegacyRedirect = React.lazy(() => import('./pages/PluginLegacyRedirect'));
const LinkTAKGovAccount = React.lazy(() => import('./pages/LinkTakGov.tsx'));
const UserProfile = React.lazy(() => import('./pages/UserProfile.tsx'));
const MountTab = React.lazy(() => import('./plugin-sdk/components/MountTab'));

/**
 * Route table entry shape consumed by `AppContent.tsx`. Lazy-loaded React
 * components live under `element`. `mount` is set on plugin-supplied dynamic
 * routes so the renderer knows which `MountSpec` to feed into `<MountTab>`.
 */
export interface RouteEntry {
  path: string;
  name: string;
  exact?: boolean;
  element: React.LazyExoticComponent<React.ComponentType<any>>;
  /** Plugin mount spec — present only on dynamic plugin routes. */
  mount?: TabMount;
}

const routes: RouteEntry[] = [
  { path: '/', exact: true, name: 'Home', element: Dashboard },
  { path: '/login', name: 'Login', element: Login },
  { path: '/404', name: '404', element: Error404 },
  { path: '/dashboard', name: 'Dashboard', element: Dashboard },
  { path: '/euds', name: 'EUDs', element: EUDs },
  { path: '/map', name: 'Map', element: Map },
  { path: '/alerts', name: 'Alerts', element: Alerts },
  { path: '/casevac', name: 'CasEvac', element: Casevac },
  { path: '/data_packages', name: 'DataPackages', element: DataPackages },
  { path: '/video_streams', name: 'VideoStreams', element: VideoStreams },
  { path: '/users', name: 'Users', element: Users },
  { path: '/tfa_setup', name: '2FA Setup', element: TFASetup },
  { path: '/reset', name: 'Password Reset', element: PasswordReset },
  { path: '/jobs', name: 'Scheduled Jobs', element: ScheduledJobs },
  { path: '/video_recordings', name: 'Video Recordings', element: VideoRecordings },
  { path: '/meshtastic', name: 'Meshtastic', element: Meshtastic },
  { path: '/device_profiles', name: 'DeviceProfiles', element: DeviceProfiles },
  { path: '/missions', name: 'Missions', element: Missions },
  { path: '/groups', name: 'Groups', element: Groups },
  { path: '/eud_stats', name: 'EUDStats', element: EUDStats },
  { path: '/plugins', name: 'Plugins', element: Plugins },
  { path: '/plugins/docs', name: 'Plugin Docs', element: PluginsDocs },
  // Legacy redirect — /plugin?name=<distro> bounces to /plugin/<slug>/.
  { path: '/plugin', name: 'Plugin (legacy)', element: PluginLegacyRedirect },
  { path: '/link_account', name: 'Link TAK.gov Account', element: LinkTAKGovAccount },
  { path: '/profile/', name: 'User Profile', element: UserProfile },
  { path: '/profile/:username', name: 'User Profile', element: UserProfile },
];

/**
 * Build the dynamic route table for installed plugins' `kind: 'tab'` mounts.
 *
 * Each plugin gets ONE wildcard route at `/plugin/<slug>/*` so any sub-path
 * under the plugin's domain renders `<MountTab>`. The captured splat is
 * forwarded to the iframe via URL hash (so the plugin's static UI can
 * react to deep links without server-side per-subpath routes).
 *
 * Why a single wildcard per plugin instead of one route per tab mount: the
 * iframe handles its own internal navigation, so we don't need to register
 * each declared tab path as a distinct dashboard route. If a plugin ships
 * multiple tab mounts, the first one wins for hosting; the others still
 * appear in the navbar via their `kind: 'navbar_group_item'` mounts.
 *
 * Reactive: `AppContent.tsx` calls this on every render via `useMounts()`,
 * so installing/removing a plugin updates the route table without reload.
 */
export function getPluginRoutes(): RouteEntry[] {
  const tabs = mountRegistry.byKind('tab');
  const seenSlugs = new Set<string>();
  const out: RouteEntry[] = [];
  for (const mount of tabs) {
    if (seenSlugs.has(mount._plugin)) continue;
    seenSlugs.add(mount._plugin);
    const slug = encodeURIComponent(mount._plugin);
    out.push({
      path: `/plugin/${slug}/*`,
      name: `Plugin: ${mount._plugin}`,
      element: MountTab,
      mount,
    });
  }
  return out;
}

export default routes;
