/**
 * Legacy redirect for the retired /plugin?name=<distro> URL pattern.
 *
 * Old bookmarks and the pre-2026-05-09 navbar pointed at this URL to
 * load a plugin's iframe via the deleted Plugin.tsx page. The v2
 * dynamic route table now lives at /plugin/<slug>/* with hyphens
 * instead of underscores. We translate distro→slug by looking up the
 * v2 mount registry, falling back to a naïve _→- swap, and finally
 * routing to /plugins (the management page) if nothing matches.
 *
 * Sentinel: PluginLegacyRedirect:v1
 */
import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { LoadingOverlay } from '@mantine/core';
import { mountRegistry, useMounts } from '../plugin-sdk/mount-registry';

function resolveSlug(name: string): string | null {
  // Exact match against an installed v2 plugin's slug.
  const direct = mountRegistry.byPlugin(name);
  if (direct.length > 0) return name;

  // Distro names typically use underscores (`ots_mapmarker_plugin`)
  // while v2 slugs use hyphens (`ots-mapmarker-plugin`). Try the
  // common normalization.
  const normalized = name.replace(/_/g, '-');
  if (normalized !== name && mountRegistry.byPlugin(normalized).length > 0) {
    return normalized;
  }

  return null;
}

export default function PluginLegacyRedirect(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // Subscribe to the registry so an in-flight registry load completes
  // before we make the routing decision (otherwise a hard-refresh of a
  // legacy URL might kick us to /plugins on a cold cache).
  useMounts();

  useEffect(() => {
    const name = (searchParams.get('name') ?? '').trim();
    if (!name) {
      navigate('/plugins', { replace: true });
      return;
    }
    const slug = resolveSlug(name);
    if (slug) {
      navigate(`/plugin/${encodeURIComponent(slug)}/`, { replace: true });
    } else {
      // Unknown name — bounce to the plugins management page rather than
      // 404 the user. They'll see whether the plugin is actually installed.
      navigate('/plugins', { replace: true });
    }
  }, [searchParams, navigate]);

  return <LoadingOverlay zIndex={1000} overlayProps={{ radius: 'sm', blur: 2 }} />;
}
