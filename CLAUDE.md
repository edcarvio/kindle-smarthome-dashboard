# Kindle SmartHome Dashboard

## What This Is

An interactive Home Assistant dashboard running on a jailbroken Kindle PW3 (e-ink).
Based on [1RandomDev/kindle-smarthome-dashboard](https://github.com/1RandomDev/kindle-smarthome-dashboard), heavily customized.

## Architecture

```
Kindle PW3 (mesquite browser) ←WebSocket→ HA Add-on (Node.js proxy) ←WebSocket→ Home Assistant API
```

- **Kindle side** (`smarthomedisplay/`): KUAL extension with local HTML/CSS/JS dashboard
- **Proxy** (`ha-addon/`): HA add-on running Node.js WebSocket proxy on port 4365
- **HA**: At `192.168.0.198:8123`, proxy authenticates via Supervisor API token (auto-injected)

The proxy exists because the Kindle's old WebKit uses an outdated WebSocket version incompatible with HA.

## Project Structure

```
smarthomedisplay/
  bin/run.sh              # Launcher: stops Kindle UI, registers app, starts mesquite
  mesquite/
    index.html            # Dashboard layout
    css/index.css         # All styling (e-ink optimized: black/white/gray only)
    js/index.js           # WebSocket client, entity updates, charts, button handlers
    js/chart.min.js       # Chart.js for temperature graphs
    js/error-logger.js    # Debug overlay (controlled by DEBUG_MODE in config.js)
    config.js             # WebSocket URL, weather coords, display settings (GITIGNORED)
    config.sample.js      # Template for config.js
    img/                  # SVG icons for buttons, cards, weather, badges
  config.xml              # KUAL extension metadata
  menu.json               # KUAL menu entry

ha-addon/                 # Home Assistant add-on (deployed to HA server)
  Dockerfile
  config.yaml             # Add-on metadata, port mapping
  run.sh                  # Entry point: uses SUPERVISOR_TOKEN, no hardcoded secrets
  websocket-proxy/        # Node.js proxy source

websocket-proxy/          # Local dev copy (for testing on Mac with `node main.js`)
  config.json             # Local HA token (GITIGNORED)
```

## Development Workflow

### Preview changes (fast iteration)
```bash
open smarthomedisplay/mesquite/index.html
```
Edit files, refresh browser (Cmd+R). WebSocket won't connect but layout/weather/styling renders.

### Deploy to Kindle
1. Plug Kindle via USB (mounts at `/Volumes/Kindle/`)
2. Copy files:
```bash
yes | cp -r smarthomedisplay/mesquite/* /Volumes/Kindle/extensions/smarthomedisplay/mesquite/
```
3. If `bin/run.sh` changed:
```bash
yes | cp smarthomedisplay/bin/run.sh /Volumes/Kindle/extensions/smarthomedisplay/bin/run.sh
chmod +x /Volumes/Kindle/extensions/smarthomedisplay/bin/run.sh
```
4. Eject Kindle, launch: KUAL → SmartHome Display

### Deploy proxy to HA server
```bash
scp -r ha-addon root@192.168.0.198:/addons/kindle-dashboard-proxy
```
Then in HA UI: Settings → Apps → Kindle Dashboard Proxy → Rebuild/Restart

## Adding New Entities

### Toggle button (light/switch)
In `index.html`, add inside `#buttonsWidget`:
```html
<div class="button" data-entity-id="light.entity_id">
    <div class="icon"><img src="img/buttons/ceiling-light.svg"></div>
    <div class="title">Name</div>
</div>
```
The JS automatically extracts domain from entity ID for the correct service call.

### Sensor card
```html
<div class="card" data-entity-id="sensor.entity_id">
    <div class="title">NAME</div>
    <div class="row">
        <div class="icon"><img src="img/cards/temp-outside.svg"></div>
        <div class="value"><span class="val">-</span><span class="val-unit">°C</span></div>
    </div>
</div>
```

### Combo card (temp + humidity in one card)
```html
<div class="card combo-card">
    <div class="title">ROOM NAME</div>
    <div class="row">
        <div class="icon"><img src="img/cards/temp-outside.svg"></div>
        <div class="value">
            <span class="val" data-entity-id="sensor.temp_entity">-</span><span class="val-unit">°C</span>
            <span class="val-separator"> | </span>
            <span class="val" data-entity-id="sensor.humidity_entity">-</span><span class="val-unit">%</span>
        </div>
    </div>
</div>
```

### Cover/shutter (open/stop/close)
```html
<div class="shutter-row">
    <div class="shutter-icon"><img src="img/buttons/shutter.svg"></div>
    <div class="shutter-name">Name</div>
    <div class="shutter-actions">
        <div class="shutter-action" data-cover="cover.entity_id" data-action="open"><img src="img/buttons/arrow-up.svg"></div>
        <div class="shutter-action" data-cover="cover.entity_id" data-action="stop"><img src="img/buttons/stop.svg"></div>
        <div class="shutter-action" data-cover="cover.entity_id" data-action="close"><img src="img/buttons/arrow-down.svg"></div>
    </div>
</div>
```

### Button press (e.g., intercom door)
```html
<div class="intercom-row">
    <div class="intercom-icon"><img src="img/buttons/door-open.svg"></div>
    <div class="intercom-name">Name</div>
    <div class="intercom-action">
        <div class="intercom-btn" data-button="button.entity_id">PRESS</div>
    </div>
</div>
```

### Binary sensor status
```html
<div class="intercom-row">
    <div class="intercom-icon"><img src="img/buttons/intercom.svg"></div>
    <div class="intercom-name">Name</div>
    <div class="intercom-status" data-entity-id="binary_sensor.entity_id">
        <span class="intercom-state">--</span>
    </div>
</div>
```

## Important Constraints

### Kindle's old WebKit
- No ES6+: use `var`, not `let`/`const`. No arrow functions. No template literals.
- No `fetch()`: use `XMLHttpRequest`
- Date parsing: `new Date('2026-04-06T12:00')` may fail. Parse manually with `split('-')`.
- No CSS flexbox/grid: use `float`, `display: table-cell`, `inline-block`

### E-ink display
- Colors: black, white, and grays only. No color.
- Screen resolution: ~1024x758 in landscape mode
- `eips -f` does a full screen refresh (clears ghosting)
- `eips -c` clears the framebuffer (destroys content — avoid)

### Sensitive files (GITIGNORED)
- `websocket-proxy/config.json` — contains HA access token
- `smarthomedisplay/mesquite/config.js` — contains local IP and proxy token
- `ha-addon/websocket-proxy/config.json` — not deployed (proxy uses SUPERVISOR_TOKEN)

### Power button behavior
- Short press: screen refresh (`eips -f`)
- Long hold: Kindle hardware restart (exits dashboard, returns to normal Kindle UI)

## HA Entities Currently on Dashboard

**Lights/Switches:** kitchen, tv_room, corridor, bedroom, office, floor_lamp, donut_lamp
**Sensors:** outdoor temp (Nibe F730), living room temp+humidity, office temp+humidity
**Charts:** indoor 24h temp, outdoor 24h temp (refresh every 30min)
**Covers:** bedroom shutter, office shutter
**Intercom:** comelit open door (button press), incoming call (binary sensor)
**Weather:** 5-day forecast via Open-Meteo API (Dublin coordinates)
