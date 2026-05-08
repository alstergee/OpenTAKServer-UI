import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, LayerGroup, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Stable hue per filename so every KML's pins are visually distinct.
function colorForName(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) {
        h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
    }
    return `hsl(${h % 360}, 70%, 50%)`;
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
 * Renders a synced MapMarker KML as a LayerGroup of CircleMarkers on a shared
 * canvas pane. CircleMarker on canvas is dramatically faster than DivIcon DOM
 * markers — necessary because some synced KMLs (e.g. the FLOCK ALPR feed)
 * contain thousands of placemarks and the SVG/DOM path makes the map unusable.
 *
 * Lazy-loads: the KML is only fetched after react-leaflet attaches this
 * component's LayerGroup to the map (i.e. the user checks the overlay in
 * LayersControl). Keeps idle pages cheap and the initial /map render fast.
 */
export default function KmlOverlay({ filename, refreshMs = 5 * 60 * 1000 }: Props) {
    const map = useMap();
    const [placemarks, setPlacemarks] = useState<Placemark[]>([]);
    const [active, setActive] = useState(false);
    const color = useMemo(() => colorForName(filename), [filename]);

    // One canvas renderer shared across this overlay so all CircleMarkers in
    // the LayerGroup paint to a single backing canvas. Massively cheaper than
    // SVG paths when the placemark count climbs into the thousands.
    const renderer = useMemo(() => L.canvas({ padding: 0.5 }), []);

    // Watch the LayersControl events and only fetch when this overlay actually
    // gets attached to the map. The `name` we registered with
    // <LayersControl.Overlay> is the prettified `📍 X` label, which we don't
    // know inside this component — instead we listen for layeradd events that
    // include our own LayerGroup ref. Simpler approach: track via a manually-
    // attached identifier on the LayerGroup using a sentinel via map's eachLayer.
    useEffect(() => {
        function onAdd(e: any) {
            if (e?.layer?._mmFile === filename) setActive(true);
        }
        function onRemove(e: any) {
            if (e?.layer?._mmFile === filename) setActive(false);
        }
        map.on('overlayadd layeradd', onAdd);
        map.on('overlayremove layerremove', onRemove);
        // Also check immediately in case the layer was already added before
        // these listeners attached.
        map.eachLayer((layer: any) => {
            if (layer?._mmFile === filename) setActive(true);
        });
        return () => {
            map.off('overlayadd layeradd', onAdd);
            map.off('overlayremove layerremove', onRemove);
        };
    }, [map, filename]);

    useEffect(() => {
        if (!active) return;
        let alive = true;
        const url = `/api/plugins/ots_mapmarker_plugin/files/${encodeURIComponent(filename)}`;

        async function load() {
            try {
                const r = await fetch(url, { credentials: 'include' });
                if (!r.ok || !alive) return;
                const text = await r.text();
                if (!alive) return;
                setPlacemarks(parsePlacemarks(text));
            } catch {
                /* keep previous placemarks on transient failure */
            }
        }

        load();
        const id = refreshMs > 0 ? window.setInterval(load, refreshMs) : 0;
        return () => {
            alive = false;
            if (id) window.clearInterval(id);
        };
    }, [active, filename, refreshMs]);

    return (
        <LayerGroup
            ref={(lg) => {
                // Tag the underlying L.LayerGroup so the map-level event
                // listeners above can recognize "is this overlay being
                // toggled?" without round-tripping through react-leaflet
                // refs that aren't reliably accessible from siblings.
                if (lg) (lg as any)._mmFile = filename;
            }}
        >
            {placemarks.map((pm, i) => (
                <CircleMarker
                    key={`${filename}-${i}`}
                    center={[pm.lat, pm.lon]}
                    radius={5}
                    pathOptions={{
                        color: 'white',
                        weight: 1,
                        fillColor: color,
                        fillOpacity: 0.9,
                    }}
                    pane="overlayPane"
                    renderer={renderer}
                >
                    <Popup>
                        <strong>{pm.name}</strong>
                        {pm.desc && (
                            <>
                                <br />
                                <span style={{ whiteSpace: 'pre-wrap' }}>{pm.desc}</span>
                            </>
                        )}
                    </Popup>
                </CircleMarker>
            ))}
        </LayerGroup>
    );
}
