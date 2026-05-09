/**
 * Plugin SDK v2 — `kind: 'map_overlay'` renderer.
 *
 * Renders a LayerGroup of plugin-supplied geometry on the host Map.
 * The plugin's manifest declares `endpoint`; we GET that URL, expect a
 * JSON payload of:
 *
 * ```ts
 * {
 *   markers?:  [{ lat, lon, name?, desc?, iconUrl? }]
 *   lines?:    [{ points: [[lat, lon], ...], color?, weight?, name?, desc? }]
 *   polygons?: [{ points: [[lat, lon], ...], color?, fillColor?, weight?, name?, desc? }]
 * }
 * ```
 *
 * and re-poll every 5 minutes. Markers render as `<CircleMarker>` on a
 * shared canvas pane — same perf pattern KmlOverlay uses, since plugin
 * feeds (e.g. ALPR, AIS, sensor packs) can produce thousands of points
 * and DOM markers blow the framerate apart.
 *
 * Failure mode: a bad fetch leaves the previously-rendered geometry in
 * place. We never blank the layer just because the API blipped.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  CircleMarker,
  LayerGroup,
  Polygon,
  Polyline,
  Popup,
} from 'react-leaflet';
import L from 'leaflet';
import { t } from 'i18next';
import axios from '../../axios_config';
import type { MapOverlayMount } from '../types';

/** 5 minutes — matches KmlOverlay's default refresh cadence. */
const DEFAULT_REFRESH_MS = 5 * 60 * 1000;

interface OverlayMarker {
  lat: number;
  lon: number;
  name?: string;
  desc?: string;
  /** Reserved for a future `<Marker>` path; CircleMarkers ignore icons. */
  iconUrl?: string;
}

interface OverlayLine {
  points: [number, number][];
  color?: string;
  weight?: number;
  name?: string;
  desc?: string;
}

interface OverlayPolygon {
  points: [number, number][];
  color?: string;
  fillColor?: string;
  weight?: number;
  name?: string;
  desc?: string;
}

interface OverlayPayload {
  markers?: OverlayMarker[];
  lines?: OverlayLine[];
  polygons?: OverlayPolygon[];
}

/** Stable hue derived from the plugin slug — every plugin paints a unique color. */
function colorForPlugin(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) & 0xffffff;
  }
  return `hsl(${h % 360}, 70%, 50%)`;
}

interface Props {
  mount: MapOverlayMount;
  /** Override polling interval; 0 disables polling. Defaults to 5 minutes. */
  refreshMs?: number;
}

export default function MountMapOverlay({ mount, refreshMs = DEFAULT_REFRESH_MS }: Props) {
  const [payload, setPayload] = useState<OverlayPayload>({});

  const defaultColor = useMemo(() => colorForPlugin(mount._plugin), [mount._plugin]);

  // Shared canvas renderer — one backing canvas per overlay so high-cardinality
  // marker feeds stay performant. Same pattern as KmlOverlay.
  const renderer = useMemo(() => L.canvas({ padding: 0.5 }), []);

  useEffect(() => {
    let alive = true;

    async function load(): Promise<void> {
      try {
        const r = await axios.get<OverlayPayload>(mount.endpoint);
        if (!alive) return;
        const data = r.data;
        if (!data || typeof data !== 'object') {
          // eslint-disable-next-line no-console
          console.warn(
            `[plugin-sdk] map_overlay '${mount._plugin}': non-object payload, keeping previous geometry`,
          );
          return;
        }
        setPayload({
          markers: Array.isArray(data.markers) ? data.markers : [],
          lines: Array.isArray(data.lines) ? data.lines : [],
          polygons: Array.isArray(data.polygons) ? data.polygons : [],
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          `[plugin-sdk] map_overlay '${mount._plugin}' fetch failed; keeping previous geometry`,
          err,
        );
      }
    }

    void load();
    const id = refreshMs > 0 ? window.setInterval(() => void load(), refreshMs) : 0;
    return () => {
      alive = false;
      if (id) window.clearInterval(id);
    };
  }, [mount.endpoint, mount._plugin, refreshMs]);

  const markers = payload.markers ?? [];
  const lines = payload.lines ?? [];
  const polygons = payload.polygons ?? [];

  return (
    <LayerGroup>
      {markers.map((m, i) => {
        if (!Number.isFinite(m.lat) || !Number.isFinite(m.lon)) return null;
        return (
          <CircleMarker
            key={`${mount._plugin}-mk-${i}`}
            center={[m.lat, m.lon]}
            radius={5}
            pathOptions={{
              color: 'white',
              weight: 1,
              fillColor: defaultColor,
              fillOpacity: 0.9,
            }}
            pane="overlayPane"
            renderer={renderer}
          >
            {(m.name || m.desc) && (
              <Popup>
                <strong>{m.name || t('Untitled')}</strong>
                {m.desc && (
                  <>
                    <br />
                    <span style={{ whiteSpace: 'pre-wrap' }}>{m.desc}</span>
                  </>
                )}
              </Popup>
            )}
          </CircleMarker>
        );
      })}

      {lines.map((line, i) => (
        <Polyline
          key={`${mount._plugin}-ln-${i}`}
          positions={line.points}
          pathOptions={{
            color: line.color || defaultColor,
            weight: line.weight ?? 3,
          }}
          renderer={renderer}
        >
          {(line.name || line.desc) && (
            <Popup>
              <strong>{line.name || t('Untitled')}</strong>
              {line.desc && (
                <>
                  <br />
                  <span style={{ whiteSpace: 'pre-wrap' }}>{line.desc}</span>
                </>
              )}
            </Popup>
          )}
        </Polyline>
      ))}

      {polygons.map((poly, i) => (
        <Polygon
          key={`${mount._plugin}-pg-${i}`}
          positions={poly.points}
          pathOptions={{
            color: poly.color || defaultColor,
            fillColor: poly.fillColor || defaultColor,
            weight: poly.weight ?? 2,
            fillOpacity: 0.25,
          }}
          renderer={renderer}
        >
          {(poly.name || poly.desc) && (
            <Popup>
              <strong>{poly.name || t('Untitled')}</strong>
              {poly.desc && (
                <>
                  <br />
                  <span style={{ whiteSpace: 'pre-wrap' }}>{poly.desc}</span>
                </>
              )}
            </Popup>
          )}
        </Polygon>
      ))}
    </LayerGroup>
  );
}
