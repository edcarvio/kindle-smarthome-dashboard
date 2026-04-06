# Kindle SmartHome Dashboard

An interactive Home Assistant dashboard running on a jailbroken Kindle PW3 (e-ink). Forked from [1RandomDev/kindle-smarthome-dashboard](https://github.com/1RandomDev/kindle-smarthome-dashboard), customized for a Dublin-based smart home.

![Dashboard](images/project-picture.jpg)

### Features
- 5-day weather forecast (Open-Meteo)
- Temperature + humidity cards (indoor/outdoor)
- 24h temperature history charts
- Light/switch toggles with real-time state updates
- Shutter controls (open/stop/close)
- Intercom door opener + incoming call status
- Kindle battery indicator
- Power button refreshes e-ink screen

### Architecture

```
Kindle PW3 (mesquite browser) <--WebSocket--> HA Add-on (Node.js proxy) <--WebSocket--> Home Assistant
```

The WebSocket proxy translates the Kindle's outdated WebSocket version into something Home Assistant understands.

### Setup

#### Home Assistant Add-on (recommended)
1. Copy the `ha-addon` directory to `/addons/kindle-dashboard-proxy` on your HA server
2. In HA: Settings > Apps > App Store > Reload > Install **Kindle Dashboard Proxy**
3. The add-on uses the Supervisor API token automatically — no manual token needed

#### Manual Proxy (alternative)
1. Copy `websocket-proxy/config.sample.json` to `config.json` and fill in your HA URL + access token
2. Run with `node main.js`

#### Kindle Extension
Requires a [jailbroken Kindle](https://kindlemodding.org/jailbreaking/) with KUAL installed.
1. Copy `smarthomedisplay` to the `extensions` folder on your Kindle
2. Copy `mesquite/config.sample.js` to `mesquite/config.js` and set your proxy WebSocket URL
3. Open KUAL > SmartHome Display > Launch

#### Power Button
- **Short press**: full screen refresh (clears e-ink ghosting)
- **Long hold**: Kindle hardware restart (exits dashboard)

### Based on
[1RandomDev/kindle-smarthome-dashboard](https://github.com/1RandomDev/kindle-smarthome-dashboard) — [Reddit Post](https://www.reddit.com/r/homeassistant/comments/1n97ox2/my_kindle_smarthome_dashboard/)
