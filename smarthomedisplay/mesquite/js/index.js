function refreshScreen() {
    refreshBox.style.display = 'block';
    refreshBox.style.backgroundColor = null;
    setTimeout(function() {
        refreshBox.style.backgroundColor = '#fff';
    }, 200);
    setTimeout(function() {
        refreshBox.style.display = null;
    }, 400);
}

function setScreenBrightness(val) {
    if(ws && ws.readyState == WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'call_service',
            domain: 'input_number',
            service: 'set_value',
            entityId: 'input_number.kindle_display_brightness',
            data: { value: val }
        }));
    }

    if(!window.kindle) return;
    kindle.messaging.sendStringMessage(
        'com.kindlemodding.utild', 'runCMD',
        'echo '+(val*40)+' > /sys/devices/platform/imx-i2c.0/i2c-0/0-003c/max77696-bl.0/backlight/max77696-bl/brightness'
    );
}

// Device features
var nightMode = null, backlightTimer = null;
var container = document.getElementsByClassName('container')[0];
if(window.kindle) {
    document.querySelector('.vertical-section.left').onclick = function() {
        if(nightMode || backlightTimer) return;
        setScreenBrightness(SCREEN_BRIGHTNESS_NIGHT);
        backlightTimer = setTimeout(function() {
            setScreenBrightness(SCREEN_BRIGHTNESS_DEFAULT);
            backlightTimer = null;
        }, 30000);
    };
}

// Close app button
document.getElementById('closeApp').onclick = function() {
    if(window.kindle) {
        kindle.messaging.sendStringMessage(
            'com.kindlemodding.utild', 'runCMD',
            'start lab126_gui'
        );
    } else {
        window.close();
    }
};

// Clock widget — Europe/Dublin timezone (GMT/IST)
var daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var clockTime = document.getElementById('clockTime'),
    clockDate = document.getElementById('clockDate');
clockTime.onclick = function() { location.reload(); };
clockDate.onclick = function() { refreshScreen(); };
function formatDuration(seconds) {
    if(seconds < 60) {
        return seconds+'s';
    } else if(seconds < 3600) {
        return Math.floor(seconds / 60)+'min';
    } else if(seconds < 86400) {
        return Math.floor(seconds / 3600)+'h';
    } else if(seconds < 2629746) {
        return Math.floor(seconds / 86400)+'d';
    }
    return Math.floor(seconds / 2629746)+'m';
}
function padTime(num) {
    return ('0'+num).slice(-2);
}
function formatTime(date) {
    return padTime(date.getHours())+':'+padTime(date.getMinutes());
}
function isMidnight(date) {
    return date.getHours() == 0 && date.getMinutes() == 0;
}
function getLocalDate(value) { // TZ: Europe/Dublin (GMT/IST)
    var date = value ? new Date(value) : new Date();
    if(date.getTimezoneOffset() != 0) return date;

    var year = date.getUTCFullYear();

    // Last Sunday in March at 01:00 UTC — clocks go forward
    var start = new Date(Date.UTC(year, 2, 31, 1));
    while(start.getUTCDay() !== 0) {
        start.setUTCDate(start.getUTCDate() - 1);
    }

    // Last Sunday in October at 01:00 UTC — clocks go back
    var end = new Date(Date.UTC(year, 9, 31, 1));
    while(end.getUTCDay() !== 0) {
        end.setUTCDate(end.getUTCDate() - 1);
    }

    // Between start and end = IST (UTC+1), else GMT (UTC+0)
    var offset = (date >= start && date < end) ? 3600000 /* 1h */ : 0;
    date.setTime(date.getTime()+offset);
    return date;
}
function updateClock() {
    var date = getLocalDate();
    clockTime.innerText = formatTime(date);
    clockDate.innerText = daysOfWeek[date.getDay()]+', '+date.getDate()+' '+months[date.getMonth()]+' '+date.getFullYear();

    // Time based events
    var hours = date.getHours(), minutes = date.getMinutes();
    if(minutes == 0) {
        if(hours == 2 || hours == 14) {
            refreshScreen();
        }
    }

    var timeToNextMin = 60000 - Date.now() % 60000 + 50;
    setTimeout(updateClock, timeToNextMin);
}
updateClock();

// Kindle battery — reads from battery.js global variable (written by run.sh)
var batteryIconEl = document.getElementById('batteryIcon');
var batteryLevelEl = document.getElementById('batteryLevel');
function updateBatteryDisplay() {
    if(typeof KINDLE_BATTERY === 'undefined' || KINDLE_BATTERY < 0) return;
    var level = parseInt(KINDLE_BATTERY);
    batteryLevelEl.innerText = level + '%';
    if(level > 60) {
        batteryIconEl.src = 'img/battery-full.svg';
    } else if(level > 20) {
        batteryIconEl.src = 'img/battery-medium.svg';
    } else {
        batteryIconEl.src = 'img/battery-low.svg';
    }
}
function reloadBattery() {
    // Reload battery.js by injecting a new script tag
    var s = document.createElement('script');
    s.src = 'battery.js?' + Date.now();
    s.onload = function() {
        updateBatteryDisplay();
        document.head.removeChild(s);
    };
    document.head.appendChild(s);
}
updateBatteryDisplay();
setInterval(reloadBattery, 60000);

// Weather widget — using Open-Meteo API (works worldwide)
var weatherForecasts = document.querySelectorAll('#weatherWidget .forecast');

// WMO weather code to icon mapping
function wmoCodeToIcon(code) {
    if(code <= 1) return 'clear';
    if(code <= 3) return 'partly-cloudy';
    if(code <= 48) return 'fog';
    if(code <= 55) return 'rain';
    if(code <= 57) return 'rain';
    if(code <= 65) return 'rain';
    if(code <= 67) return 'sleet';
    if(code <= 75) return 'snow';
    if(code == 77) return 'snow';
    if(code <= 82) return 'rain';
    if(code <= 86) return 'snow';
    if(code >= 95) return 'thunderstorm';
    return 'cloudy';
}

function updateWeather() {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude='+WEATHER_LAT+'&longitude='+WEATHER_LON
        +'&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=Europe%2FDublin&forecast_days=5';

    var req = new XMLHttpRequest();
    req.onreadystatechange = function() {
        if(this.readyState != 4 || this.status != 200) return;

        var data = JSON.parse(this.responseText);
        var daily = data.daily;

        for(var i = 0; i < daily.time.length && i < 5; i++) {
            // Parse date manually for old WebKit compatibility
            var parts = daily.time[i].split('-');
            var date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
            var dayIndex = date.getDay();
            var icon = wmoCodeToIcon(daily.weather_code[i]);
            var dayName = (i == 0) ? 'Today' : (daysOfWeek[dayIndex] || daily.time[i].slice(5));

            var forecastElement = weatherForecasts[i];
            forecastElement.getElementsByClassName('day')[0].innerText = dayName;
            forecastElement.getElementsByTagName('img')[0].src = 'img/weather/'+icon+'.svg';
            forecastElement.getElementsByClassName('temp')[0].innerText = Math.round(daily.temperature_2m_max[i]) + '°';
            forecastElement.getElementsByClassName('temp-sm')[0].innerText = Math.round(daily.temperature_2m_min[i]) + '°';
        }
    };
    req.open('GET', url);
    req.send();
}
updateWeather();
setInterval(updateWeather, 7200000); // 2h

// Temperature history charts
function createTempChart(canvasId) {
    var ctx = document.getElementById(canvasId).getContext('2d');
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                data: [],
                fill: true,
                borderColor: '#333',
                backgroundColor: 'rgba(0,0,0,0.06)',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            legend: { display: false },
            scales: {
                xAxes: [{
                    display: true,
                    gridLines: { color: '#e0e0e0' },
                    ticks: { fontSize: 11, color: '#888', maxTicksLimit: 6 }
                }],
                yAxes: [{
                    display: true,
                    gridLines: { color: '#e0e0e0' },
                    ticks: { fontSize: 11, color: '#888', stepSize: 1, callback: function(v) { if(v % 1 !== 0) return ''; return Math.round(v) + '°'; } }
                }]
            },
            tooltips: { enabled: false },
            hover: { mode: null },
            animation: { duration: 0 }
        }
    });
}
var indoorChart = createTempChart('indoorChart');
var outdoorChart = createTempChart('outdoorChart');

var TEMP_INDOOR_ENTITY = 'sensor.f730_r_1x230v_room_temperature_bt50';
var TEMP_OUTDOOR_ENTITY = 'sensor.f730_r_1x230v_current_outd_temp_bt1';

var notificationList = document.getElementById('notificationList');
var buttonTimers = {}, notifications = {};
// Track entity attributes for light popup (brightness, color_temp, supported modes)
var entityAttrs = {};
var ws;
function createSocket() {
    ws = new WebSocket(WS_URL);
    var hearbeatTimer, receivedPong;

    ws.onopen = function() {
        log('Connecting to server');
        receivedPong = true;
        hearbeatTimer = setInterval(function() {
            if(!receivedPong) {
                logError('WebSocket connection timed out');
                ws.close();
            }
            if (ws.readyState === WebSocket.OPEN) {
                receivedPong = false;
                ws.send('ping');
            }
        }, 10000);

        var dataEntities = document.querySelectorAll('[data-entity-id]');
        var subscribeEntities = [];
        for(var i=0; i<dataEntities.length; i++) {
            subscribeEntities.push(dataEntities[i].dataset.entityId);
        }
        ws.send(JSON.stringify({
            type: 'init',
            subscribeEntities: subscribeEntities,
            subscribeEvents: ['kindle_display']
        }));
        ws.send(JSON.stringify({
            type: 'fire_event',
            name: 'kindle_display',
            data: { action: 'init' }
        }));
        // Fetch temperature history for both sensors
        function fetchHistory() {
            if(!ws || ws.readyState !== WebSocket.OPEN) return;
            ws.send(JSON.stringify({
                type: 'fetch_history',
                entityId: TEMP_INDOOR_ENTITY
            }));
            ws.send(JSON.stringify({
                type: 'fetch_history',
                entityId: TEMP_OUTDOOR_ENTITY
            }));
        }
        fetchHistory();
        // Refresh charts every 30 minutes
        setInterval(fetchHistory, 1800000);
    };

    ws.onmessage = function(event) {
        if(event.data == 'pong') {
            receivedPong = true;
            return;
        }
        var msg = JSON.parse(event.data);
        switch(msg.type) {
            case 'state_change':
                Object.keys(msg.states).forEach(function(entityId) {
                    var state = msg.states[entityId];
                    // Store attributes for light popup controls
                    if(state.a) {
                        entityAttrs[entityId] = state.a;
                    }
                    // Find all elements with this entity ID (supports combo cards with multiple spans)
                    var elements = document.querySelectorAll('[data-entity-id="'+entityId+'"]');
                    for(var ei=0; ei<elements.length; ei++) {
                    var element = elements[ei];
                    if(!element) continue;
                    if(element.classList.contains('badge')) {
                        // Badge
                        if(element.dataset.valType == 'battery') {
                            element.getElementsByTagName('img')[0].src = 'img/badges/battery-'+(Math.ceil((state.s||1) / 20) * 20)+'.svg';
                            element.getElementsByClassName('val')[0].innerText = state.s;
                        } else if(element.dataset.valType == 'value') {
                            element.getElementsByClassName('val')[0].innerText = state.s;
                        } else if(element.dataset.valType == 'last-triggered' && state.a.last_triggered) {
                            var lastTriggered = getLocalDate(state.a.last_triggered.replace(/-/g, '/').replace('T', ' ').split('.')[0]+' UTC');
                            element.getElementsByClassName('value')[0].innerText = formatTime(lastTriggered);
                        }
                    } else if(element.tagName == 'SPAN' && element.classList.contains('val')) {
                        // Combo card inline value
                        element.innerText = (state.s == 'unavailable' || state.s == 'unknown') ? '-/-' : state.s;
                    } else if(element.classList.contains('card')) {
                        // Card
                        element.getElementsByClassName('val')[0].innerText = (state.s == 'unavailable' || state.s == 'unknown') ? '-/-' : state.s;
                    } else if(element.classList.contains('button')) {
                        // Button (lights + covers)
                        if(buttonTimers[entityId]) clearTimeout(buttonTimers[entityId]);
                        var isOn = (state.s == 'on' || state.s == 'open');
                        if(isOn) {
                            element.classList.add('active');
                        } else {
                            element.classList.remove('active');
                        }
                        if(state.s == 'unavailable') {
                            element.classList.add('disabled');
                        } else {
                            element.classList.remove('disabled');
                        }
                    } else if(element.classList.contains('intercom-status')) {
                        // Intercom call status
                        updateIntercomStatus(entityId, state);
                    }
                    } // end for loop over elements
                });
                break;
            case 'history':
                function fillChart(chart, datapoints) {
                    chart.data.labels = [];
                    chart.data.datasets[0].data = [];
                    var now = getLocalDate();
                    var startHour = now.getHours() - datapoints.length + 1;
                    for(var hi=0; hi<datapoints.length; hi++) {
                        var h = ((startHour + hi) % 24 + 24) % 24;
                        chart.data.labels.push(padTime(h) + ':00');
                        chart.data.datasets[0].data.push(datapoints[hi].mean);
                    }
                    chart.update();
                }
                if(msg.history[TEMP_INDOOR_ENTITY]) {
                    fillChart(indoorChart, msg.history[TEMP_INDOOR_ENTITY]);
                }
                if(msg.history[TEMP_OUTDOOR_ENTITY]) {
                    fillChart(outdoorChart, msg.history[TEMP_OUTDOOR_ENTITY]);
                }
                break;
            case 'event':
                if(msg.name == 'kindle_display') {
                    if(msg.data.action == 'show_notification' && msg.data.icon && msg.data.id) {
                        var id = msg.data.id;
                        if(!notifications[id]) {
                            var notification = {
                                icon: msg.data.icon
                            };
                            if(msg.data.timeout) {
                                notification.timer = setTimeout(function() {
                                    notificationList.removeChild(notification.element);
                                    delete notifications[id];
                                }, msg.data.timeout);
                            }

                            var element = document.createElement('div');
                            element.classList.add('notification');
                            element.innerHTML = '<img src="'+notification.icon+'">';
                            notificationList.appendChild(element);
                            notification.element = element;

                            notifications[id] = notification;
                        }
                    } else if(msg.data.action == 'delete_notification' && msg.data.id) {
                        var id = msg.data.id;
                        var notification = notifications[id];
                        if(notification) {
                            notificationList.removeChild(notification.element);
                            delete notifications[id];
                        }
                    }
                }
                break;
        }
    }

    ws.onclose = function(event) {
        logError('WebSocket connection closed, reconnecting in 10s');
        clearInterval(hearbeatTimer);
        setTimeout(function() {
            createSocket();
        }, 10000);
    };

    ws.onerror = function() {
        logError('WebSocket error');
        clearInterval(hearbeatTimer);
    };
}
if(WS_URL) createSocket();

// Buttons widget — tap to toggle, [...] button to open detail popup
var buttons = document.querySelectorAll('#buttonsWidget .button');
function setButtonState(button, state) {
    if(state) {
        button.classList.add('active');
    } else {
        button.classList.remove('active');
    }
}
function toggleButton(button) {
    var entityId = button.dataset.entityId;
    if(button.classList.contains('disabled') || !ws) return;

    var isActive = button.classList.contains('active');
    if(buttonTimers[entityId]) clearTimeout(buttonTimers[entityId]);
    buttonTimers[entityId] = setTimeout(function() {
        setButtonState(button, isActive);
    }, 4000);
    setButtonState(button, !isActive);

    var targetEntity = button.dataset.entityAction || entityId;
    var domain = targetEntity.split('.')[0];
    ws.send(JSON.stringify({
        type: 'call_service',
        domain: domain,
        entityId: targetEntity,
        service: 'toggle'
    }));
}

// Simple tap to toggle for all buttons
for(var i=0; i<buttons.length; i++) {
    (function(button) {
        button.onclick = function() {
            toggleButton(button);
        };
    })(buttons[i]);
}

// Center popup vertically based on its content height
function centerPopup(popupEl) {
    var box = popupEl.getElementsByClassName('popup-box')[0];
    if(!box) return;
    setTimeout(function() {
        var h = box.offsetHeight;
        var screenH = window.innerHeight || 758;
        var top = Math.max(20, Math.round((screenH - h) / 2));
        box.style.top = top + 'px';
    }, 10);
}

// Lamp picker popup
var lampPicker = document.getElementById('lampPicker');
var lampPickerList = document.getElementById('lampPickerList');
var lampPickerClose = document.getElementById('lampPickerClose');
var lampControlBtn = document.getElementById('lampControlBtn');

function openLampPicker() {
    lampPickerList.innerHTML = '';
    for(var i = 0; i < buttons.length; i++) {
        (function(button) {
            var entityId = button.dataset.entityId;
            var titleEl = button.getElementsByClassName('title')[0];
            var name = titleEl ? titleEl.innerText : entityId;
            var isOn = button.classList.contains('active');

            var attrs = entityAttrs[entityId] || {};
            var infoText = (attrs.brightness && isOn) ? Math.round(attrs.brightness / 255 * 100) + '%' : '';
            var dotClass = 'lamp-picker-dot' + (isOn ? ' on' : '');

            var item = document.createElement('a');
            item.href = 'javascript:void(0)';
            item.className = 'lamp-picker-item';
            item.innerHTML = '<div class="lamp-picker-status"><div class="' + dotClass + '"></div></div>'
                + '<div class="lamp-picker-name">' + name + '</div>'
                + (infoText ? '<div class="lamp-picker-info">' + infoText + '</div>' : '');

            function makeItemHandler(eid, n) {
                return function(e) {
                    if(e && e.preventDefault) e.preventDefault();
                    closeLampPicker();
                    openLightPopup(eid, n);
                };
            }
            var handler = makeItemHandler(entityId, name);
            item.onclick = handler;
            item.ontouchend = handler;

            lampPickerList.appendChild(item);
        })(buttons[i]);
    }
    lampPicker.style.display = 'block';
    centerPopup(lampPicker);
}

function closeLampPicker() {
    lampPicker.style.display = 'none';
}

lampControlBtn.onclick = function() { openLampPicker(); };
lampPickerClose.onclick = function() { closeLampPicker(); };
// Close picker when tapping overlay — use querySelectorAll to get the right one
var pickerOverlay = lampPicker.getElementsByClassName('popup-overlay')[0];
pickerOverlay.onclick = function() { closeLampPicker(); };

// Light popup elements
var lightPopup = document.getElementById('lightPopup');
var popupTitle = document.getElementById('popupTitle');
var popupClose = document.getElementById('popupClose');
var popupToggleOn = document.getElementById('popupToggleOn');
var popupToggleOff = document.getElementById('popupToggleOff');
var popupBrightnessRow = document.getElementById('popupBrightnessRow');
var popupColorTempRow = document.getElementById('popupColorTempRow');
var popupColorsRow = document.getElementById('popupColorsRow');
var popupColorGrid = document.getElementById('popupColorGrid');
var popupBrightness = document.getElementById('popupBrightness');
var popupColorTemp = document.getElementById('popupColorTemp');
var popupBrightnessVal = document.getElementById('popupBrightnessVal');
var popupColorTempVal = document.getElementById('popupColorTempVal');
var popupEntityId = null;
var popupSendTimer = null;
var popupIsOn = false;

// Color presets — labeled for e-ink (hs_color: [hue, saturation])
var COLOR_PRESETS = [
    { name: 'Warm',   hs: [30, 70] },
    { name: 'Soft',   hs: [30, 40] },
    { name: 'Day',    hs: [210, 15] },
    { name: 'Cool',   hs: [220, 40] },
    { name: 'Red',    hs: [0, 100] },
    { name: 'Orange', hs: [30, 100] },
    { name: 'Yellow', hs: [50, 100] },
    { name: 'Green',  hs: [120, 100] },
    { name: 'Blue',   hs: [240, 100] },
    { name: 'Purple', hs: [280, 100] },
    { name: 'Pink',   hs: [330, 80] },
    { name: 'White',  hs: [0, 0] }
];

function lightHasBrightness(entityId) {
    var attrs = entityAttrs[entityId];
    if(!attrs) return false;
    // Check supported_color_modes if available
    if(attrs.supported_color_modes) {
        var modes = attrs.supported_color_modes;
        for(var i = 0; i < modes.length; i++) {
            if(modes[i] !== 'onoff') return true;
        }
    }
    // Fallback: check if brightness attribute exists
    if(typeof attrs.brightness !== 'undefined') return true;
    return false;
}

function lightHasColorTemp(entityId) {
    var attrs = entityAttrs[entityId];
    if(!attrs) return false;
    if(attrs.supported_color_modes) {
        var modes = attrs.supported_color_modes;
        for(var i = 0; i < modes.length; i++) {
            if(modes[i] === 'color_temp') return true;
        }
    }
    // Fallback: check if color_temp attributes exist
    if(typeof attrs.color_temp_kelvin !== 'undefined' || typeof attrs.color_temp !== 'undefined') return true;
    return false;
}

function lightHasColor(entityId) {
    var attrs = entityAttrs[entityId];
    if(!attrs) return false;
    if(attrs.supported_color_modes) {
        var modes = attrs.supported_color_modes;
        for(var i = 0; i < modes.length; i++) {
            if(modes[i] === 'xy' || modes[i] === 'hs' || modes[i] === 'rgb') return true;
        }
    }
    // Fallback: check if color attributes exist
    if(attrs.hs_color || attrs.xy_color || attrs.rgb_color) return true;
    return false;
}

function updatePopupToggle() {
    if(popupIsOn) {
        popupToggleOn.className = 'popup-toggle-btn popup-toggle-on active';
        popupToggleOff.className = 'popup-toggle-btn popup-toggle-off';
    } else {
        popupToggleOn.className = 'popup-toggle-btn popup-toggle-on';
        popupToggleOff.className = 'popup-toggle-btn popup-toggle-off active';
    }
}

function buildColorGrid() {
    popupColorGrid.innerHTML = '';
    for(var i = 0; i < COLOR_PRESETS.length; i++) {
        (function(preset) {
            var btn = document.createElement('div');
            btn.className = 'popup-color-btn';
            btn.innerText = preset.name;
            btn.onclick = function() {
                // Remove active from all color buttons
                var allBtns = popupColorGrid.getElementsByClassName('popup-color-btn');
                for(var j = 0; j < allBtns.length; j++) {
                    allBtns[j].className = 'popup-color-btn';
                }
                btn.className = 'popup-color-btn active';
                sendColorPreset(preset.hs);
            };
            popupColorGrid.appendChild(btn);
        })(COLOR_PRESETS[i]);
    }
}

function sendColorPreset(hs) {
    if(!popupEntityId || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
        type: 'call_service',
        domain: 'light',
        entityId: popupEntityId,
        service: 'turn_on',
        data: { hs_color: hs }
    }));
    popupIsOn = true;
    updatePopupToggle();
}

function openLightPopup(entityId, title) {
    var attrs = entityAttrs[entityId] || {};
    popupEntityId = entityId;
    popupTitle.innerText = title;

    // Determine current on/off state from the button element
    var buttonEl = document.querySelector('.button[data-entity-id="' + entityId + '"]');
    popupIsOn = buttonEl ? buttonEl.classList.contains('active') : false;
    updatePopupToggle();

    // Brightness
    var hasBrightness = lightHasBrightness(entityId);
    popupBrightnessRow.style.display = hasBrightness ? 'block' : 'none';
    if(hasBrightness) {
        var bri = attrs.brightness || 128;
        popupBrightness.value = bri;
        popupBrightnessVal.innerText = Math.round(bri / 255 * 100) + '%';
    }

    // Color temperature
    var hasColorTemp = lightHasColorTemp(entityId);
    popupColorTempRow.style.display = hasColorTemp ? 'block' : 'none';
    if(hasColorTemp) {
        var minK = attrs.min_color_temp_kelvin || 2202;
        var maxK = attrs.max_color_temp_kelvin || 4000;
        popupColorTemp.min = minK;
        popupColorTemp.max = maxK;
        var ctVal = attrs.color_temp_kelvin || Math.round((minK + maxK) / 2);
        popupColorTemp.value = ctVal;
        popupColorTempVal.innerText = ctVal + 'K';
    }

    // Color presets
    var hasColor = lightHasColor(entityId);
    popupColorsRow.style.display = hasColor ? 'block' : 'none';
    if(hasColor) {
        buildColorGrid();
        // Highlight closest preset to current HS color
        if(attrs.hs_color) {
            var curH = attrs.hs_color[0], curS = attrs.hs_color[1];
            var bestIdx = -1, bestDist = 9999;
            for(var i = 0; i < COLOR_PRESETS.length; i++) {
                var dh = Math.abs(COLOR_PRESETS[i].hs[0] - curH);
                if(dh > 180) dh = 360 - dh;
                var ds = Math.abs(COLOR_PRESETS[i].hs[1] - curS);
                var dist = dh + ds;
                if(dist < bestDist) { bestDist = dist; bestIdx = i; }
            }
            if(bestIdx >= 0 && bestDist < 40) {
                var allBtns = popupColorGrid.getElementsByClassName('popup-color-btn');
                allBtns[bestIdx].className = 'popup-color-btn active';
            }
        }
    }

    lightPopup.style.display = 'block';
    centerPopup(lightPopup);
}

function closeLightPopup() {
    lightPopup.style.display = 'none';
    popupEntityId = null;
    if(popupSendTimer) { clearTimeout(popupSendTimer); popupSendTimer = null; }
}

function sendLightUpdate() {
    if(!popupEntityId || !ws || ws.readyState !== WebSocket.OPEN) return;
    var data = {};
    if(popupBrightnessRow.style.display !== 'none') {
        data.brightness = parseInt(popupBrightness.value);
    }
    if(popupColorTempRow.style.display !== 'none') {
        data.color_temp_kelvin = parseInt(popupColorTemp.value);
    }
    ws.send(JSON.stringify({
        type: 'call_service',
        domain: 'light',
        entityId: popupEntityId,
        service: 'turn_on',
        data: data
    }));
    popupIsOn = true;
    updatePopupToggle();
}

function sendToggle(turnOn) {
    if(!popupEntityId || !ws || ws.readyState !== WebSocket.OPEN) return;
    var domain = popupEntityId.split('.')[0];
    ws.send(JSON.stringify({
        type: 'call_service',
        domain: domain,
        entityId: popupEntityId,
        service: turnOn ? 'turn_on' : 'turn_off'
    }));
    popupIsOn = turnOn;
    updatePopupToggle();
}

// Debounce slider changes to avoid flooding the WebSocket
function scheduleLightUpdate() {
    if(popupSendTimer) clearTimeout(popupSendTimer);
    popupSendTimer = setTimeout(sendLightUpdate, 300);
}

popupBrightness.onchange = function() {
    popupBrightnessVal.innerText = Math.round(parseInt(this.value) / 255 * 100) + '%';
    scheduleLightUpdate();
};
popupColorTemp.onchange = function() {
    popupColorTempVal.innerText = this.value + 'K';
    scheduleLightUpdate();
};
popupToggleOn.onclick = function() { sendToggle(true); };
popupToggleOff.onclick = function() { sendToggle(false); };
popupClose.onclick = function() { closeLightPopup(); };
var lightPopupOverlay = lightPopup.getElementsByClassName('popup-overlay')[0];
lightPopupOverlay.onclick = function() { closeLightPopup(); };

// Shutter controls — Open / Stop / Close
var shutterActions = document.querySelectorAll('.shutter-action');
for(var i=0; i<shutterActions.length; i++) {
    shutterActions[i].onclick = function() {
        var coverId = this.dataset.cover;
        var action = this.dataset.action;
        if(!ws || !coverId) return;

        var serviceMap = {
            'open': 'open_cover',
            'close': 'close_cover',
            'stop': 'stop_cover'
        };

        ws.send(JSON.stringify({
            type: 'call_service',
            domain: 'cover',
            entityId: coverId,
            service: serviceMap[action]
        }));
    }
}

// Intercom — Open Door button
var intercomBtns = document.querySelectorAll('.intercom-btn');
for(var i=0; i<intercomBtns.length; i++) {
    intercomBtns[i].onclick = function() {
        var buttonEntity = this.dataset.button;
        if(!ws || !buttonEntity) return;
        ws.send(JSON.stringify({
            type: 'call_service',
            domain: 'button',
            entityId: buttonEntity,
            service: 'press'
        }));
    }
}

// Intercom — Incoming call status update
function updateIntercomStatus(entityId, state) {
    var el = document.querySelector('.intercom-status[data-entity-id="'+entityId+'"]');
    if(!el) return;
    var span = el.getElementsByClassName('intercom-state')[0];
    if(state.s == 'on') {
        span.innerText = 'RINGING';
        span.className = 'intercom-state ringing';
    } else {
        span.innerText = 'Idle';
        span.className = 'intercom-state';
    }
}
