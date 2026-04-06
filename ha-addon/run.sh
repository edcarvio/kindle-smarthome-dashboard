#!/usr/bin/with-contenv bashio

# Get the HA access token from the Supervisor API (auto-provided to add-ons)
HA_TOKEN="${SUPERVISOR_TOKEN}"
HA_URL="http://supervisor/core"

# Write config.json for the proxy
cat > /app/config.json <<EOF
{
    "homeassistant": {
        "wsUrl": "${HA_URL}",
        "accessToken": "${HA_TOKEN}"
    },
    "kindle-display": {
        "accessToken": "kindle_ha_dashboard"
    }
}
EOF

bashio::log.info "Starting Kindle Dashboard WebSocket proxy on port 4365..."
bashio::log.info "HA URL: ${HA_URL}"

cd /app
exec node main.js
