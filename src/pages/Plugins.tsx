/**
 * Plugins root page (Plugin SDK v2 — phase B.4).
 *
 * Replaces the legacy `Plugin.tsx` / `PluginUpdates.tsx` /
 * `ServerPluginManager.tsx` triplet with a single Mantine 8 surface that
 * lists installed plugins, their mounts/scopes, and lets administrators
 * install / update / remove / enable / disable them.
 *
 * Design ref: `/docker/opentak/PLUGIN-SDK-V2.md` — "Plugins tab — the new UX".
 *
 * Sentinel string for build verification: "PluginsRootPage:v2".
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Center,
  Code,
  Divider,
  Group,
  Loader,
  Menu,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconBookmark,
  IconCheck,
  IconCirclePlus,
  IconCode,
  IconDots,
  IconDownload,
  IconFileText,
  IconPlayerPause,
  IconPlayerPlay,
  IconPuzzle,
  IconRefresh,
  IconSettings,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { t } from 'i18next';

import axios from '../axios_config';
import { apiRoutes } from '../apiRoutes';
import { IconByName } from '../plugin-sdk/components/icon-by-name';
import { usePageTitle } from '../usePageTitle';

// ---------------------------------------------------------------------------
// Server response shapes — mirrors `_v2_plugin_summary` /
// `_vanilla_plugin_summary` in `plugins_v2_api.py`. NOTE: this is the
// *actual* shape the server emits today (sdk / version_latest / scopes);
// the SDK-local `PluginInstalled` in `plugin-sdk/types.ts` is an older
// shape kept for cross-component consumers and is NOT used here.
// ---------------------------------------------------------------------------

type PluginSdkLevel = 'v1' | 'v2';
type MissionLevel = 'none' | 'read' | 'write';

interface PluginScopes {
  read: string[];
  write: string[];
  mesh: boolean;
  mission: MissionLevel;
  admin_routes: boolean;
}

interface InstalledPluginRow {
  slug: string;
  name: string;
  version: string;
  version_latest: string | null;
  description: string;
  icon: string | null;
  docs_url: string | null;
  sdk: PluginSdkLevel;
  mounts: string[];
  scopes: PluginScopes;
  enabled: boolean;
}

interface InstalledResponse {
  plugins: InstalledPluginRow[];
}

/** Marketplace entry shape — kept flexible since the marketplace JSON
 *  authors aren't fully constrained yet (E.3 will lock the contract). */
interface MarketplaceEntry {
  slug?: string;
  name?: string;
  version?: string;
  description?: string;
  source?: string;
  icon?: string | null;
  docs_url?: string | null;
}

interface MarketplaceResponse {
  plugins?: MarketplaceEntry[];
}

const INSTALLED_POLL_MS = 30_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function errorMessage(err: unknown, fallback: string): string {
  // Axios errors expose the server JSON body at err.response.data; we look
  // for {error, detail} (v2 contract) and fall back to a string-ish render.
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: unknown } }).response;
    const data = response?.data;
    if (data && typeof data === 'object') {
      const detail = (data as { detail?: unknown }).detail;
      const errCode = (data as { error?: unknown }).error;
      if (typeof detail === 'string' && detail.trim()) return detail;
      if (typeof errCode === 'string' && errCode.trim()) return errCode;
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function summarizeMounts(mounts: string[]): string {
  if (!mounts || mounts.length === 0) return t('No mounts');
  const counts = new Map<string, number>();
  mounts.forEach((m) => counts.set(m, (counts.get(m) ?? 0) + 1));
  const parts: string[] = [];
  counts.forEach((count, kind) => {
    parts.push(`${count} ${kind}`);
  });
  return parts.join(' · ');
}

function summarizeScopes(scopes: PluginScopes): string {
  const reads = scopes.read.length ? scopes.read.join(', ') : t('none');
  const writes = scopes.write.length ? scopes.write.join(', ') : t('none');
  const mission = scopes.mission || 'none';
  return t('Reads: {{reads}} · Writes: {{writes}} · Mission: {{mission}}', {
    reads,
    writes,
    mission,
  });
}

function configurePathFor(plugin: InstalledPluginRow): string {
  // v2 plugins get a real route, vanilla plugins keep the legacy ?name= page.
  return plugin.sdk === 'v2'
    ? `/plugin/${encodeURIComponent(plugin.slug)}/config`
    : `/plugin?name=${encodeURIComponent(plugin.slug)}`;
}

// ---------------------------------------------------------------------------
// Plugin row
// ---------------------------------------------------------------------------

interface PluginRowProps {
  plugin: InstalledPluginRow;
  onConfigure: (p: InstalledPluginRow) => void;
  onUpdate: (p: InstalledPluginRow) => void;
  onRemove: (p: InstalledPluginRow) => void;
  onToggleEnabled: (p: InstalledPluginRow) => void;
  onViewManifest: (p: InstalledPluginRow) => void;
  onViewLog: (p: InstalledPluginRow) => void;
  busy: boolean;
}

function PluginRow({
  plugin,
  onConfigure,
  onUpdate,
  onRemove,
  onToggleEnabled,
  onViewManifest,
  onViewLog,
  busy,
}: PluginRowProps): React.ReactElement {
  const hasUpdate =
    plugin.version_latest !== null &&
    plugin.version_latest !== undefined &&
    plugin.version_latest !== plugin.version;

  const sdkBadgeLabel = plugin.sdk === 'v2' ? t('SDK v2') : t('vanilla — SDK v1');

  return (
    <Card
      withBorder
      radius="md"
      padding="md"
      aria-label={t('Plugin {{name}}', { name: plugin.name })}
    >
      <Group align="flex-start" wrap="nowrap" gap="md">
        <IconByName iconName={plugin.icon ?? null} size={36} stroke={1.5} />
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Group justify="space-between" wrap="nowrap" align="flex-start">
            <Stack gap={2}>
              <Group gap="xs" align="baseline" wrap="nowrap">
                <Title order={4}>{plugin.name}</Title>
                <Text size="sm" c="dimmed">
                  v{plugin.version}
                </Text>
                {hasUpdate && (
                  <Text size="sm" c="var(--mantine-primary-color-filled)">
                    ({plugin.version_latest} {t('latest')})
                  </Text>
                )}
              </Group>
              {plugin.description && (
                <Text size="sm" c="dimmed">
                  {plugin.description}
                </Text>
              )}
            </Stack>

            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  aria-label={t('More actions for {{name}}', { name: plugin.name })}
                  title={t('More actions')}
                >
                  <IconDots size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {plugin.sdk === 'v2' && (
                  <Menu.Item
                    leftSection={<IconCode size={16} />}
                    onClick={() => onViewManifest(plugin)}
                  >
                    {t('View Manifest')}
                  </Menu.Item>
                )}
                <Menu.Item
                  leftSection={<IconFileText size={16} />}
                  onClick={() => onViewLog(plugin)}
                >
                  {t('View Logs')}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={
                    plugin.enabled ? (
                      <IconPlayerPause size={16} />
                    ) : (
                      <IconPlayerPlay size={16} />
                    )
                  }
                  onClick={() => onToggleEnabled(plugin)}
                  disabled={plugin.sdk !== 'v2'}
                >
                  {plugin.enabled ? t('Disable') : t('Enable')}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>

          <Group gap="xs" mt="xs">
            <Badge
              variant="light"
              color={plugin.sdk === 'v2' ? 'paleBlue' : 'gray'}
              radius="sm"
            >
              {sdkBadgeLabel}
            </Badge>
            <Badge
              variant="light"
              color={plugin.enabled ? 'green' : 'gray'}
              radius="sm"
            >
              {plugin.enabled ? t('enabled') : t('disabled')}
            </Badge>
            {plugin.mounts.length > 0 && (
              <Text size="xs" c="dimmed">
                {t('Mounts:')} {summarizeMounts(plugin.mounts)}
              </Text>
            )}
          </Group>

          <Text size="xs" c="dimmed" mt={4}>
            {summarizeScopes(plugin.scopes)}
          </Text>

          <Group gap="xs" mt="sm">
            <Button
              size="xs"
              variant="default"
              leftSection={<IconSettings size={14} />}
              onClick={() => onConfigure(plugin)}
              aria-label={t('Configure {{name}}', { name: plugin.name })}
            >
              {t('Configure')}
            </Button>
            {hasUpdate && (
              <Button
                size="xs"
                variant="filled"
                color="paleBlue"
                leftSection={<IconRefresh size={14} />}
                onClick={() => onUpdate(plugin)}
                loading={busy}
                aria-label={t('Update {{name}} to {{version}}', {
                  name: plugin.name,
                  version: plugin.version_latest ?? '',
                })}
              >
                {t('Update → {{version}}', { version: plugin.version_latest })}
              </Button>
            )}
            <Button
              size="xs"
              variant="light"
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={() => onRemove(plugin)}
              aria-label={t('Remove {{name}}', { name: plugin.name })}
            >
              {t('Remove')}
            </Button>
          </Group>
        </Stack>
      </Group>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Add-plugin modal (paste source / browse marketplace)
// ---------------------------------------------------------------------------

interface AddPluginModalProps {
  opened: boolean;
  onClose: () => void;
  marketplace: MarketplaceEntry[];
  marketplaceLoading: boolean;
  onInstallSource: (source: string) => Promise<void>;
  installing: boolean;
}

function AddPluginModal({
  opened,
  onClose,
  marketplace,
  marketplaceLoading,
  onInstallSource,
  installing,
}: AddPluginModalProps): React.ReactElement {
  const [source, setSource] = useState('');

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('Add plugin')}
      size="lg"
      centered
    >
      <Tabs defaultValue="paste">
        <Tabs.List>
          <Tabs.Tab value="paste" leftSection={<IconCirclePlus size={14} />}>
            {t('Paste manifest URL / pip spec')}
          </Tabs.Tab>
          <Tabs.Tab value="marketplace" leftSection={<IconBookmark size={14} />}>
            {t('Browse marketplace')}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="paste" pt="md">
          <Stack gap="sm">
            <TextInput
              label={t('Source')}
              description={t(
                'A pip-installable spec: package name, wheel URL, or git+https URL'
              )}
              placeholder="ots-mapmarker-plugin"
              value={source}
              onChange={(e) => setSource(e.currentTarget.value)}
              aria-label={t('Plugin source')}
            />
            <Group justify="flex-end">
              <Button
                onClick={() => {
                  void onInstallSource(source).then(() => setSource(''));
                }}
                disabled={!source.trim()}
                loading={installing}
                leftSection={<IconDownload size={14} />}
              >
                {t('Install')}
              </Button>
            </Group>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="marketplace" pt="md">
          {marketplaceLoading ? (
            <Center p="xl">
              <Loader />
            </Center>
          ) : marketplace.length === 0 ? (
            <Center p="xl">
              <Text c="dimmed">{t('Marketplace is empty.')}</Text>
            </Center>
          ) : (
            <Stack gap="xs">
              {marketplace.map((entry, idx) => {
                const slug = entry.slug ?? entry.name ?? `entry-${idx}`;
                const installSpec = entry.source ?? entry.slug ?? entry.name ?? '';
                return (
                  <Paper
                    key={slug}
                    withBorder
                    radius="sm"
                    p="sm"
                    aria-label={t('Marketplace entry {{slug}}', { slug })}
                  >
                    <Group justify="space-between" wrap="nowrap" align="flex-start">
                      <Stack gap={2}>
                        <Group gap="xs" align="baseline" wrap="nowrap">
                          <Text fw={600}>{entry.name ?? slug}</Text>
                          {entry.version && (
                            <Text size="sm" c="dimmed">
                              v{entry.version}
                            </Text>
                          )}
                        </Group>
                        {entry.description && (
                          <Text size="xs" c="dimmed">
                            {entry.description}
                          </Text>
                        )}
                      </Stack>
                      <Tooltip label={t('Install {{name}}', { name: entry.name ?? slug })}>
                        <ActionIcon
                          variant="filled"
                          color="paleBlue"
                          aria-label={t('Install {{name}}', { name: entry.name ?? slug })}
                          onClick={() => {
                            void onInstallSource(installSpec);
                          }}
                          disabled={!installSpec || installing}
                        >
                          <IconCirclePlus size={18} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Plugins(): React.ReactElement {
  usePageTitle(t('Plugins'));
  const navigate = useNavigate();

  const [installed, setInstalled] = useState<InstalledPluginRow[]>([]);
  const [installedLoading, setInstalledLoading] = useState(true);
  const [installedError, setInstalledError] = useState<string | null>(null);

  const [marketplace, setMarketplace] = useState<MarketplaceEntry[]>([]);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);

  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  // Dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [removePlugin, setRemovePlugin] = useState<InstalledPluginRow | null>(null);
  const [manifestPlugin, setManifestPlugin] = useState<InstalledPluginRow | null>(null);
  const [manifestText, setManifestText] = useState<string>('');
  const [manifestLoading, setManifestLoading] = useState(false);
  const [logPlugin, setLogPlugin] = useState<InstalledPluginRow | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  // Mounted-flag ref so async fetchers don't update state after unmount.
  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  // -------------------------------------------------------------------------
  // Fetchers
  // -------------------------------------------------------------------------

  const fetchInstalled = useCallback(async (): Promise<void> => {
    try {
      const r = await axios.get<InstalledResponse>(apiRoutes.pluginsV2Installed);
      if (!isMounted.current) return;
      setInstalled(Array.isArray(r.data?.plugins) ? r.data.plugins : []);
      setInstalledError(null);
    } catch (err: unknown) {
      if (!isMounted.current) return;
      const message = errorMessage(err, t('Failed to load installed plugins'));
      setInstalledError(message);
      notifications.show({
        title: t('Failed to load plugins'),
        message,
        icon: <IconX />,
        color: 'red',
      });
    } finally {
      if (isMounted.current) setInstalledLoading(false);
    }
  }, []);

  const fetchMarketplace = useCallback(async (): Promise<void> => {
    setMarketplaceLoading(true);
    try {
      const r = await axios.get<MarketplaceResponse | MarketplaceEntry[]>(
        apiRoutes.pluginsV2Marketplace
      );
      const data = r.data;
      const entries: MarketplaceEntry[] = Array.isArray(data)
        ? (data as MarketplaceEntry[])
        : Array.isArray(data?.plugins)
          ? data.plugins
          : [];
      if (isMounted.current) setMarketplace(entries);
    } catch (err: unknown) {
      if (!isMounted.current) return;
      notifications.show({
        title: t('Failed to load marketplace'),
        message: errorMessage(err, t('Failed to load marketplace')),
        icon: <IconX />,
        color: 'red',
      });
      setMarketplace([]);
    } finally {
      if (isMounted.current) setMarketplaceLoading(false);
    }
  }, []);

  // Mount + 30s poll
  useEffect(() => {
    void fetchInstalled();
    void fetchMarketplace();
    const id = window.setInterval(() => {
      void fetchInstalled();
    }, INSTALLED_POLL_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [fetchInstalled, fetchMarketplace]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const handleInstallSource = useCallback(
    async (source: string): Promise<void> => {
      const trimmed = source.trim();
      if (!trimmed) return;
      setInstalling(true);
      try {
        const r = await axios.post<{ success: boolean; stderr?: string }>(
          apiRoutes.pluginsV2Install,
          { source: trimmed }
        );
        if (r.data?.success) {
          notifications.show({
            title: t('Plugin installed'),
            message: trimmed,
            icon: <IconCheck />,
            color: 'green',
          });
          setAddOpen(false);
          await fetchInstalled();
        } else {
          notifications.show({
            title: t('Install failed'),
            message: r.data?.stderr || t('pip exited with a non-zero status'),
            icon: <IconAlertTriangle />,
            color: 'red',
          });
        }
      } catch (err: unknown) {
        notifications.show({
          title: t('Install failed'),
          message: errorMessage(err, t('Failed to install plugin')),
          icon: <IconX />,
          color: 'red',
        });
      } finally {
        if (isMounted.current) setInstalling(false);
      }
    },
    [fetchInstalled]
  );

  const handleConfigure = useCallback(
    (plugin: InstalledPluginRow): void => {
      navigate(configurePathFor(plugin));
    },
    [navigate]
  );

  const handleUpdate = useCallback(
    async (plugin: InstalledPluginRow): Promise<void> => {
      // Update = re-run install on the same slug. pip will resolve the
      // newest matching version and replace the installed copy.
      setBusySlug(plugin.slug);
      try {
        const r = await axios.post<{ success: boolean; stderr?: string }>(
          apiRoutes.pluginsV2Install,
          { source: plugin.slug }
        );
        if (r.data?.success) {
          notifications.show({
            title: t('Plugin updated'),
            message: plugin.name,
            icon: <IconCheck />,
            color: 'green',
          });
          await fetchInstalled();
        } else {
          notifications.show({
            title: t('Update failed'),
            message: r.data?.stderr || t('pip exited with a non-zero status'),
            icon: <IconAlertTriangle />,
            color: 'red',
          });
        }
      } catch (err: unknown) {
        notifications.show({
          title: t('Update failed'),
          message: errorMessage(err, t('Failed to update plugin')),
          icon: <IconX />,
          color: 'red',
        });
      } finally {
        if (isMounted.current) setBusySlug(null);
      }
    },
    [fetchInstalled]
  );

  const handleRemoveConfirm = useCallback(async (): Promise<void> => {
    const plugin = removePlugin;
    if (!plugin) return;
    setBusySlug(plugin.slug);
    try {
      // POST /api/plugins/v2/<slug>/uninstall — endpoint prefix lives in
      // apiRoutes.pluginsV2Uninstall (== '/api/plugins/v2'); we append the
      // slug + '/uninstall' suffix here so call sites stay explicit.
      const url = `${apiRoutes.pluginsV2Uninstall}/${encodeURIComponent(plugin.slug)}/uninstall`;
      const r = await axios.post<{ success: boolean; stderr?: string }>(url);
      if (r.data?.success) {
        notifications.show({
          title: t('Plugin removed'),
          message: plugin.name,
          icon: <IconCheck />,
          color: 'green',
        });
        setRemovePlugin(null);
        await fetchInstalled();
      } else {
        notifications.show({
          title: t('Remove failed'),
          message: r.data?.stderr || t('pip exited with a non-zero status'),
          icon: <IconAlertTriangle />,
          color: 'red',
        });
      }
    } catch (err: unknown) {
      notifications.show({
        title: t('Remove failed'),
        message: errorMessage(err, t('Failed to remove plugin')),
        icon: <IconX />,
        color: 'red',
      });
    } finally {
      if (isMounted.current) setBusySlug(null);
    }
  }, [fetchInstalled, removePlugin]);

  const handleToggleEnabled = useCallback(
    async (plugin: InstalledPluginRow): Promise<void> => {
      const suffix = plugin.enabled ? 'disable' : 'enable';
      const base =
        plugin.enabled ? apiRoutes.pluginsV2Disable : apiRoutes.pluginsV2Enable;
      const url = `${base}/${encodeURIComponent(plugin.slug)}/${suffix}`;
      setBusySlug(plugin.slug);
      try {
        await axios.post(url);
        notifications.show({
          title: plugin.enabled ? t('Plugin disabled') : t('Plugin enabled'),
          message: plugin.name,
          icon: <IconCheck />,
          color: 'green',
        });
        await fetchInstalled();
      } catch (err: unknown) {
        notifications.show({
          title: t('Action failed'),
          message: errorMessage(err, t('Failed to toggle plugin state')),
          icon: <IconX />,
          color: 'red',
        });
      } finally {
        if (isMounted.current) setBusySlug(null);
      }
    },
    [fetchInstalled]
  );

  const handleViewManifest = useCallback(
    async (plugin: InstalledPluginRow): Promise<void> => {
      setManifestPlugin(plugin);
      setManifestText('');
      setManifestLoading(true);
      try {
        const url = `${apiRoutes.pluginsV2Manifest}/${encodeURIComponent(plugin.slug)}/manifest`;
        const r = await axios.get(url);
        setManifestText(JSON.stringify(r.data, null, 2));
      } catch (err: unknown) {
        notifications.show({
          title: t('Failed to load manifest'),
          message: errorMessage(err, t('Failed to load manifest')),
          icon: <IconX />,
          color: 'red',
        });
        setManifestPlugin(null);
      } finally {
        if (isMounted.current) setManifestLoading(false);
      }
    },
    []
  );

  const handleViewLog = useCallback(
    async (plugin: InstalledPluginRow): Promise<void> => {
      setLogPlugin(plugin);
      setLogLines([]);
      setLogLoading(true);
      try {
        const url = `${apiRoutes.pluginsV2Manifest}/${encodeURIComponent(plugin.slug)}/log`;
        const r = await axios.get<{ lines?: string[] } | string[]>(url, {
          params: { lines: 200 },
        });
        const data = r.data;
        const lines: string[] = Array.isArray(data)
          ? (data as string[])
          : Array.isArray(data?.lines)
            ? data.lines
            : [];
        setLogLines(lines);
      } catch (err: unknown) {
        notifications.show({
          title: t('Failed to load logs'),
          message: errorMessage(err, t('Failed to load logs')),
          icon: <IconX />,
          color: 'red',
        });
        setLogPlugin(null);
      } finally {
        if (isMounted.current) setLogLoading(false);
      }
    },
    []
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Filter marketplace to entries NOT already installed.
  const installedSlugs = useMemo(
    () => new Set(installed.map((p) => p.slug.toLowerCase())),
    [installed]
  );
  const availableMarketplace = useMemo(
    () =>
      marketplace.filter((entry) => {
        const slug = (entry.slug ?? entry.name ?? '').toLowerCase();
        return slug && !installedSlugs.has(slug);
      }),
    [marketplace, installedSlugs]
  );

  const empty = !installedLoading && installed.length === 0;

  return (
    <Stack gap="md" data-sentinel="PluginsRootPage:v2">
      <Group justify="space-between" align="center">
        <Title order={2}>{t('Plugins')}</Title>
        <Button
          leftSection={<IconCirclePlus size={16} />}
          onClick={() => setAddOpen(true)}
          aria-label={t('Add plugin')}
        >
          {t('Add plugin')}
        </Button>
      </Group>

      {installedError && !installedLoading && (
        <Paper withBorder radius="md" p="sm" bg="var(--mantine-color-red-light)">
          <Group gap="xs">
            <IconAlertTriangle size={16} />
            <Text size="sm">{installedError}</Text>
          </Group>
        </Paper>
      )}

      {installedLoading ? (
        <Center p="xl">
          <Loader />
        </Center>
      ) : empty ? (
        <Paper withBorder radius="md" p="xl">
          <Center>
            <Stack align="center" gap="md">
              <IconPuzzle size={48} stroke={1.2} />
              <Title order={3}>{t('No plugins yet')}</Title>
              <Text c="dimmed" ta="center">
                {t('Install your first plugin to extend OpenTAKServer.')}
              </Text>
              <Button
                leftSection={<IconCirclePlus size={16} />}
                onClick={() => setAddOpen(true)}
              >
                {t('Add plugin')}
              </Button>
            </Stack>
          </Center>
        </Paper>
      ) : (
        <Stack gap="sm">
          {installed.map((plugin) => (
            <PluginRow
              key={plugin.slug}
              plugin={plugin}
              busy={busySlug === plugin.slug}
              onConfigure={handleConfigure}
              onUpdate={handleUpdate}
              onRemove={(p) => setRemovePlugin(p)}
              onToggleEnabled={handleToggleEnabled}
              onViewManifest={handleViewManifest}
              onViewLog={handleViewLog}
            />
          ))}
        </Stack>
      )}

      {availableMarketplace.length > 0 && (
        <>
          <Divider label={t('Available')} labelPosition="left" mt="md" />
          <Stack gap="xs">
            {availableMarketplace.map((entry, idx) => {
              const slug = entry.slug ?? entry.name ?? `entry-${idx}`;
              const installSpec = entry.source ?? entry.slug ?? entry.name ?? '';
              return (
                <Paper
                  key={slug}
                  withBorder
                  radius="md"
                  p="sm"
                  aria-label={t('Available plugin {{slug}}', { slug })}
                >
                  <Group justify="space-between" wrap="nowrap" align="flex-start">
                    <Group gap="md" wrap="nowrap" align="flex-start">
                      <IconByName iconName={entry.icon ?? null} size={28} stroke={1.5} />
                      <Stack gap={2}>
                        <Group gap="xs" align="baseline" wrap="nowrap">
                          <Text fw={600}>{entry.name ?? slug}</Text>
                          {entry.version && (
                            <Text size="sm" c="dimmed">
                              v{entry.version}
                            </Text>
                          )}
                          <Badge variant="light" color="gray" radius="sm" size="sm">
                            {entry.source && entry.source.startsWith('http')
                              ? t('marketplace')
                              : t('vanilla repo')}
                          </Badge>
                        </Group>
                        {entry.description && (
                          <Text size="xs" c="dimmed">
                            {entry.description}
                          </Text>
                        )}
                      </Stack>
                    </Group>
                    <Tooltip
                      label={t('Install {{name}}', { name: entry.name ?? slug })}
                    >
                      <ActionIcon
                        variant="filled"
                        color="paleBlue"
                        size="lg"
                        aria-label={t('Install {{name}}', { name: entry.name ?? slug })}
                        loading={installing}
                        onClick={() => {
                          void handleInstallSource(installSpec);
                        }}
                        disabled={!installSpec}
                      >
                        <IconCirclePlus size={18} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        </>
      )}

      <Divider mt="xl" />
      <Group justify="flex-start">
        <Button
          component={Link}
          to="/plugins/docs"
          variant="subtle"
          leftSection={<IconFileText size={16} />}
          aria-label={t('Plugin documentation')}
        >
          {t('Documentation')}
        </Button>
      </Group>

      {/* --- Modals --- */}
      <AddPluginModal
        opened={addOpen}
        onClose={() => setAddOpen(false)}
        marketplace={marketplace}
        marketplaceLoading={marketplaceLoading}
        onInstallSource={handleInstallSource}
        installing={installing}
      />

      <Modal
        opened={removePlugin !== null}
        onClose={() => setRemovePlugin(null)}
        title={t('Remove plugin')}
        centered
      >
        <Stack gap="md">
          <Text>
            {t('Are you sure you want to remove {{name}}? This pip-uninstalls the package and unregisters all of its mounts.', {
              name: removePlugin?.name ?? '',
            })}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRemovePlugin(null)}>
              {t('Cancel')}
            </Button>
            <Button
              color="red"
              onClick={() => {
                void handleRemoveConfirm();
              }}
              loading={busySlug === removePlugin?.slug}
              leftSection={<IconTrash size={14} />}
            >
              {t('Remove')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={manifestPlugin !== null}
        onClose={() => setManifestPlugin(null)}
        title={t('Manifest — {{name}}', { name: manifestPlugin?.name ?? '' })}
        size="lg"
        centered
      >
        {manifestLoading ? (
          <Center p="xl">
            <Loader />
          </Center>
        ) : (
          <ScrollArea h={420}>
            <Code block>{manifestText || t('(empty)')}</Code>
          </ScrollArea>
        )}
      </Modal>

      <Modal
        opened={logPlugin !== null}
        onClose={() => setLogPlugin(null)}
        title={t('Logs — {{name}}', { name: logPlugin?.name ?? '' })}
        size="xl"
        centered
      >
        {logLoading ? (
          <Center p="xl">
            <Loader />
          </Center>
        ) : logLines.length === 0 ? (
          <Center p="xl">
            <Text c="dimmed">{t('No log entries available.')}</Text>
          </Center>
        ) : (
          <ScrollArea h={460}>
            <Code block>{logLines.join('\n')}</Code>
          </ScrollArea>
        )}
      </Modal>
    </Stack>
  );
}
