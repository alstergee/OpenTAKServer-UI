import React, { Suspense } from 'react';
import { Route, Routes } from 'react-router';

// routes config
import { LoadingOverlay } from '@mantine/core';
import routes, { getPluginRoutes } from '../routes';
import PrivateRoute from '../PrivateRoute';
import { useMounts } from '../plugin-sdk/mount-registry';

export const AppContent = () => {
    // `useMounts()` re-renders this tree whenever the mount registry changes
    // (60s plugin loader poll, or an explicit refresh). That's how a freshly
    // installed plugin's tab route appears without a page reload.
    useMounts();
    const pluginRoutes = getPluginRoutes();

    return (
        <Suspense fallback={<LoadingOverlay zIndex={1000} overlayProps={{ radius: 'sm', blur: 2 }} />}>
            <Routes>
                {routes.map((route, idx) => (
                    route.element && (
                        <Route path={route.path} key={`static-${idx}`} element={<PrivateRoute />}>
                            <Route
                                key={`static-inner-${idx}`}
                                path={route.path}
                                element={<route.element />}
                            />
                        </Route>
                    )
                ))}
                {pluginRoutes.map((route) => (
                    route.mount && (
                        <Route path={route.path} key={`plugin-${route.path}`} element={<PrivateRoute />}>
                            <Route
                                key={`plugin-inner-${route.path}`}
                                path={route.path}
                                element={<route.element mount={route.mount} />}
                            />
                        </Route>
                    )
                ))}
                <Route path="/" element={<PrivateRoute />} />
            </Routes>
        </Suspense>
    );
};

export default React.memo(AppContent);
