import { useEffect } from 'react';
import { useLocation } from 'react-router';

// Path-prefix → tab-title map. Order matters: longest prefix wins on lookup.
// Add new pages here when introducing routes; the lookup is centralised so
// every authed page gets a meaningful tab title without per-page boilerplate.
const ROUTE_TITLES: ReadonlyArray<readonly [string, string]> = [
    ['/dashboard', 'Dashboard'],
    ['/eud_stats', 'EUD Stats'],
    ['/euds', 'EUDs'],
    ['/alerts', 'Alerts'],
    ['/casevac', 'CASEVAC'],
    ['/data_packages', 'Data Packages'],
    ['/video_streams', 'Video Streams'],
    ['/video_recordings', 'Video Recordings'],
    ['/users', 'Users'],
    ['/groups', 'Groups'],
    ['/missions', 'Missions'],
    ['/plugin_updates', 'Plugin Updates'],
    ['/server_plugin_manager', 'Plugin Manager'],
    ['/scheduled_jobs', 'Scheduled Jobs'],
    ['/meshtastic', 'Mesh'],
    ['/device_profiles', 'Device Profiles'],
    ['/tf_setup', '2FA Setup'],
    ['/profile', 'Profile'],
    ['/link_takgov', 'TAK.gov Link'],
    ['/plugins/docs', 'Plugin Docs'],  // /plugins/docs → E.2 docs page (most specific)
    ['/plugins', 'Plugins'],   // /plugins → SDK v2 root listing page
    ['/plugin/', 'Plugin'],    // /plugin/<slug>/… → SDK v2 dynamic plugin tab
    ['/plugin', 'Plugin'],     // /plugin?name=… (legacy v1 iframe — least specific)
    ['/map', 'Map'],
];

/**
 * Update `document.title` whenever the route changes. Called once from
 * DefaultLayout (which wraps every authed route), so adding a new page
 * doesn't require touching that page's component — just append to
 * ROUTE_TITLES above. Falls back to "OpenTAKServer" alone for unknown paths.
 */
export function useRouteTitle(suffix = 'OpenTAKServer'): void {
    const location = useLocation();
    useEffect(() => {
        const path = location.pathname || '/';
        const match = ROUTE_TITLES.find(([prefix]) => path.startsWith(prefix));
        document.title = match ? `${match[1]} · ${suffix}` : suffix;
    }, [location.pathname, suffix]);
}

export default useRouteTitle;
