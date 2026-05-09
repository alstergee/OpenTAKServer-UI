/**
 * Plugin SDK v2 — role-gating helper used by mount components.
 *
 * A mount declares its required `roles` array in the manifest. Empty or
 * `["any"]` → no gating. Otherwise the current user must hold at least one
 * of the listed roles for the mount to render.
 *
 * Source of truth for the user's roles: the dashboard stores at minimum the
 * `administrator` flag in `localStorage` after `/api/me` resolves. A future
 * enhancement could store the full role array as JSON; this helper handles
 * either shape safely.
 */
import type { Role } from '../types';

/**
 * Read the current user's roles from `localStorage`.
 *
 * Looks for `localStorage.roles` first (JSON array — future-proof). Falls
 * back to the binary `administrator=true` flag the dashboard sets today.
 * Always returns an array (possibly empty) — never throws.
 */
export function getCurrentUserRoles(): Role[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem('roles');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((r): r is string => typeof r === 'string');
      }
    }
  } catch {
    // bad JSON — fall through to the legacy boolean flag
  }
  const isAdmin = window.localStorage.getItem('administrator') === 'true';
  return isAdmin ? ['administrator'] : [];
}

/**
 * True when the current user is allowed to see a mount with the given
 * required roles. Open to all if the list is empty or contains `"any"`.
 */
export function isMountAllowed(requiredRoles: Role[] | undefined | null): boolean {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  if (requiredRoles.includes('any')) return true;
  const userRoles = getCurrentUserRoles();
  if (userRoles.length === 0) return false;
  return requiredRoles.some((r) => userRoles.includes(r));
}
