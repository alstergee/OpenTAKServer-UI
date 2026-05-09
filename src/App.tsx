import '@mantine/core/styles.css';
import { localStorageColorSchemeManager, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { BrowserRouter, Route, Routes } from 'react-router';
import React from 'react';
import { theme } from './theme';
import '@mantine/notifications/styles.css';
import '@mantine/charts/styles.css';
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import '@mantine/dates/styles.css';
import 'mantine-datatable/styles.css';
import './i18n';
import {I18nextProvider, useTranslation} from "react-i18next";

const Login = React.lazy(() => import('./pages/Login/Login'));
const Error404 = React.lazy(() => import('./pages/Errors/Error404'));
const DefaultLayout = React.lazy(() => import('./DefaultLayout'));
const PasswordReset = React.lazy(() => import('./pages/PasswordReset'));
// Plugin SDK v2 — global modal host. Subscribes to the mount registry and
// renders one `<MountModal>` per registered `kind: 'modal'` mount so plugin
// code anywhere in the tree can open them via the `otsModal.open(slug)` API.
const GlobalModalsHost = React.lazy(() =>
  import('./plugin-sdk/components/MountModal').then((m) => ({ default: m.GlobalModalsHost })),
);

// Persist color scheme across logins. Mantine 7+ does NOT auto-save without an
// explicit colorSchemeManager — that's why the toggle reset to light on every
// session. Default to dark on first visit (festival ops happen in dim tents).
const colorSchemeManager = localStorageColorSchemeManager({ key: 'ots-color-scheme' });

// Stale-bundle recovery. After a deploy, the browser's cached index.html may
// reference chunk hashes that no longer exist on disk. The new nginx config
// 404s those instead of falling back to index.html (so we get a clean module
// load failure instead of a strict-MIME error). When that fires, force a
// one-shot reload to pick up the new index.html. sessionStorage flag prevents
// loops if the chunks really are missing.
if (typeof window !== 'undefined') {
    const recover = () => {
        if (sessionStorage.getItem('ots-preload-reloaded') === '1') return;
        sessionStorage.setItem('ots-preload-reloaded', '1');
        window.location.reload();
    };
    window.addEventListener('vite:preloadError', recover);
    window.addEventListener('error', (ev) => {
        const msg = String((ev as ErrorEvent)?.message || '');
        if (msg.includes('dynamically imported module') ||
            msg.includes('Failed to load module script')) recover();
    });
    // Clear the guard once we've stayed up for 10s — by then we know the
    // reload actually fixed it and a future deploy can recover again.
    setTimeout(() => sessionStorage.removeItem('ots-preload-reloaded'), 10000);
}

export default function App() {
    const { t, i18n } = useTranslation();

  return (
    <I18nextProvider i18n={i18n}>
        <MantineProvider
          theme={theme}
          defaultColorScheme="dark"
          colorSchemeManager={colorSchemeManager}
        >
          <Notifications />
          <BrowserRouter>
              <React.Suspense fallback={null}>
                  <GlobalModalsHost />
              </React.Suspense>
              <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/404" element={<Error404 />} />
                  <Route path="/reset" element={<PasswordReset />} />
                  {/*<Route path="/register" name="Register Page" element={<Register />} />
                  <Route path="/500" name="Page 500" element={<Page500 />} />*/}
                  <Route path="*" element={<DefaultLayout />} />
              </Routes>
          </BrowserRouter>
        </MantineProvider>
    </I18nextProvider>
  );
}
