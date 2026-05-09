/**
 * Plugins documentation page (Plugin SDK v2 — phase E.2).
 *
 * Renders `plugins-docs.md` (imported via Vite's `?raw` query) using
 * `react-markdown`, with a sticky-positioned TOC sidebar at viewport widths
 * ≥ 768px. The markdown content is the long-form authoring guide — getting
 * started, manifest reference, SDK reference, mount-points cookbook,
 * vanilla → v2 migration, lifecycle hooks, testing, marketplace, FAQ.
 *
 * Page-level chrome strings (TOC heading, back button, etc.) are wrapped in
 * `t(...)` for i18next; the markdown body is English-only for now. Translations
 * are mentioned in the doc itself as a contributor-friendly opt-in.
 *
 * Sentinel string for build verification: "PluginsDocsPage:v2".
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router';
import {
  Anchor,
  Box,
  Button,
  Container,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconArrowLeft, IconList } from '@tabler/icons-react';
import Markdown from 'react-markdown';
import { t } from 'i18next';

// Vite's `?raw` query loads the markdown source as a string at build time —
// no fetch round-trip and no manifest churn. The doc is bundled into the
// page's lazy chunk so it ships exactly once for the page load.
import docMarkdown from './plugins-docs.md?raw';

import { usePageTitle } from '../usePageTitle';

interface TocEntry {
  /** Heading anchor id (matches GitHub-flavored markdown autoslug). */
  anchor: string;
  /** Visible heading text. */
  label: string;
  /** Heading level (1, 2, 3). Used for TOC indentation. */
  level: number;
}

/**
 * Slugify a heading the same way `react-markdown` + `rehype-slug` (or
 * GitHub's renderer) does, so anchor links inside the markdown body match
 * the TOC entries we extract here.
 *
 * - Lowercase
 * - Strip everything except `[a-z0-9 -]` (keeping hyphens and spaces)
 * - Collapse spaces to single hyphens
 * - Trim leading/trailing hyphens
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`'"]/g, '') // strip apostrophes / backticks before splitting on punctuation
    .replace(/[^a-z0-9 -]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Walk the raw markdown source and build the TOC. We extract every `## …`
 * (level 2) and `### …` (level 3) heading — the doc's H1 ("OpenTAK Plugin
 * Author's Guide") is the page title, not a TOC entry, so we skip it.
 */
function extractToc(md: string): TocEntry[] {
  const out: TocEntry[] = [];
  const lines = md.split('\n');
  let inFence = false;
  const headingPattern = /^(#{2,3})\s+(.+?)\s*$/;
  for (const line of lines) {
    // Skip headings inside code fences.
    if (line.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(headingPattern);
    if (!m) continue;
    const level = m[1].length;
    const label = m[2].trim();
    out.push({ anchor: slugify(label), label, level });
  }
  return out;
}

/**
 * react-markdown component overrides: stamp `id={slugify(text)}` onto every
 * heading so anchor links work, and route fenced code blocks through a
 * Mantine-styled `<pre>` so inline code looks consistent with the rest of
 * the dashboard.
 */
const markdownComponents: React.ComponentProps<typeof Markdown>['components'] = {
  h1: ({ children, ...rest }) => {
    const text = String(children);
    return (
      <Title order={1} id={slugify(text)} mt="xl" mb="md" {...rest}>
        {children}
      </Title>
    );
  },
  h2: ({ children, ...rest }) => {
    const text = String(children);
    return (
      <Title order={2} id={slugify(text)} mt="xl" mb="sm" {...rest}>
        {children}
      </Title>
    );
  },
  h3: ({ children, ...rest }) => {
    const text = String(children);
    return (
      <Title order={3} id={slugify(text)} mt="lg" mb="sm" {...rest}>
        {children}
      </Title>
    );
  },
  h4: ({ children, ...rest }) => {
    const text = String(children);
    return (
      <Title order={4} id={slugify(text)} mt="md" mb="xs" {...rest}>
        {children}
      </Title>
    );
  },
  p: ({ children }) => <Text my="sm">{children}</Text>,
  a: ({ href, children }) => {
    if (href && href.startsWith('#')) {
      // Internal anchor link — render plainly so the browser handles the
      // hashchange itself; no react-router navigation needed.
      return <Anchor href={href}>{children}</Anchor>;
    }
    return (
      <Anchor href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </Anchor>
    );
  },
  pre: ({ children }) => (
    <Box
      component="pre"
      style={{
        background: 'var(--mantine-color-default-hover)',
        padding: 'var(--mantine-spacing-sm)',
        borderRadius: 'var(--mantine-radius-md)',
        overflowX: 'auto',
        fontSize: 'var(--mantine-font-size-sm)',
      }}
    >
      {children}
    </Box>
  ),
  code: ({ children, className }) => {
    // Block-level <code> is wrapped by `pre`; inline code gets the inline pill.
    const inline = !className;
    if (inline) {
      return (
        <Box
          component="code"
          style={{
            background: 'var(--mantine-color-default-hover)',
            padding: '0.1em 0.35em',
            borderRadius: 'var(--mantine-radius-sm)',
            fontSize: '0.92em',
            fontFamily: 'var(--mantine-font-family-monospace)',
          }}
        >
          {children}
        </Box>
      );
    }
    return <code className={className}>{children}</code>;
  },
  table: ({ children }) => (
    <Box
      component="table"
      style={{
        borderCollapse: 'collapse',
        marginTop: 'var(--mantine-spacing-sm)',
        marginBottom: 'var(--mantine-spacing-sm)',
        width: '100%',
        fontSize: 'var(--mantine-font-size-sm)',
      }}
    >
      {children}
    </Box>
  ),
  th: ({ children }) => (
    <Box
      component="th"
      style={{
        textAlign: 'left',
        padding: 'var(--mantine-spacing-xs)',
        borderBottom: '1px solid var(--mantine-color-default-border)',
        fontWeight: 600,
      }}
    >
      {children}
    </Box>
  ),
  td: ({ children }) => (
    <Box
      component="td"
      style={{
        padding: 'var(--mantine-spacing-xs)',
        borderBottom: '1px solid var(--mantine-color-default-border)',
        verticalAlign: 'top',
      }}
    >
      {children}
    </Box>
  ),
  blockquote: ({ children }) => (
    <Paper
      withBorder
      radius="md"
      p="md"
      my="md"
      style={{
        borderLeft: '4px solid var(--mantine-primary-color-filled)',
        background: 'var(--mantine-color-default-hover)',
      }}
    >
      {children}
    </Paper>
  ),
};

export default function PluginsDocs(): React.ReactElement {
  usePageTitle(t('Plugin Docs'));

  const toc = useMemo(() => extractToc(docMarkdown), []);

  return (
    <Container size="lg" py="md" data-sentinel="PluginsDocsPage:v2">
      <Group justify="space-between" mb="md" wrap="nowrap">
        <Button
          component={Link}
          to="/plugins"
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          aria-label={t('Back to Plugins')}
        >
          {t('Back to Plugins')}
        </Button>
      </Group>

      <Group align="flex-start" wrap="nowrap" gap="xl">
        {/* Sticky TOC sidebar — hidden below 768px via Mantine's `visibleFrom`. */}
        <Box
          visibleFrom="sm"
          style={{
            position: 'sticky',
            top: 'calc(var(--mantine-spacing-md) + 60px)',
            width: 240,
            flexShrink: 0,
            alignSelf: 'flex-start',
          }}
        >
          <Paper withBorder radius="md" p="sm">
            <Group gap="xs" mb="xs">
              <IconList size={16} />
              <Text size="sm" fw={600}>
                {t('On this page')}
              </Text>
            </Group>
            <ScrollArea.Autosize mah={`calc(100vh - 200px)`} type="auto">
              <Stack gap={2}>
                {toc.map((entry) => (
                  <Anchor
                    key={`${entry.anchor}-${entry.label}`}
                    href={`#${entry.anchor}`}
                    size="sm"
                    style={{
                      paddingLeft: `calc(var(--mantine-spacing-xs) * ${
                        entry.level - 2
                      })`,
                      color:
                        entry.level === 2
                          ? 'var(--mantine-color-text)'
                          : 'var(--mantine-color-dimmed)',
                      fontWeight: entry.level === 2 ? 500 : 400,
                    }}
                  >
                    {entry.label}
                  </Anchor>
                ))}
              </Stack>
            </ScrollArea.Autosize>
          </Paper>
        </Box>

        {/* Reading column — Container size="lg" already constrains the page;
            inner Box pins the markdown body to ~720px so long lines don't
            stretch full-width on big monitors. */}
        <Box style={{ flex: 1, minWidth: 0, maxWidth: 720 }}>
          <Markdown components={markdownComponents}>{docMarkdown}</Markdown>
        </Box>
      </Group>
    </Container>
  );
}
