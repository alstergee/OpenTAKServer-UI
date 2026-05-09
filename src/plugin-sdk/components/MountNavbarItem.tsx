/**
 * Plugin SDK v2 — `kind: 'navbar_group_item'` renderer.
 *
 * Renders a Mantine `<NavLink>` that the host Navbar splices into one of its
 * existing groups (Admin, Plugins, …). The plugin manifest only declares
 * label / icon / path — the host UI decides which group it belongs to.
 *
 * Usage from the host Navbar:
 *
 *   const items = useMountsByKind('navbar_group_item');
 *   <NavLink label="Plugins">
 *     {items.map(m => <MountNavbarItem key={`${m._plugin}:${m.path}`} mount={m} />)}
 *   </NavLink>
 */
import React from 'react';
import { NavLink } from '@mantine/core';
import { Link, useLocation } from 'react-router';
import { t } from 'i18next';
import type { NavbarGroupItemMount } from '../types';
import { IconByName } from './icon-by-name';
import { isMountAllowed } from './role-gate';

export interface MountNavbarItemProps {
  mount: NavbarGroupItemMount;
}

export function MountNavbarItem({ mount }: MountNavbarItemProps): React.ReactElement | null {
  // Active-state hook must run unconditionally.
  const location = useLocation();

  if (!isMountAllowed(mount.roles)) {
    return null;
  }

  const active = location.pathname === mount.path;

  return (
    <NavLink
      component={Link}
      to={mount.path}
      label={t(mount.label)}
      active={active || undefined}
      leftSection={<IconByName iconName={mount.icon} stroke={1.5} size={18} />}
      aria-label={mount.label}
      title={mount.label}
    />
  );
}

export default MountNavbarItem;
