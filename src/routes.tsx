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
  { path: '/link_account', name: 'Link TAK.gov Account', element: LinkTAKGovAccount },
  { path: '/profile/', name: 'User Profile', element: UserProfile },
  { path: '/profile/:username', name: 'User Profile', element: UserProfile },
];

/**
 * Build the dynamic route table for installed plugins' `kind: 'tab'` mounts.
 *
 * Each tab mount becomes a real client-side route at
 * `/plugin/<slug><mount.path>` rendering `<MountTab mount={spec} />`. The
 * caller (`AppContent.tsx`) reads this on every render via the `useMounts`
 * hook so installs/uninstalls reflect without a page reload.
 */
export function getPluginRoutes(): RouteEntry[] {
  const tabs = mountRegistry.byKind('tab');
  const seen = new Set<string>();
  const out: RouteEntry[] = [];
  for (const mount of tabs) {
    const slug = encodeURIComponent(mount._plugin);
    // mount.path is allowed to start with `/`; normalise so the joined path
    // is exactly one slash between segments.
    const tail = mount.path.startsWith('/') ? mount.path : `/${mount.path}`;
    const fullPath = `/plugin/${slug}${tail}`;
    if (seen.has(fullPath)) continue;
    seen.add(fullPath);
    out.push({
      path: fullPath,
      name: `Plugin: ${mount._plugin}`,
      element: MountTab,
      mount,
    });
  }
  return out;
}

export default routes;
