# OpenTAK Plugin Author's Guide

> Welcome. This guide covers everything you need to write an OpenTAKServer plugin —
> from a five-minute "hello world" through publishing on the marketplace.
>
> **Audience:** Python developers comfortable with Flask and pip.
> **Status:** SDK v2 is the current and recommended path. Vanilla (v1) plugins
> still work for backwards-compatibility and are documented in the
> [Vanilla → v2 migration](#vanilla--v2-migration) section.
>
> **Translations welcome.** This page is currently English-only. If you'd like
> to contribute a translation, open a PR against `src/pages/plugins-docs.md`
> in the `OpenTAKServer-UI` repo.

---

## Table of contents

- [Getting started](#getting-started)
  - [What is a plugin?](#what-is-a-plugin)
  - [Vanilla vs SDK v2](#vanilla-vs-sdk-v2)
  - [Five-minute quickstart with cookiecutter](#five-minute-quickstart-with-cookiecutter)
  - [Project layout](#project-layout)
- [Manifest reference](#manifest-reference)
  - [Top-level `[plugin]` table](#top-level-plugin-table)
  - [`[plugin.permissions]`](#pluginpermissions)
  - [`[[plugin.mount]]` array](#pluginmount-array)
  - [Permission scopes — full table](#permission-scopes--full-table)
  - [Mount kinds — full table](#mount-kinds--full-table)
- [SDK reference](#sdk-reference)
  - [`OTS.cot`](#otscot)
  - [`OTS.eud`](#otseud)
  - [`OTS.mesh`](#otsmesh)
  - [`OTS.mission`](#otsmission)
  - [`OTS.dp`](#otsdp)
  - [`OTS.config`](#otsconfig)
  - [`OTS.storage`](#otsstorage)
  - [`OTS.bus`](#otsbus)
  - [`OTS.notify`](#otsnotify)
- [Mount points cookbook](#mount-points-cookbook)
- [Vanilla → v2 migration](#vanilla--v2-migration)
- [Lifecycle hooks](#lifecycle-hooks)
- [Testing your plugin](#testing-your-plugin)
- [Marketplace](#marketplace)
- [FAQ and error codes](#faq-and-error-codes)

---

## Getting started

### What is a plugin?

An OpenTAKServer plugin is a Python package, distributed as a wheel, that
extends the server with new capabilities — new dashboard tabs, map overlays,
CoT message handlers, scheduled background tasks, custom auth backends, etc.
Plugins ship as ordinary pip packages and are installed at runtime through
the **Plugins** tab in the dashboard.

Each plugin is one Python module under the `opentakserver.plugin`
entry-point group, plus a `plugin.toml` manifest declaring the plugin's
metadata, permission scopes, and mount points. The server reads the manifest
at boot time, validates it, registers any UI/API/scheduler mounts, and grants
the plugin a per-plugin namespace on the SDK.

A plugin can be as small as a single 50-line file (e.g. a CoT echo handler)
or as large as a multi-mount feature (e.g. MapMarker — 3 mounts, 3 scopes,
both vanilla and v2 surfaces).

### Vanilla vs SDK v2

OpenTAKServer supports two plugin "tiers":

| | Vanilla (v1) | SDK v2 |
|---|---|---|
| Manifest | `pyproject.toml` only | `pyproject.toml` + `plugin.toml` |
| UI surface | Single iframe at `/plugin?name=…` | 22 declarative mount kinds |
| API surface | `from opentakserver.plugins.Plugin import Plugin` | `from opentakserver.sdk import OTS` |
| Permission scopes | None — full server access | Declared in manifest, enforced at call time |
| Per-plugin storage | Manual file management | `OTS.config`, `OTS.storage` |
| Marketplace listing | Yes (gets "vanilla — SDK v1" badge) | Yes |
| Hot reload | Not supported | Per-plugin reload via admin endpoint |

**You should write new plugins as v2** unless you have a specific reason to
target vanilla (e.g. you're forking a third-party vanilla plugin and don't
want to rewrite it).

Going from vanilla to v2 is **purely additive** — you add a `plugin.toml`,
optionally swap a few helpers from `OTS.config.set` instead of writing global
yaml, and you're done. No code rewrite required. See
[Vanilla → v2 migration](#vanilla--v2-migration).

### Five-minute quickstart with cookiecutter

The fastest way to start a new plugin is the cookiecutter template:

```bash
cd /docker/opentak/plugins
cookiecutter _template
```

Cookiecutter prompts for:

- `plugin_name` — human-readable, e.g. `My Plugin`
- `plugin_slug` — pip-distribution name, e.g. `ots-myplugin-plugin`
- `plugin_module` — Python module name (auto-derived from slug)
- `author`, `author_email`
- `description`
- `license` — defaults to MIT
- `permissions_read` — comma list of read scopes (e.g. `eud,kml`)
- `permissions_write` — comma list of write scopes
- `use_mesh` — `yes`/`no`, sets `mesh = true|false`
- `mission_access` — `none`/`read`/`write`
- `first_mount_kind` — pick one of the 22 mount kinds for the scaffolded
  starter mount; you can add more by editing `plugin.toml` later

The template scaffolds a working v2 plugin you can immediately install:

```bash
cd ots-myplugin-plugin
pip install -e .
docker exec opentakserver pip install /path/to/your/wheel
docker restart opentakserver
```

Then visit **Plugins** in the dashboard — your plugin shows up with the
declared mounts and the `SDK v2` badge.

### Project layout

A typical v2 plugin laid out next to its `pyproject.toml`:

```
ots-myplugin-plugin/
├── pyproject.toml                 # standard PEP 621 + entry-point group
├── README.md
├── LICENSE
├── ots_myplugin_plugin/
│   ├── __init__.py                # the entry point — your `Plugin` subclass
│   ├── plugin.toml                # SDK v2 manifest — sibling of __init__.py
│   ├── default_config.py          # optional — config schema + defaults
│   ├── api.py                     # your blueprint routes
│   ├── handlers.py                # event/CoT handlers, scheduled tasks
│   └── ui/
│       ├── icon.svg               # plugin icon shown in the Plugins list
│       └── tab.html               # iframe content for `kind = "tab"` mounts
└── tests/
    ├── conftest.py
    ├── test_handlers.py
    └── test_api.py
```

**Pinning the manifest** in your wheel is critical — the server discovers
plugins by walking the `opentakserver.plugin` entry points and looking for
`plugin.toml` next to each package's `__init__.py`. Add it to your
`pyproject.toml`:

```toml
[tool.setuptools.package-data]
"ots_myplugin_plugin" = ["plugin.toml", "ui/*.svg", "ui/*.html"]
```

Without that, `pip install` strips the manifest from the wheel and the
server treats your plugin as vanilla.

---

## Manifest reference

`plugin.toml` is a TOML 1.0 file living next to your `__init__.py`. The
server parses it via Python's stdlib `tomllib` and validates it through a
strict Pydantic v2 schema (`opentakserver.sdk.manifest.PluginManifest`).
Unknown top-level keys raise `manifest.invalid` — the schema is closed.

### Top-level `[plugin]` table

```toml
[plugin]
api_version = 2                        # required, must be 2
name = "My Plugin"                     # required, human-readable
slug = "ots-myplugin-plugin"           # required, must match pip dist name
version = "1.0.0"                      # required, semver-ish (`1.0`, `1.0.0`, `1.0.0a1` all OK)
author = "Your Name"                   # optional
license = "MIT"                        # optional
description = "What this plugin does"  # optional, shown in the Plugins list
docs_url = "https://github.com/you/x"  # optional, "View docs" link
icon = "ui/icon.svg"                   # optional, path relative to package
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `api_version` | int | yes | Must equal `2`. The schema rejects other values to keep future migrations clean. |
| `name` | string | yes | Shown in the Plugins list and modal dialogs. |
| `slug` | string | yes | Matches the pip dist name. Lowercase letters, digits, `-`, validated via regex `^[a-z0-9][a-z0-9-]*[a-z0-9]$`. Used as the URL prefix for blueprints (`/api/plugins/<slug>`). |
| `version` | string | yes | Semver-ish. Validator accepts `MAJOR.MINOR`, `MAJOR.MINOR.PATCH`, plus optional pre-release / build suffixes. |
| `author` | string | no | Free-form. |
| `license` | string | no | SPDX identifier preferred (`MIT`, `Apache-2.0`). |
| `description` | string | no | One-line, shown in the Plugins list. |
| `docs_url` | string | no | Must be `https://...` if set. |
| `icon` | string | no | Either a relative file path (e.g. `ui/icon.svg`) or a Tabler icon name like `tabler:icons:map-pin` — the dashboard's `<IconByName />` resolves both. |

### `[plugin.permissions]`

Declare every scope your plugin needs. The SDK enforces these at call time —
calling `OTS.cot.send` with no `write = ["cot"]` raises
`permission.write.cot` and the call never fires.

```toml
[plugin.permissions]
read = ["eud", "geochat", "kml"]
write = ["cot", "kml"]
mesh = true
mission = "read"          # one of "none", "read", "write"
admin_routes = false      # required to declare roles = ["administrator"] mounts
```

### `[[plugin.mount]]` array

Each `[[plugin.mount]]` block declares one mount point. Order matters only
for kinds where the dashboard lists them in document order (`subtab`,
`navbar_group_item`). All other kinds are unordered.

```toml
[[plugin.mount]]
kind = "tab"
label = "My Plugin"
icon = "tabler:icons:map-pin"
path = "/"
roles = ["administrator"]      # optional, default = any authed user

[[plugin.mount]]
kind = "map_overlay"
label = "My pins"
endpoint = "/pins"             # GET URL inside the plugin's blueprint

[[plugin.mount]]
kind = "background_worker"
handler = "ots_myplugin_plugin.handlers.refresh"
cron = "*/5 * * * *"           # apscheduler cron syntax
```

Each kind has its own required fields — see the
[Mount kinds — full table](#mount-kinds--full-table) below.

### Permission scopes — full table

| Scope | Grants | Enforced where |
|---|---|---|
| `read = ["eud"]` | `OTS.eud.online()`, `OTS.eud.find()` | `OTS.eud.*` decorators |
| `read = ["geochat"]` | `OTS.cot.subscribe("a-f-G-U-C")` and other CoT subscribe filters | `OTS.cot.subscribe` |
| `read = ["kml"]` | Read access to `/app/ots/kml/` via `OTS.storage` | `OTS.storage` decorator |
| `read = ["mission"]` | `OTS.mission.list/get` | `OTS.mission.*` |
| `read = ["cot"]` | `OTS.cot.subscribe` for any type | `OTS.cot.subscribe` |
| `read = ["config"]` | `OTS.config.get/all` (per-plugin scope) | implicit — own config |
| `read = ["storage"]` | `OTS.storage.read/list/exists/path` | `OTS.storage` decorators |
| `write = ["kml"]` | Write to `/app/ots/kml/` via `OTS.storage` | `OTS.storage` decorator |
| `write = ["cot"]` | `OTS.cot.send`, `OTS.cot.broadcast`, `OTS.eud.send_to` | `OTS.cot.*`, `OTS.eud.send_to` |
| `write = ["dp"]` | `OTS.dp.create()` (data package builder) | `OTS.dp.create` decorator |
| `write = ["storage"]` | `OTS.storage.write/delete` | `OTS.storage` decorators |
| `write = ["config"]` | `OTS.config.set/delete/clear` | implicit — own config |
| `mesh = true` | `OTS.mesh.publish`, `OTS.mesh.on_message` | `OTS.mesh.*` decorators |
| `mission = "read"` | `OTS.mission.list/get/list_content` | `OTS.mission.*` decorators |
| `mission = "write"` | All of `read` plus `create/invite/add_content/remove_content` | `OTS.mission.*` decorators |
| `admin_routes = true` | Lets the manifest declare `roles = ["administrator"]` mounts | mount-registry validation |

> **Pitfall:** scopes are declared in arrays of *strings*. Don't write
> `read = "eud"` (a single string) — that fails validation with
> `manifest.invalid`. Always use the list form: `read = ["eud"]`.

### Mount kinds — full table

| Kind | Server-side contract | UI component | Permissions impact |
|---|---|---|---|
| `tab` | Flask blueprint route at `/api/plugins/<slug>/ui` returning HTML | `MountTab` (iframe) | `roles` |
| `subtab` | Flask blueprint route at `/api/plugins/<slug>/ui<path>` | `MountSubTab` (iframe inside parent page's tabs) | host page's roles |
| `frame` | Flask blueprint serving HTML at `mount.path` | `MountFrame` (sandboxed iframe) | `roles` |
| `map_overlay` | GET `mount.endpoint` returning `{markers, lines, polygons}` | `MountMapOverlay` (LayerGroup of CircleMarkers and Polylines) | none |
| `map_drawer` | GET `mount.endpoint?eud_uid=<uid>` returning `{fields, text}` | `MountMapDrawer` (definition list inside Map drawer) | none |
| `dashboard_widget` | GET `mount.endpoint` returning `{title, value, subtitle, color, icon}` | `MountDashboardWidget` (Mantine Card) | `roles` |
| `navbar_group_item` | Flask blueprint route at `/plugin/<slug><path>` | `MountNavbarItem` (NavLink in existing nav group) | `roles` |
| `modal` | GET `mount.endpoint` returning HTML | `MountModal` (Mantine Modal, registered globally) | `roles` |
| `notification_handler` | Subscribes via `OTS.bus.on(...)` in plugin code | none — server-side only | n/a |
| `eud_action` | POST `mount.endpoint` `{eud_uid}` | `MountEudAction` (Menu.Item on EUDs row) | `roles` |
| `cot_handler` | GET `mount.endpoint?cot_type=<type>` returning render data | `MountCotHandler` (renders into Map) | none |
| `settings_section` | Flask blueprint serving HTML | `MountSettingsSection` (Paper panel in Settings page) | `administrator` |
| `toolbar_button` | POST `mount.endpoint` (no body) | `MountToolbarButton` (ActionIcon in header) | `roles` |
| `background_worker` | Callable referenced by `handler = "module.path:fn"`, scheduled via apscheduler | none — server-side only | n/a |
| `webhook` | POST `/api/plugins/<slug>/webhook` (unauthed) | none — server-side only | external (HMAC if declared) |
| `cli_command` | Click command at `opentakserver plugin <slug> <cmd>` | none | shell access |
| `mesh_channel_handler` | `OTS.mesh.on_message(channel=…)` subscription | none | requires `mesh = true` |
| `eud_qr_action` | GET `mount.endpoint?eud_uid=<uid>` returning `{qr, label?, hint?}` | `MountEudQrAction` (Menu.Item + QR Modal) | `administrator` |
| `data_package_generator` | GET `mount.endpoint` returning a Blob (DP zip or JSON `{url, filename}`) | `MountDpGenerator` (Menu in Data Packages page) | `roles` |
| `mission_content_provider` | Callable that pushes content via `OTS.mission.add_content` | none | requires `mission = "write"` |
| `socket_event` | Socket.IO handler registered via `OTS.bus` | none | n/a |
| `auth_backend` | Login route at `/api/plugins/<slug>/auth/<name>/start` | `MountAuthBackend` (Login provider button) | unauthed |

---

## SDK reference

The `OTS` symbol is the single import surface. Plugins use:

```python
from opentakserver.sdk import OTS
```

`OTS` is a namespace object exposing nine sub-modules. Every public function
is annotated, raises `OTSPluginError` (or subclass) on failure with a
machine-readable `code` field, and logs at INFO with `extra={"plugin": slug}`
so per-plugin filtering works in `/api/plugins/v2/<slug>/log`.

### `OTS.cot`

CoT (Cursor-on-Target) message I/O. Plugins use this to send markers, alerts,
and chat messages to ATAK clients, and to subscribe to incoming CoT events.

#### `OTS.cot.send(*, type, lat, lon, callsign, uid=None, to_uids="broadcast", stale=timedelta(minutes=5), remarks=None) -> str`

**Scope:** `write = ["cot"]`.

Send a CoT marker. Returns the event UID (auto-generated if `uid` is None).
`to_uids="broadcast"` fans the event out to every connected EUD via the
`cot_controller` exchange; passing a list of UIDs publishes one DM per UID
on the `dms` exchange.

```python
from datetime import timedelta
OTS.cot.send(
    type="b-m-p-s-p-i",
    lat=40.7128, lon=-74.0060,
    callsign="Alert",
    to_uids="broadcast",
    stale=timedelta(minutes=15),
    remarks="Watch this airspace",
)
```

**Pitfall:** the `type` string is the CoT cot-types convention — see
[mitre/cot-types](https://github.com/mitre/CoT) for the full taxonomy. Free-form
strings produce events that ATAK won't render correctly.

#### `OTS.cot.broadcast(*, type, lat, lon, callsign, **kwargs) -> str`

**Scope:** `write = ["cot"]`.

Convenience wrapper around `send(to_uids="broadcast")` that auto-mints a
uuid4 for `uid`. Use this for fire-and-forget alerts.

```python
event_uid = OTS.cot.broadcast(
    type="b-a-o-tbl",
    lat=40.7, lon=-74.0,
    callsign="Air-raid siren",
)
```

#### `OTS.cot.subscribe(cot_type_glob, handler) -> str`

**Scope:** `read = ["cot"]` (or `read = ["geochat"]` for chat-shaped events).

Subscribe a handler to incoming CoT events matching a type pattern.
`cot_type_glob` is a `fnmatch`-style glob (`b-r-f-h-c`, `a-f-G-*`, `*`).
Returns a subscription id; pass it to `unsubscribe(sub_id)` to stop.

```python
def on_casevac(event):
    OTS.notify.toast(title="CASEVAC received", message=event["uid"])
sub_id = OTS.cot.subscribe("b-r-f-h-c", on_casevac)
```

**Pitfall:** handlers run synchronously on the AMQP consumer thread. Don't
do blocking I/O in the handler — push expensive work onto a background
worker via `OTS.bus.emit(...)`.

#### `OTS.cot.unsubscribe(sub_id) -> bool`

**Scope:** none (no data access).

Remove a previously-registered subscription. Idempotent — returns `True` if
the id existed, `False` otherwise.

### `OTS.eud`

End-User Device (EUD) directory and DM API.

#### `OTS.eud.online(within=timedelta(minutes=5)) -> list[EudInfo]`

**Scope:** `read = ["eud"]`.

Return EUDs whose `last_event_time` falls within the given timedelta of now.
Pass `within=None` to lift the freshness filter and get all known EUDs.

```python
from datetime import timedelta
recent = OTS.eud.online(within=timedelta(minutes=2))
for eud in recent:
    print(eud.callsign, eud.last_lat, eud.last_lon)
```

**Pitfall:** `last_event_time` is naive UTC in the DB. The decorator
internally compares against `datetime.utcnow()` — passing a tz-aware
`timedelta` works, but mixing naive and aware datetimes elsewhere is a
recurring footgun.

#### `OTS.eud.find(*, uid=None, callsign=None) -> EudInfo | None`

**Scope:** `read = ["eud"]`.

Look up a single EUD by uid OR callsign (exactly one must be passed).
Returns `None` on no match. Raises `ValueError` if both or neither are given.

```python
eud = OTS.eud.find(callsign="Bravo-2")
if eud is None:
    raise RuntimeError("Bravo-2 not enrolled")
```

#### `OTS.eud.send_to(uid, cot_event_xml) -> None`

**Scope:** `write = ["cot"]` (per spec — DMs are CoT writes).

Send a raw CoT XML event to a single EUD's DM exchange. Use
`OTS.cot.send(to_uids=[uid], …)` for the structured-arg version; this is
the escape hatch for hand-rolled XML.

```python
OTS.eud.send_to("ANDROID-deadbeef", "<event uid=\"x\" type=\"b-m-p-s-m\"…/>")
```

#### `OTS.eud.geofence(name, polygon, on_enter=None, on_exit=None) -> str`

**Scope:** `read = ["eud"]`.

Register a polygon geofence. `polygon` is a list of `(lat, lon)` tuples.
`on_enter` and `on_exit` are callables receiving an `EudInfo` whenever an
EUD's last position transitions across the boundary. Returns a geofence id;
pass it to `OTS.eud.ungeofence(geofence_id)` to remove.

```python
green_zone = [(40.0, -74.0), (40.1, -74.0), (40.1, -73.9), (40.0, -73.9)]
gf_id = OTS.eud.geofence(
    name="Green zone",
    polygon=green_zone,
    on_enter=lambda eud: OTS.notify.atak(eud.uid, "OK", "Entered green zone"),
    on_exit=lambda eud: OTS.notify.atak(eud.uid, "WARN", "Left green zone"),
)
```

**Pitfall:** the geofence engine fires *transition* events only — it tracks
inside/outside state per EUD per geofence. If an EUD comes online inside a
fence, no `on_enter` fires until they leave and re-enter. Plan accordingly.

### `OTS.mesh`

Meshtastic mesh-radio I/O. Requires `mesh = true` in the manifest.

#### `OTS.mesh.publish(channel, message, *, to_node=None, from_user=None, hop_limit=3) -> str`

**Scope:** `mesh = true`.

Publish a text message to a Meshtastic channel via RabbitMQ MQTT bridge.
`channel` is one of `ALLCALL`, `SECURITY`, `PRODUCTION`, `STAFF`, `PKI`
(case-sensitive). `to_node` is an optional node id (e.g. `!a1b2c3d4`) for
unicast; broadcast otherwise. `hop_limit` is 1..7 — default 3.

```python
packet_id = OTS.mesh.publish(
    channel="STAFF",
    message="Status check: gates ready",
)
```

**Pitfall:** Meshtastic silently drops packets that violate any of five
gates (channel name, hop limit, gateway id, packet from, to). The SDK
constructs all of these correctly — but if your message disappears, check
the receiving node's logs for `MQTT.cpp::onReceiveProto` rejections.

#### `OTS.mesh.on_message(channel="*", handler) -> str`

**Scope:** `mesh = true`.

Subscribe to incoming mesh messages. `channel="*"` catches everything;
specifying a channel filters to just that one. Handler receives a
`MeshMessage` dataclass with `channel`, `from_node`, `text`, `timestamp`.

```python
def on_staff_message(msg):
    if "EMERGENCY" in msg.text.upper():
        OTS.notify.broadcast(type="b-a-o-tbl", lat=msg.lat, lon=msg.lon,
                              callsign="Mesh emergency")
sub_id = OTS.mesh.on_message(channel="STAFF", handler=on_staff_message)
```

### `OTS.mission`

ATAK mission API — create, invite, attach content. Mission "data packages"
let crew share files (KMLs, briefings, photos) over a server-mediated channel.

#### `OTS.mission.list() -> list[MissionInfo]`

**Scope:** `mission = "read"` or higher.

Return all missions. The dataclass `MissionInfo` has `name`, `description`,
`creator`, `created_at`, `member_count`, `content_count`.

#### `OTS.mission.get(name) -> MissionInfo`

**Scope:** `mission = "read"`.

Get one mission by name. Raises `mission.not_found` if missing.

#### `OTS.mission.create(*, name, description="", members=()) -> MissionInfo`

**Scope:** `mission = "write"`.

Create a new mission. `members` is an iterable of EUD uids or callsigns —
each one is invited via the same path as `invite()`. Raises `mission.exists`
on duplicate name.

```python
m = OTS.mission.create(
    name="Festival-Crew",
    description="Production team channel",
    members=["Alpha-1", "Bravo-2"],
)
```

#### `OTS.mission.invite(mission_name, identifier) -> None`

**Scope:** `mission = "write"`.

Invite a callsign or uid to an existing mission. Idempotent on the
`(mission, identifier)` tuple — repeat calls are no-ops.

#### `OTS.mission.add_content(mission_name, file_path, content_type=None) -> MissionContentInfo`

**Scope:** `mission = "write"`.

Attach a file to a mission. The SDK reads bytes from `file_path`, hashes
SHA-256, dedupes against existing content (idempotent on hash), persists to
`OTS_DATA_FOLDER/missions/`, and writes a `MissionChange` audit row.

```python
from pathlib import Path
content = OTS.mission.add_content(
    mission_name="Festival-Crew",
    file_path=Path("/tmp/briefing.kml"),
)
```

**Pitfall:** the SDK does *not* publish a `MissionChange` CoT to the
`missions` exchange — that broadcast is HTTP-thread-bound (it reads
`request.user_agent` for the creator uid). If you want ATAK clients to see
the change in real time, call `OTS.cot.broadcast(type="b-i-x-i", …)` after
`add_content` returns. See architectural decision **D-7** in the skill doc.

#### `OTS.mission.list_content(mission_name) -> list[MissionContentInfo]`

**Scope:** `mission = "read"`.

List all content attached to a mission.

#### `OTS.mission.remove_content(mission_name, content_hash) -> None`

**Scope:** `mission = "write"`.

Detach a piece of content (by SHA-256 hash) from a mission. Raises
`mission.content_not_found` if missing.

### `OTS.dp`

ATAK Data Package builder. A "data package" is a ZIP file containing a
manifest (`MANIFEST.xml`) plus payload files — KMLs, photos, CoT events.
ATAK clients import these via a one-tap URL.

#### `OTS.dp.create(name) -> DataPackageBuilder`

**Scope:** `write = ["dp"]`.

Returns a fluent builder. Chain calls to add KMLs, network links, markers,
or raw files; finalize with `.build()` (returns ZIP bytes) or `.share_url()`
(persists to disk and returns a `https://…/Marti/sync/content?hash=…` URL
that ATAK can hit directly).

```python
dp = OTS.dp.create("Friday-Show-Brief")
dp.add_kml("brief.kml", path="/tmp/brief.kml")
dp.add_marker(uid="rally-1", lat=40.7, lon=-74.0,
              callsign="Rally point", type="b-m-p-w-GOTO")
url = dp.share_url()
OTS.notify.atak(uid="Bravo-2", title="Brief", message=url)
```

**Pitfall:** `add_marker` validates lat/lon ranges (`-90..90`, `-180..180`)
and isoformat timestamps. Out-of-range values raise `dp.invalid_argument`.
Also, `build()` raises `dp.empty` if you've added zero entries — call
`.add_*` at least once before finalizing.

### `OTS.config`

Per-plugin scoped configuration. Each plugin gets its own
`/app/ots/plugins/<slug>/config.yml` file; reads always re-parse the file,
so external admin edits land immediately.

#### `OTS.config.get(key, default=None) -> Any`

Read a config value. Returns `default` if the key isn't set.

#### `OTS.config.set(key, value) -> None`

Persist a config value. Writes are atomic (tempfile + `os.replace`), so
concurrent reads see either the old or the new file — never a partial write.

```python
OTS.config.set("api_key", "sk-…")
key = OTS.config.get("api_key", default="")
```

#### `OTS.config.delete(key) -> bool`

Remove one key. Returns `True` if the key existed.

#### `OTS.config.all() -> dict[str, Any]`

Return the entire plugin config as a dict.

#### `OTS.config.clear() -> None`

Remove every key. Used mostly in tests.

**Pitfall:** all `OTS.config.*` calls require a *plugin context* — they must
be invoked from inside a plugin blueprint view, scheduled task, or other
plugin entry point. Calling from raw script context (e.g. an interactive
shell) raises `config.no_plugin_context`. The loader's
`_with_plugin_context` wrapper handles this for blueprints and apscheduler
jobs automatically.

### `OTS.storage`

Per-plugin scoped file storage. Each plugin gets its own
`/app/ots/plugins/<slug>/storage/` directory. Path-traversal attacks
(absolute paths, `..`, resolved-symlink escapes) are rejected with
`storage.path_traversal`.

#### `OTS.storage.write(path, content) -> None`

**Scope:** `write = ["storage"]`.

Write `content` (bytes or str) to `path` relative to the plugin's storage
root. Atomic write — same semantics as `OTS.config.set`.

#### `OTS.storage.read(path) -> bytes`

**Scope:** `read = ["storage"]`.

Read raw bytes.

#### `OTS.storage.read_text(path, encoding="utf-8") -> str`

**Scope:** `read = ["storage"]`.

Read decoded text. Wraps `read()` + `decode()`.

#### `OTS.storage.exists(path) -> bool`

**Scope:** `read = ["storage"]`.

Test whether a file exists at the path.

#### `OTS.storage.list() -> list[str]`

**Scope:** `read = ["storage"]`.

Recursive POSIX-relative paths under the plugin's storage root, sorted.

#### `OTS.storage.delete(path) -> None`

**Scope:** `write = ["storage"]`.

Remove a file. Refusing directories with `storage.is_directory` — recursive
deletes are intentional opt-ins, do them yourself with `shutil.rmtree` if
needed (and only on paths within your plugin's storage root).

#### `OTS.storage.path(path) -> Path`

**Scope:** `read = ["storage"]`.

Return the absolute `Path` object for a relative storage key. Use this when
you need to hand a file path to a third-party library (e.g. PIL, ffmpeg) —
they need an absolute path, not a stream.

```python
img_path = OTS.storage.path("preview.png")
Image.open(img_path).resize((128, 128)).save(img_path)
```

**Pitfall:** non-bytes/str writes raise `storage.bad_content` — e.g. passing
a `dict` will fail. Serialize first (`json.dumps(d).encode()`).

### `OTS.bus`

In-process event bus. Plugins emit events; other plugins (and core) subscribe.

#### `OTS.bus.on(event, handler) -> str`

Subscribe to an event pattern. `event` accepts `fnmatch`-style globs:
`"cot.*"`, `"eud.position"`, `"*"`. Returns a subscription id.

```python
def on_eud_connected(payload):
    print("EUD online:", payload["uid"])
sub_id = OTS.bus.on("eud.connected", on_eud_connected)
```

#### `OTS.bus.off(sub_id) -> bool`

Remove a subscription by id. Idempotent.

#### `OTS.bus.emit(event, payload) -> int`

Fire an event. Returns the number of handlers invoked. Sync handlers run on
the calling thread; async handlers (`async def`) are dispatched onto the
running asyncio loop, or to a registered loop, or to a daemon-thread fallback.

```python
OTS.bus.emit("myplugin.alert.fired", {"uid": "alert-1", "level": "high"})
```

**Pitfall:** `emit("core.something", …)` from inside a plugin context raises
`bus.reserved_namespace`. The `core.*` namespace is reserved for OpenTAKServer
core events — pick a slug-prefixed namespace for your own events
(`myplugin.*`).

#### `OTS.bus.subscribers(event=None) -> int`

Count of registered subscribers. Pass `event=None` to count globally;
otherwise count handlers matching the given event pattern.

#### `OTS.bus.clear() -> None`

Remove every subscription. Test-only — warns at runtime if
`OTS_TESTING != "1"`.

### `OTS.notify`

Toasts, ATAK alerts, broadcasts, email.

#### `OTS.notify.toast(title, message, *, level="info", timeout_ms=4000, to_users=None) -> None`

Show a Mantine toast in connected dashboards. `level` is `info`/`success`/
`warning`/`error`. `to_users=["alice","bob"]` filters client-side (every
dashboard receives the payload, but only matching users render the toast —
see decision **D-6**).

```python
OTS.notify.toast(
    title="Build complete",
    message="ots-myplugin v1.2 published",
    level="success",
    to_users=["alex"],
)
```

#### `OTS.notify.atak(uid_or_callsign, title, message, *, cot_type="b-a-o-tbl", stale_minutes=5) -> str`

**Scope:** inherits `write = ["cot"]` from `OTS.cot.send`.

Send an alert to a single ATAK/iTAK client. Internally resolves the target
via `OTS.eud.find`, then dispatches a `b-a-o-tbl` (the alert CoT type) DM.
Raises `notify.unknown_target` if the uid/callsign isn't enrolled.

```python
OTS.notify.atak("Bravo-2", "Re-route", "Use Gate B instead of Gate A")
```

#### `OTS.notify.broadcast(*, type, lat, lon, callsign, **kwargs) -> str`

**Scope:** `write = ["cot"]`.

Convenience wrapper for `OTS.cot.broadcast`. Fans an alert to every
connected EUD.

#### `OTS.notify.email(to, subject, body, *, html=None) -> bool`

Send a transactional email via Flask-Mailman. Returns `False` (and logs a
warning) if `OTS_ENABLE_EMAIL` is unset — emails fail open so a missing SMTP
config doesn't break plugin code.

**Pitfall:** the SMTP config lives in the OpenTAKServer container's env, not
in the plugin. If your plugin uses email, document the required env vars in
your README so the operator knows to configure them.

---

## Mount points cookbook

Each mount kind below lists: **Use this when…**, **Render contract**,
**Endpoint contract**, and **Permissions impact**.

### `tab`

**Use this when:** your plugin is a whole feature deserving its own top-level
page (MapMarker, Meshtastic, your custom dashboard).

**Render contract:** the dashboard renders an iframe at
`/api/plugins/<slug>/ui<mount.path>` — your plugin's blueprint must serve
HTML at that route.

**Endpoint contract:** Flask blueprint route returning HTML. The base
template should include the OpenTAKServer dashboard's session cookie, since
the iframe runs same-origin.

**Permissions impact:** `roles = ["administrator"]` requires
`admin_routes = true`.

### `subtab`

**Use this when:** your feature is a focused subview of a core page (e.g.
a "ALPR feed" subtab inside the Map page).

**Render contract:** rendered as a `<Tabs.Tab>` inside the parent page's
existing `<Tabs>`. The host page calls `getSubTabs(parent)` to splice your
tabs in.

**Endpoint contract:** like `tab`, an iframe at the plugin's blueprint UI
route.

**Permissions impact:** inherits the host page's role gating.

### `frame`

**Use this when:** you have legacy or external content (a Grafana panel, a
third-party UI) you want to drop into a dashboard slot.

**Render contract:** sandboxed iframe (`sandbox="allow-scripts
allow-same-origin"`) at `mount.path` (fully-qualified URL). Failed loads
show "Access denied" instead of a blank pane.

**Endpoint contract:** any URL. CORS, X-Frame-Options on the target are
your responsibility — verify the upstream allows iframe embedding.

**Permissions impact:** `roles` controls who sees the frame.

### `map_overlay`

**Use this when:** you want to draw points, lines, or polygons on the Map
page (KML, AIS feed, geofences, ALPR detections).

**Render contract:** react-leaflet `<LayerGroup>` of canvas-paned
`<CircleMarker>` + `<Polyline>` + `<Polygon>`. The canvas pane is essential
for high-cardinality feeds — DOM markers tank perf above ~500 entities.

**Endpoint contract:** GET `mount.endpoint` returning JSON:
```json
{
  "markers": [{"lat": 40.7, "lon": -74.0, "name": "Pin", "desc": "Note"}],
  "lines":   [{"points": [[40.7,-74.0],[40.8,-74.0]], "color": "#0f0", "weight": 2}],
  "polygons":[{"points": [[40,-74],[41,-74],[41,-73],[40,-73]], "fillColor": "#ff0"}]
}
```
Polled every 5 minutes. Transient fetch failures keep the prior geometry.

**Permissions impact:** none — visible to anyone on the Map page.

### `map_drawer`

**Use this when:** you want to add a section to the slide-out drawer that
opens when a user clicks an EUD on the Map.

**Render contract:** Mantine `<Stack>` rendered inside the drawer when an
EUD is selected.

**Endpoint contract:** GET `mount.endpoint?eud_uid=<uid>` returning either
`{fields: {key: value, ...}}` (rendered as a definition list) or
`{text: "..."}` (rendered as pre-wrapped text), or both.

**Permissions impact:** none.

### `dashboard_widget`

**Use this when:** you want a status card on the Dashboard page (KPI count,
status badge, mini-graph).

**Render contract:** Mantine `<Card>` with title + big value + subtitle +
optional icon and color. Last-known-good values are preserved across
transient fetch failures.

**Endpoint contract:** GET `mount.endpoint` returning
`{title, value, subtitle, color, icon}`. Polled every 30 seconds.

**Permissions impact:** `roles` controls who sees the card.

### `navbar_group_item`

**Use this when:** you have an admin-flavored utility that belongs inside
an existing nav group (Admin, Plugins).

**Render contract:** a `<NavLink>` inside the existing group, with an icon
and active-state highlight.

**Endpoint contract:** Flask blueprint route at
`/plugin/<slug><mount.path>`.

**Permissions impact:** `roles` controls visibility of the nav link.

### `modal`

**Use this when:** you have a reusable picker (file, callsign), confirmation
dialog, or other modal-style UI that any other plugin/page might want to
trigger.

**Render contract:** Mantine `<Modal>` registered globally. Open it from
anywhere with `otsModal.open(slug)`.

**Endpoint contract:** GET `mount.endpoint` returning HTML, served inside
a sandboxed iframe.

**Permissions impact:** `roles` controls who can open the modal.

### `notification_handler`

**Use this when:** you want to react to events ("EUD X went offline", "Alert
from CASEVAC") and emit Mantine notifications.

**Render contract:** none — server-side only.

**Endpoint contract:** none — register your handler via
`OTS.bus.on(event_name, handler)` in your plugin's `__init__.py` `activate()`.

**Permissions impact:** none.

### `eud_action`

**Use this when:** you want to add a row-action to the EUDs/Markers tables
("Send mission package", "Push video stream", "Force re-enroll").

**Render contract:** Mantine `<Menu.Item>` in the EUDs row-action menu, with
an `IconBolt` lightning icon.

**Endpoint contract:** POST `mount.endpoint` with body `{eud_uid: "..."}`.
Return `{success, message}` for success or `{error, detail}` for failure.

**Permissions impact:** `roles` controls who sees the menu item.

### `cot_handler`

**Use this when:** you want a custom renderer for specific CoT types (custom
marker icons, tooltip content).

**Render contract:** registers a `(cotType, endpoint)` entry in the Map's
CoT renderer registry. The Map page uses `cotHandlerRegistry.resolve(type)`
during its render loop to pick your renderer over the default.

**Endpoint contract:** GET `mount.endpoint?cot_type=<type>` returning render
data. The CoT type is derived from the `cot_type=` query param on the
endpoint, or from a `[type]` prefix on the label, or catch-all (`""`).

**Permissions impact:** none.

### `settings_section`

**Use this when:** your plugin has its own config UI that should live inside
the Settings page.

**Render contract:** Mantine `<Paper>` panel with iframe body. HEAD-checks
the endpoint on mount, so a broken plugin shows a friendly error instead of
a blank iframe.

**Endpoint contract:** Flask blueprint serving HTML.

**Permissions impact:** `administrator` (hard-gated — settings are for admins).

### `toolbar_button`

**Use this when:** you want a quick global action (New CASEVAC, New Mission,
Trigger sync).

**Render contract:** Mantine `<ActionIcon>` in the right-side global toolbar
with a tooltip and a busy state during the request.

**Endpoint contract:** POST `mount.endpoint` (no body). Return
`{success, message}` for success or `{error, detail}` for failure.

**Permissions impact:** `roles` controls visibility.

### `background_worker`

**Use this when:** you need to poll an external API or run a periodic sync.

**Render contract:** none — server-side only.

**Endpoint contract:** the manifest references a callable via
`handler = "module.path:fn"`. The loader schedules it via apscheduler with
`id = "<slug>.<handler>"`, using the cron expression from `cron = "*/5 * * * *"`.

```toml
[[plugin.mount]]
kind = "background_worker"
handler = "ots_myplugin_plugin.handlers.refresh"
cron = "*/5 * * * *"
```

**Permissions impact:** none — runs with whatever scopes the manifest
declares.

### `webhook`

**Use this when:** you need to receive POSTs from an external system (Slack,
GitHub, PagerDuty).

**Render contract:** none — server-side only.

**Endpoint contract:** an unauthed POST endpoint at
`/api/plugins/<slug>/webhook<mount.path>`. Optionally declare `hmac_secret =
"env:MY_PLUGIN_SECRET"` in the manifest to require an `X-Signature` header
that the loader verifies before invoking your handler.

**Permissions impact:** unauthed by design — anybody can call it. Use HMAC.

### `cli_command`

**Use this when:** you have maintenance tasks or data exports you want
operators to run on the command line.

**Render contract:** none.

**Endpoint contract:** a Click command registered at
`opentakserver plugin <slug> <cmd>`. The manifest references a Click command
factory:
```toml
[[plugin.mount]]
kind = "cli_command"
handler = "ots_myplugin_plugin.cli:my_command"
```

**Permissions impact:** shell access (operators only).

### `mesh_channel_handler`

**Use this when:** your plugin owns one Meshtastic channel for a custom
purpose (alert channel, sensor payloads).

**Render contract:** none.

**Endpoint contract:** equivalent to calling
`OTS.mesh.on_message(channel="…", handler=…)` at activate time. The manifest
references the handler:
```toml
[[plugin.mount]]
kind = "mesh_channel_handler"
channel = "ALERTS"
handler = "ots_myplugin_plugin.handlers.on_alert"
```

**Permissions impact:** requires `mesh = true`.

### `eud_qr_action`

**Use this when:** you need to push plugin-specific config to ATAK/iTAK via
a QR scan (video URL, channel join, custom marker template).

**Render contract:** Mantine `<Menu.Item>` triggering a `<Modal>` with a
`<QRCode>`.

**Endpoint contract:** GET `mount.endpoint?eud_uid=<uid>` returning
`{qr: "<string-to-encode>", label: "Scan with iTAK", hint: "..."}`.

**Permissions impact:** `administrator`.

### `data_package_generator`

**Use this when:** you want to bundle plugin output (KMLs, briefings) for
ATAK import via the "Generate Data Package" menu in the Data Packages page.

**Render contract:** Mantine `<Menu.Item>` in the Data Packages page menu.

**Endpoint contract:** GET `mount.endpoint` returning either
`{url, filename}` JSON (browser navigates to the URL) or a binary Blob with
`Content-Disposition: attachment; filename="…"` (browser triggers a download).

**Permissions impact:** `roles`.

### `mission_content_provider`

**Use this when:** you want to push files into a mission programmatically
(mission-specific KMLs, briefings).

**Render contract:** none.

**Endpoint contract:** the manifest references a callable that calls
`OTS.mission.add_content(...)` on schedule or on event:
```toml
[[plugin.mount]]
kind = "mission_content_provider"
handler = "ots_myplugin_plugin.handlers.publish_mission_kml"
trigger = "cron:*/15 * * * *"
```

**Permissions impact:** requires `mission = "write"`.

### `socket_event`

**Use this when:** you need real-time chat handlers, presence tracking, or
custom Socket.IO message exchange with dashboard JS.

**Render contract:** none.

**Endpoint contract:** registers a Socket.IO event handler. Use
`OTS.bus.on("socket.<event>", handler)` from your plugin's activate.

**Permissions impact:** none — Socket.IO clients are already
session-authenticated.

### `auth_backend`

**Use this when:** you want to provide an alternative login mechanism (OIDC,
SAML, custom directory).

**Render contract:** Mantine `<Button>` rendered on the Login page below the
standard form. Clicking calls `window.location.assign` to
`/api/plugins/<slug>/auth/<name>/start`.

**Endpoint contract:** the plugin's blueprint must own
`/auth/<name>/start` and `/auth/<name>/callback` routes implementing the
auth flow.

**Permissions impact:** unauthed by design — these routes are visible to
anyone who can reach the Login page.

---

## Vanilla → v2 migration

Migrating a vanilla plugin to SDK v2 is purely additive. The MapMarker
plugin's migration is the canonical reference — see
`/docker/opentak/plugins/ots-mapmarker-plugin/` for the full diff.

### Step 1: Add `plugin.toml`

Drop a `plugin.toml` next to your `__init__.py`. Mirror your existing
`pyproject.toml` metadata, declare scopes, and list your existing UI
surfaces as v2 mounts:

```toml
[plugin]
api_version = 2
name = "MapMarker"
slug = "ots-mapmarker-plugin"
version = "1.2"
author = "Alstergee"
license = "MIT"
description = "Google Drive KML sync for OpenTAKServer"
docs_url = "https://github.com/alstergee/ots-mapmarker-plugin#readme"
icon = "ui/icon.svg"

[plugin.permissions]
read = ["kml", "config", "storage"]
write = ["kml", "storage", "dp"]
mesh = false
mission = "none"
admin_routes = true

[[plugin.mount]]
kind = "tab"
label = "Map Marker"
icon = "tabler:icons:map-pin"
path = "/"
roles = ["administrator"]

[[plugin.mount]]
kind = "map_overlay"
label = "Map Marker pins"
endpoint = "/files"

[[plugin.mount]]
kind = "data_package_generator"
label = "Generate ATAK Data Package"
endpoint = "/data_package"
```

### Step 2: Ship `plugin.toml` in the wheel

Extend `pyproject.toml`:

```toml
[tool.setuptools.package-data]
"ots_mapmarker_plugin" = ["plugin.toml", "ui/*.svg"]
```

`pip install` doesn't ship `.toml` files by default. Without this entry your
wheel installs but the manifest is missing — the server treats your plugin
as vanilla and the v2 mounts are silently dropped.

### Step 3: Wire v2 plugin context (optional but recommended)

If you want SDK helpers like `OTS.config.set` or `OTS.storage.write` to
work inside your existing vanilla blueprint views, push the v2 context on
each request:

```python
# In your plugin's app.py / __init__.py
def _push_v2_plugin_context():
    try:
        from opentakserver.sdk.permissions import push_plugin
        from flask import current_app
        v2 = current_app.extensions.get("plugin_manager_v2")
        if v2 is None:
            return
        manifest = v2.by_slug("ots-mapmarker-plugin")
        if manifest is not None:
            push_plugin(manifest)
    except Exception:
        # Defensive — never break vanilla on a v2 wiring bug.
        pass

def _pop_v2_plugin_context():
    try:
        from opentakserver.sdk.permissions import pop_plugin
        pop_plugin()
    except Exception:
        pass

blueprint.before_request(_push_v2_plugin_context)
blueprint.teardown_request(lambda exc: _pop_v2_plugin_context())
```

The loader does this automatically for v2-native blueprints (`tab`,
`subtab`, `frame`, `navbar_group_item`, `webhook`) — but vanilla plugins
don't go through the loader, so they need to push the context manually.

### Step 4: Migrate config writes (optional)

Vanilla plugins typically write to `/app/ots/config.yml` (the global
config). v2 plugins should write to `/app/ots/plugins/<slug>/config.yml`
via `OTS.config.set`:

```python
def update_config(self, key, value):
    # Prefer v2 per-plugin config when a plugin context is active.
    try:
        from opentakserver.sdk import OTS
        from opentakserver.sdk.permissions import current_plugin
        if current_plugin() is not None:
            OTS.config.set(key, value)
            return
    except Exception:
        pass
    # Fall back to legacy global config so vanilla loaders still work.
    self._legacy_update_config(key, value)
```

This pattern preserves vanilla compatibility — plugins on the legacy
endpoint still write to the global yaml — while v2 contexts get
per-plugin scoping for free.

### Step 5: Build, install, verify

```bash
cd ots-mapmarker-plugin
python -m build
docker exec opentakserver pip install --force-reinstall --no-deps \
    /app/wheels/ots_mapmarker_plugin-1.2-py3-none-any.whl
docker restart opentakserver
docker logs opentakserver | grep "Plugin SDK v2"
# Plugin SDK v2: discovered 1, registered 1
```

Visit `/plugins` — your plugin should now show the `SDK v2` badge with the
correct mount summary.

---

## Lifecycle hooks

### `activate(app)` — boot time

Vanilla plugins implement `Plugin.activate(app)` to register blueprints,
event subscribers, and scheduled tasks. v2 plugins do the same — the
loader calls `activate(app)` after validating the manifest and before
registering mounts.

```python
class MyPlugin(Plugin):
    def activate(self, app):
        from opentakserver.sdk import OTS
        # Subscribe to incoming CoT events
        OTS.cot.subscribe("b-r-f-h-c", self.on_casevac)
        # Schedule a periodic sync
        scheduler = app.extensions.get("apscheduler")
        if scheduler:
            scheduler.add_job(self.refresh, trigger="cron", minute="*/5",
                              id="myplugin.refresh", replace_existing=True)
        return self.blueprint
```

`activate` runs exactly once per worker process at boot. If you have
multiple worker processes (gunicorn `--workers > 1`), `activate` runs in
each worker — make sure your subscriptions and scheduled tasks are
idempotent.

### `stop()` — shutdown

Optional. Override to release resources (close connections, drop
subscriptions). Most plugins don't need this — Python's garbage collector
and the AMQP consumer's natural shutdown handle the common cases.

```python
def stop(self):
    if self._sub_id:
        OTS.cot.unsubscribe(self._sub_id)
```

### Reload — admin endpoint

`POST /api/plugins/v2/<slug>/reload` (admin-gated) re-imports the plugin
package, re-validates the manifest, and re-registers all mounts. This is
useful during development — bump your version, `pip install --force-reinstall`,
hit reload, and your changes are live without a full server restart.

### `before_request` / `teardown_request` v2 context wiring

For vanilla plugins migrating to v2 (Step 3 above), the
`before_request`/`teardown_request` hooks push and pop the v2 plugin
context so SDK helpers resolve `current_plugin()` correctly inside vanilla
blueprint views. The wrapper is `_with_plugin_context(manifest, fn)` in
`opentakserver.sdk.loader_v2` — v2-native blueprints get this for free.

---

## Testing your plugin

### Setting up pytest

A typical `tests/conftest.py` for a plugin:

```python
import pytest
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
import flask_security.fsqla_v3 as fsqla
import pkgutil
import opentakserver.models

@pytest.fixture
def app(tmp_path, monkeypatch):
    monkeypatch.setenv("OTS_DATA_FOLDER", str(tmp_path))
    monkeypatch.setenv("OTS_TESTING", "1")
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["TESTING"] = True
    db = SQLAlchemy(app)
    fsqla.FsModels.set_db_info(db)
    # Register every model so create_all sees the full schema
    for _, modname, _ in pkgutil.iter_modules(opentakserver.models.__path__):
        __import__(f"opentakserver.models.{modname}")
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()
```

This in-memory SQLite fixture is the same pattern used by
`opentakserver/sdk/tests/test_eud.py` and `test_mission.py`. The
`FsModels.set_db_info` + `pkgutil.iter_modules` dance is required because
the User/Role/fsqla model chain otherwise fails with
`'NoneType' has no attribute 'relationship'`.

### Pushing a plugin context

To exercise SDK calls under a plugin context:

```python
from opentakserver.sdk.manifest import PluginManifest, PluginPermissions
from opentakserver.sdk.permissions import push_plugin, pop_plugin

@pytest.fixture
def plugin_ctx():
    manifest = PluginManifest(
        api_version=2,
        name="Test",
        slug="test-plugin",
        version="1.0.0",
        permissions=PluginPermissions(
            read=["eud", "cot"],
            write=["cot"],
        ),
        mount=[],
    )
    push_plugin(manifest)
    yield manifest
    pop_plugin()
```

### Mocking AMQP and Socket.IO

`OTS.cot.send` ultimately calls `_amqp_publish` to push to RabbitMQ.
Patch the module-level seam:

```python
def test_send_publishes(monkeypatch, plugin_ctx):
    sent = []
    monkeypatch.setattr(
        "opentakserver.sdk.modules.cot._amqp_publish",
        lambda exchange, routing_key, body: sent.append((exchange, routing_key, body)),
    )
    OTS.cot.broadcast(type="b-m-p-s-p-i", lat=40.7, lon=-74.0, callsign="X")
    assert len(sent) == 1
    exchange, routing_key, body = sent[0]
    assert exchange == "cot_controller"
    assert "<event " in body["cot"]
```

### Testing mounts

Mounts are validated as part of manifest parsing. To round-trip a manifest:

```python
from opentakserver.sdk.manifest import load_manifest

def test_manifest_loads(tmp_path):
    (tmp_path / "plugin.toml").write_text("""
[plugin]
api_version = 2
name = "Test"
slug = "test-plugin"
version = "1.0.0"

[plugin.permissions]
read = ["eud"]

[[plugin.mount]]
kind = "tab"
label = "Test"
path = "/"
""")
    manifest = load_manifest(tmp_path / "plugin.toml")
    assert manifest.slug == "test-plugin"
    assert len(manifest.mount) == 1
    assert manifest.mount[0].kind == "tab"
```

### CI pipeline

A GitHub Actions skeleton:

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -e .[test]
      - run: pip install opentakserver
      - run: pytest -xvs
```

---

## Marketplace

The marketplace is a JSON file at a fixed URL that the dashboard fetches
to populate the **Browse marketplace** tab in the Add-plugin modal. The
default URL is the `marketplace.json` in the
[alstergee/OpenTAKServer](https://github.com/alstergee/OpenTAKServer) repo
on the `main` branch.

### Configure the URL

Set `OTS_PLUGIN_MARKETPLACE_URL` in the OpenTAKServer container env to
override (e.g. point at your own fork):

```bash
OTS_PLUGIN_MARKETPLACE_URL=https://raw.githubusercontent.com/me/my-fork/main/marketplace.json
```

The server caches the response for five minutes.

### JSON shape

```json
{
  "version": 1,
  "updated_at": "2026-05-08T12:00:00Z",
  "plugins": [
    {
      "slug": "ots-mapmarker-plugin",
      "name": "MapMarker",
      "version": "1.2",
      "description": "Google Drive KML sync for OpenTAKServer",
      "author": "Alstergee",
      "license": "MIT",
      "icon": "https://raw.githubusercontent.com/alstergee/ots-mapmarker-plugin/main/ui/icon.svg",
      "docs_url": "https://github.com/alstergee/ots-mapmarker-plugin#readme",
      "source": "ots-mapmarker-plugin",
      "tags": ["kml", "data-package"],
      "sdk": "v2",
      "min_ots_version": "1.4.0"
    }
  ]
}
```

### Required fields

| Field | Required | Notes |
|---|---|---|
| `slug` | yes | Pip dist name. Must match the plugin's `plugin.toml` slug. |
| `name` | yes | Human-readable. |
| `version` | yes | Latest published version. The dashboard compares this against the installed version to decide whether to show "Update → X". |
| `description` | yes | One-liner shown in the marketplace list. |
| `source` | yes | Pip-installable spec. Usually the slug for PyPI; can be a wheel URL or `git+https://...` for fork installs. |
| `sdk` | recommended | `v1` or `v2`. Vanilla plugins get the `vanilla — SDK v1` badge in the dashboard. |
| `icon` | optional | `https://...` URL to an SVG/PNG. |
| `docs_url` | optional | Link to the plugin's docs page. |
| `author` | optional | Free-form. |
| `license` | optional | SPDX. |
| `tags` | optional | Used for filter/search in a future iteration. |
| `min_ots_version` | optional | If set, the dashboard hides this entry on older OTS releases. |

### Publishing

To get your plugin listed on the canonical marketplace, open a PR against
`alstergee/OpenTAKServer` adding your entry to `marketplace.json`. Include
a CI test that hits your wheel URL and verifies the manifest loads.

For private/internal marketplaces, host your own JSON behind any HTTPS URL
and point `OTS_PLUGIN_MARKETPLACE_URL` at it.

---

## FAQ and error codes

### `manifest.invalid`

**What it means:** the `plugin.toml` failed Pydantic validation.

**How to fix:** the error detail (in `/api/plugins/v2/<slug>/log`) names
the field. Common causes:

- `api_version` not set or not equal to `2`
- `slug` doesn't match the regex `^[a-z0-9][a-z0-9-]*[a-z0-9]$`
- `version` doesn't parse as semver-ish
- A scope appears as a string (`read = "eud"`) instead of a list (`read = ["eud"]`)
- An unknown top-level key is present (the schema is strict — `extra = "forbid"`)

### `permission.read.<scope>` / `permission.write.<scope>`

**What it means:** your plugin called an SDK helper without declaring the
required scope. E.g. calling `OTS.eud.online()` without `read = ["eud"]`.

**How to fix:** add the missing scope to your manifest's `[plugin.permissions]`,
rebuild the wheel, reinstall, restart.

### `permission.mesh`

**What it means:** called `OTS.mesh.publish` without `mesh = true`.

**How to fix:** set `mesh = true` in `[plugin.permissions]`.

### `permission.mission.<level>`

**What it means:** called `OTS.mission.create` (write-only) with
`mission = "read"`, or any mission helper with `mission = "none"`.

**How to fix:** bump `mission` to the right level. Note the levels are
`none < read < write` — `write` includes `read`.

### `bus.reserved_namespace`

**What it means:** a plugin tried to `OTS.bus.emit("core.something", ...)`.
The `core.*` namespace is reserved for OpenTAKServer core events.

**How to fix:** prefix your event name with your slug (or any non-`core`
namespace): `OTS.bus.emit("myplugin.something", ...)`.

### `config.no_plugin_context`

**What it means:** `OTS.config.get/set/delete` was called outside of a
plugin context. Common causes:

- Calling from an interactive shell (no manifest is registered)
- Calling from a vanilla plugin that didn't push the v2 plugin context
  (see [Vanilla → v2 migration](#vanilla--v2-migration), Step 3)
- Calling from a thread that doesn't inherit the plugin contextvar

**How to fix:** for vanilla plugins, wire `before_request`/`teardown_request`
hooks. For threads, copy the contextvar:

```python
import contextvars
ctx = contextvars.copy_context()
threading.Thread(target=lambda: ctx.run(my_handler)).start()
```

### `storage.path_traversal`

**What it means:** a path passed to `OTS.storage.*` resolved outside the
plugin's storage root. Either the path was absolute, contained `..`, or
the resolved symlink chain led outside the root.

**How to fix:** use simple relative paths like `"foo/bar.json"`. If you
need to read from somewhere else, use `OTS.storage.path(key)` for legitimate
keys then access the absolute Path directly — but never pass user-supplied
paths through `OTS.storage` without validation.

### `storage.is_directory`

**What it means:** `OTS.storage.delete(path)` was called on a path that
resolves to a directory.

**How to fix:** delete files individually, or do recursive deletion yourself
with `shutil.rmtree(OTS.storage.path("dirname"))`. The SDK refuses
recursive deletes by default to prevent oopses.

### `storage.bad_content`

**What it means:** `OTS.storage.write(path, content)` was passed a value
that's neither bytes nor str.

**How to fix:** serialize first — e.g. `json.dumps(d).encode()` for dicts,
`str(value).encode()` for primitives.

### `mesh.protobuf_missing`

**What it means:** the Meshtastic protobuf module isn't installed in the
OpenTAKServer container.

**How to fix:** rebuild the OpenTAKServer image with the
`meshtastic` pip package included. (Default base image already has it.)

### `notify.unknown_target`

**What it means:** `OTS.notify.atak("unknown-callsign", ...)` couldn't find
an EUD with that uid or callsign.

**How to fix:** ensure the target is enrolled. Use `OTS.eud.find()` to
verify before calling `notify.atak`, or catch the error and fall back to
`notify.broadcast`.

### `dp.empty`

**What it means:** `dp.build()` was called on a builder with no entries.

**How to fix:** add at least one of `add_kml`, `add_kmz`, `add_marker`,
`add_network_link`, or `add_file` before calling `build()`.

### `dp.source_missing`

**What it means:** `add_kml(name, path=...)` referenced a path that doesn't
exist on disk.

**How to fix:** check the file path. The SDK reads sources at
`add_*` time, not at `build()` time, so the path must exist when you call
`add_kml`.

### `mission.exists` / `mission.not_found`

**What it means:** `mission.create(name=...)` collided with an existing
mission, or `mission.get(name=...)` referenced a nonexistent mission.

**How to fix:** check existence before creating, or rename. Use
`OTS.mission.list()` to enumerate names.

### `scheduler.bad_cron`

**What it means:** a `background_worker` mount's `cron` expression failed
apscheduler's parser.

**How to fix:** validate your cron expression at
[crontab.guru](https://crontab.guru). Note apscheduler uses 5-field cron
(no seconds), not 6-field.

### Plugin doesn't show up in `/plugins`

**Common causes:**

1. `plugin.toml` not shipped in the wheel (missing `package-data` entry).
2. Entry point not declared in `pyproject.toml`'s `[project.entry-points."opentakserver.plugin"]`.
3. Manifest validation failed silently — check
   `docker logs opentakserver | grep -i plugin` for `manifest.invalid`.
4. Plugin disabled — check `OTS_PLUGIN_DISABLED` in `/app/ots/config.yml`.

### Plugin shows up but mounts don't render

**Common causes:**

1. Endpoint URLs aren't auto-prefixed by `/api/plugins/<slug>` — for now,
   write the full path yourself in `mount.endpoint`. See architectural
   decision **D-8** in the skill doc; the auto-prefix is queued.
2. UI mount component isn't yet wired into the host page (e.g. `cot_handler`
   needs Map.tsx integration). Check `MountCotHandler.tsx` for the consumer
   seam.
3. The dashboard's mount registry hasn't refreshed — wait 60 seconds (the
   poll interval) or re-login.

### How do I debug a plugin's logs?

```bash
docker logs opentakserver 2>&1 | grep "plugin=ots-myplugin-plugin"
```

Every SDK helper logs with `extra={"plugin": slug}`. The
`/api/plugins/v2/<slug>/log` endpoint surfaces the last N lines via the
dashboard's "View Logs" menu item — useful when SSH access isn't available.

---

*Last updated: 2026-05-09.*
*Source of truth: `/docker/opentak/PLUGIN-SDK-V2.md`,
`/docker/opentak/.claude/skills/ots-plugin-architecture/SKILL.md`.*
