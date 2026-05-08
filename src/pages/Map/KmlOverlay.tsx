import { useEffect, useMemo, useState } from 'react';
import { LayerGroup, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Stable hue per filename so every KML's pins are visually distinct.
function colorForName(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) {
        h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
    }
    return `hsl(${h % 360}, 70%, 50%)`;
}

function makeIcon(color: string): L.DivIcon {
    return L.divIcon({
        className: 'mm-overlay-icon',
        html: `<div style="width:14px;height:14px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.5)"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -9],
    });
}

interface Placemark {
    lat: number;
    lon: number;
    name: string;
    desc: string;
}

function parsePlacemarks(text: string): Placemark[] {
    const out: Placemark[] = [];
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const pms = doc.querySelectorAll('Placemark');
    pms.forEach((pm) => {
        const coords = pm.querySelector('Point coordinates');
        if (!coords) return;
        const parts = (coords.textContent || '').trim().split(',');
        const lon = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        if (!isFinite(lat) || !isFinite(lon)) return;
        out.push({
            lat,
            lon,
            name: pm.querySelector('name')?.textContent || 'Unnamed',
            desc: pm.querySelector('description')?.textContent || '',
        });
    });
    return out;
}

interface Props {
    /** Filename relative to the MapMarker plugin's /files endpoint. */
    filename: string;
    /** Refresh interval in ms; 0 disables polling. Defaults to 5 minutes. */
    refreshMs?: number;
}

/**
 * Renders a synced MapMarker KML as a LayerGroup. Designed to be the direct
 * child of a `<LayersControl.Overlay>` so the user can toggle visibility,
 * with periodic refresh so the overlay stays in sync with the plugin's
 * gdrive sync without requiring a full page reload.
 */
export default function KmlOverlay({ filename, refreshMs = 5 * 60 * 1000 }: Props) {
    const [placemarks, setPlacemarks] = useState<Placemark[]>([]);
    const icon = useMemo(() => makeIcon(colorForName(filename)), [filename]);

    useEffect(() => {
        let active = true;
        const url = `/api/plugins/ots_mapmarker_plugin/files/${encodeURIComponent(filename)}`;

        async function load() {
            try {
                const r = await fetch(url, { credentials: 'include' });
                if (!r.ok || !active) return;
                const text = await r.text();
                if (!active) return;
                setPlacemarks(parsePlacemarks(text));
            } catch {
                /* keep previous placemarks on transient failure */
            }
        }

        load();
        const id = refreshMs > 0 ? window.setInterval(load, refreshMs) : 0;
        return () => {
            active = false;
            if (id) window.clearInterval(id);
        };
    }, [filename, refreshMs]);

    return (
        <LayerGroup>
            {placemarks.map((pm, i) => (
                <Marker key={`${filename}-${i}`} position={[pm.lat, pm.lon]} icon={icon}>
                    <Popup>
                        <strong>{pm.name}</strong>
                        {pm.desc && (
                            <>
                                <br />
                                <span style={{ whiteSpace: 'pre-wrap' }}>{pm.desc}</span>
                            </>
                        )}
                    </Popup>
                </Marker>
            ))}
        </LayerGroup>
    );
}
