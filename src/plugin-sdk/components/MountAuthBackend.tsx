/**
 * Plugin SDK v2 — `kind: 'auth_backend'` renderer.
 *
 * Renders a button on the Login page below the standard email/password
 * form. Clicking navigates the browser to `mount.endpoint` — the plugin's
 * auth-flow start, which is responsible for redirecting back to the host
 * after a successful login.
 *
 * Used for OAuth / OIDC / SAML providers — anything that owns its own
 * redirect dance and doesn't fit the Flask-Security login form.
 *
 * The Login page reads `useMountsByKind('auth_backend')` and stacks each
 * button below the standard form.
 */
import { Button, Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { IconLogin2 } from '@tabler/icons-react';
import { useMountsByKind } from '../mount-registry';
import type { AuthBackendMount } from '../types';

export interface MountAuthBackendProps {
  mount: AuthBackendMount;
}

/**
 * The auth_backend mount uses `name` + `handler` to identify itself
 * server-side. The UI side needs a click target — so we synthesize the
 * start-flow URL from the standard plugin route prefix:
 *
 *   /api/plugins/<slug>/auth/<name>/start
 *
 * Plugins that need a different start path can declare a sibling
 * `tab` mount with the right path, but the convention above is
 * implemented by the Phase A loader and is the right default.
 */
function startUrlFor(mount: AuthBackendMount): string {
  return `/api/plugins/${mount._plugin}/auth/${mount.name}/start`;
}

/** Single auth-backend button. */
export function MountAuthBackend({ mount }: MountAuthBackendProps) {
  const { t } = useTranslation();
  const handleClick = () => {
    // Hard navigation — auth flows almost always involve a redirect dance
    // that React Router cannot intercept anyway. Use replace() so the
    // back-button doesn't bounce the user back into the login form.
    window.location.assign(startUrlFor(mount));
  };

  return (
    <Button
      variant="light"
      leftSection={<IconLogin2 size={16} />}
      fullWidth
      onClick={handleClick}
      title={t('Sign in via {{label}}', { label: mount.label })}
      aria-label={t('Sign in via {{label}}', { label: mount.label })}
    >
      {mount.label}
    </Button>
  );
}

/**
 * Convenience slot — drops the full stack of auth-backend buttons into the
 * Login page in one go. Renders nothing if no plugins declare an
 * `auth_backend` mount.
 */
export function AuthBackendsSlot() {
  const backends = useMountsByKind('auth_backend');
  if (backends.length === 0) return null;
  return (
    <Stack gap="xs" mt="md">
      {backends.map((mount) => (
        <MountAuthBackend
          key={`${mount._plugin}:${mount._version}:${mount.name}`}
          mount={mount}
        />
      ))}
    </Stack>
  );
}

export default MountAuthBackend;
