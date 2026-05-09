import React, { Suspense } from 'react';
import { Route, Routes } from 'react-router';

// routes config
import { LoadingOverlay } from '@mantine/core';
import routes, { getPluginRoutes } from '../routes';
import PrivateRoute from '../PrivateRoute';
import { useMounts } from '../plugin-sdk/mount-registry';

const Error404 = React.lazy(() => import('../pages/Errors/Error404'));

/**
 * App's route table.
 *
 * Layout-route pattern: a single parent <Route> with no path renders
 * <PrivateRoute /> (the auth guard). Every actual page is a child of
 * that. This avoids the double-nested-path-with-splat bug where
 * registering parent and child both with `path="/plugin/<slug>/*"`
 * silently fails to match (react-router v6 doesn't allow more than one
 * splat segment in a resolved path, and the previous structure
 * effectively asked for two).
 *
 * Plugin tab routes are registered here as `/plugin/<slug>/*` so any
 * sub-path under a plugin's domain renders <MountTab>. The captured
 * splat is forwarded to the iframe via URL hash inside MountTab.
 */
export const AppContent = () => {
    // `useMounts()` re-renders this tree whenever the mount registry
    // changes (60s plugin loader poll, or an explicit refresh). That's
    // how a freshly installed plugin's tab route appears without a page
    // reload.
    useMounts();
    const pluginRoutes = getPluginRoutes();

    return (
        <Suspense fallback={<LoadingOverlay zIndex={1000} overlayProps={{ radius: 'sm', blur: 2 }} />}>
            <Routes>
                <Route element={<PrivateRoute />}>
                    {routes.map((route, idx) => (
                        route.element && (
                            <Route
                                key={`static-${idx}`}
                                path={route.path}
                                element={<route.element />}
                            />
                        )
                    ))}
                    {pluginRoutes.map((route) => (
                        route.mount && (
                            <Route
                                key={`plugin-${route.path}`}
                                path={route.path}
                                element={<route.element mount={route.mount} />}
                            />
                        )
                    ))}
                </Route>
                {/* Catch-all so unmatched URLs render the 404 page
                    instead of a blank content pane. Outside the auth
                    guard so the 404 also renders for unauthed visitors
                    on a typo'd URL. */}
                <Route path="*" element={<Error404 />} />
            </Routes>
        </Suspense>
    );
};

export default React.memo(AppContent);
