# Kindle SmartHome Dashboard

An interactive Home Assistant dashboard running on a jailbroken Kindle PW3 e-ink display. Touch buttons toggle lights, control shutters, open the intercom door — all with real-time state updates via WebSocket.

Forked from [1RandomDev/kindle-smarthome-dashboard](https://github.com/1RandomDev/kindle-smarthome-dashboard).

![Dashboard](images/project-picture.jpg)

## Features

- **Weather** — 5-day forecast via Open-Meteo (works worldwide, no API key needed)
- **Sensor cards** — Temperature + humidity with combo cards (indoor/outdoor)
- **Temperature charts** — 24h history for indoor and outdoor, auto-refresh every 30 min
- **Light controls** — Toggle any light or switch with instant visual feedback
- **Shutter controls** — Open / Stop / Close buttons for roller shutters
- **Intercom** — Door opener button + incoming call status indicator
- **Battery** — Kindle battery level with dynamic icon (full/medium/low)
- **Clock** — Time, date, and timezone-aware (Europe/Dublin)
- **Power button** — Short press refreshes screen (clears e-ink ghosting), long hold restarts Kindle

## Architecture

```
Kindle PW3 (mesquite browser)
    |
    | WebSocket (old protocol)
    v
HA Add-on: Node.js Proxy (port 4365)
    |
    | WebSocket (modern protocol)
    v
Home Assistant API
```

The Kindle PW3 uses an old WebKit browser with an outdated WebSocket implementation. The Node.js proxy bridges this gap — translating the old protocol to Home Assistant's modern WebSocket API, and handling resource-intensive operations server-side.

## Prerequisites

- **Kindle PW3** (or similar) — jailbroken with [WinterBreak](https://kindlemodding.org/jailbreaking/)
- **KUAL** installed on the Kindle ([MobileRead guide](https://www.mobileread.com/forums/showthread.php?t=225030))
- **Home Assistant** — with HAOS (for the add-on approach) or any install with API access
- **WiFi** — Kindle must be on the same network as your HA server

## Setup Guide

### Step 1: Install the WebSocket Proxy on Home Assistant

The proxy runs as a Home Assistant add-on — it starts automatically with HA and requires no manual token configuration.

1. **Copy the add-on to your HA server** via SSH:
   ```bash
   scp -r ha-addon root@YOUR_HA_IP:/addons/kindle-dashboard-proxy
   ```
   > If SSH isn't enabled, install the **Terminal & SSH** add-on in HA first (Settings > Apps > search "Terminal & SSH"), add your SSH public key in its Configuration tab, set port 22, and start it.

2. **Install the add-on** in HA:
   - Go to **Settings > Apps > App Store**
   - Click the **three dots** (top right) > **Check for updates**
   - Scroll to **Local apps** — you should see **"Kindle Dashboard Proxy"**
   - Click it > **Install** > **Start**

3. **Verify** in the add-on's **Log** tab — you should see:
   ```
   [homeassistant] Sucessfully authenticated
   [kindle-display] Starting WebSocket server on port 4365
   ```

> **How it works:** The add-on uses Home Assistant's Supervisor API token (auto-injected) to authenticate with HA. No long-lived access token needed.

#### Alternative: Run Proxy Manually

If you're not using HAOS, you can run the proxy on any machine with Node.js:

1. `cd websocket-proxy`
2. `cp config.sample.json config.json`
3. Edit `config.json` — set your HA URL and a [long-lived access token](http://YOUR_HA_IP:8123/profile/security)
4. `npm install && node main.js`

### Step 2: Configure the Kindle Extension

1. **Copy the extension** to your Kindle via USB:
   ```bash
   cp -r smarthomedisplay /Volumes/Kindle/extensions/smarthomedisplay
   ```

2. **Create the config file:**
   ```bash
   cp smarthomedisplay/mesquite/config.sample.js smarthomedisplay/mesquite/config.js
   ```

3. **Edit `config.js`** with your settings:
   ```javascript
   var DEBUG_MODE = false;
   var WS_URL = 'ws://YOUR_HA_IP:4365?accessToken=kindle_ha_dashboard';
   var WEATHER_LAT = 53.37;    // Your latitude
   var WEATHER_LON = -6.39;    // Your longitude
   ```
   > The `accessToken` here is a shared secret between the Kindle and the proxy (not your HA token). It must match the `kindle-display.accessToken` in the proxy config. Default: `kindle_ha_dashboard`.

4. **Copy the updated config to the Kindle** (if editing on your computer):
   ```bash
   cp smarthomedisplay/mesquite/config.js /Volumes/Kindle/extensions/smarthomedisplay/mesquite/config.js
   ```

5. **Eject the Kindle**, connect to WiFi, and launch:
   **KUAL > SmartHome Display > Launch SmartHome Display**

### Step 3: Using the Dashboard

- **Tap light/switch buttons** to toggle them — they highlight when on
- **Tap shutter arrows** to open/stop/close roller shutters
- **Tap "PRESS"** on the intercom row to open the door
- **Short press power button** to refresh the e-ink screen (clears ghosting)
- **Long hold power button** to restart the Kindle and exit the dashboard

## Customizing the Dashboard

### Adding Entities

The dashboard is a plain HTML/CSS/JS app in `smarthomedisplay/mesquite/`. All entities are defined in `index.html` with `data-entity-id` attributes.

**Light or switch toggle:**
```html
<div class="button" data-entity-id="light.your_light">
    <div class="icon"><img src="img/buttons/ceiling-light.svg"></div>
    <div class="title">Light Name</div>
</div>
```

**Sensor card:**
```html
<div class="card" data-entity-id="sensor.your_sensor">
    <div class="title">SENSOR NAME</div>
    <div class="row">
        <div class="icon"><img src="img/cards/temp-outside.svg"></div>
        <div class="value"><span class="val">-</span><span class="val-unit">°C</span></div>
    </div>
</div>
```

**Combo card (temperature + humidity):**
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

**Shutter (open/stop/close):**
```html
<div class="shutter-row">
    <div class="shutter-icon"><img src="img/buttons/shutter.svg"></div>
    <div class="shutter-name">Shutter Name</div>
    <div class="shutter-actions">
        <div class="shutter-action" data-cover="cover.your_cover" data-action="open"><img src="img/buttons/arrow-up.svg"></div>
        <div class="shutter-action" data-cover="cover.your_cover" data-action="stop"><img src="img/buttons/stop.svg"></div>
        <div class="shutter-action" data-cover="cover.your_cover" data-action="close"><img src="img/buttons/arrow-down.svg"></div>
    </div>
</div>
```

**Button press (e.g., door opener):**
```html
<div class="intercom-btn" data-button="button.your_button">PRESS</div>
```

### Development Workflow

The fastest way to iterate on the dashboard:

1. **Preview in your browser:**
   ```bash
   open smarthomedisplay/mesquite/index.html
   ```
   Edit files, refresh with Cmd+R. Layout and weather render without WebSocket.

2. **Deploy to Kindle** when happy:
   ```bash
   yes | cp -r smarthomedisplay/mesquite/* /Volumes/Kindle/extensions/smarthomedisplay/mesquite/
   ```

3. Eject and relaunch on Kindle.

### Customizing with Claude Code + HA MCP

This project includes a `CLAUDE.md` with full project documentation. When using [Claude Code](https://claude.ai/code) in this directory, Claude automatically understands the project structure, Kindle constraints, and deployment workflow.

For the best experience, connect Claude Code to your Home Assistant via the [HA MCP server](https://github.com/hjdhjd/homebridge-hap-mcp). This allows Claude to:

- **Query your HA entities** directly to find the right entity IDs
- **Search for sensors, lights, covers** without you looking them up manually
- **Design dashboard layouts** based on your actual devices

Example workflow:
```
You: "Add my garage door to the dashboard"
Claude: [queries HA MCP for cover entities] → [finds cover.garage_door] → [adds HTML + deploys to Kindle]
```

## Important: Kindle WebKit Constraints

The Kindle PW3 runs an old WebKit browser. When editing the JavaScript:

- **No ES6+**: use `var`, not `let`/`const`. No arrow functions, no template literals.
- **No `fetch()`**: use `XMLHttpRequest`
- **Date parsing**: `new Date('2026-04-06T12:00')` may fail. Parse manually.
- **No CSS flexbox/grid**: use `float`, `display: table-cell`, `inline-block`
- **Colors**: black, white, and grays only (e-ink display)

## Credits

- [1RandomDev](https://github.com/1RandomDev/kindle-smarthome-dashboard) — original project and architecture
- [Reddit post](https://www.reddit.com/r/homeassistant/comments/1n97ox2/my_kindle_smarthome_dashboard/) — original discussion
- [KindleModding](https://kindlemodding.org/) — jailbreak and modding community
- [NiLuJe](https://www.mobileread.com/forums/showthread.php?t=225030) — KUAL, MRInstaller, and Kindle hacking tools
