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
} else {
    // Display device frame for debugging in regular browser
    document.querySelector('.container').style.border = '2px solid gray';
}

// Clock widget
var daysOfWeek = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
var months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
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
function getLocalDate(value) { // TZ: Europe/Berlin
    var date = value ? new Date(value) : new Date();
    if(date.getTimezoneOffset() != 0) return date;

    var year = date.getUTCFullYear();

    // last Sunday in March
    var start = new Date(Date.UTC(year, 2, 31, 1)); // March 31, 01:00 UTC
    while(start.getUTCDay() !== 0) {
        start.setUTCDate(start.getUTCDate() - 1);
    }

    // last Sunday in October
    var end = new Date(Date.UTC(year, 9, 31, 1)); // Oct 31, 01:00 UTC
    while(end.getUTCDay() !== 0) {
        end.setUTCDate(end.getUTCDate() - 1);
    }

    // between start and end = CEST (UTC+2), else CET (UTC+1)
    var offset = (date >= start && date < end) ? 7200000 /* 2h */ : 3600000 /* 1h */;
    date.setTime(date.getTime()+offset);
    return date;
}
function updateClock() {
    var date = getLocalDate();
    clockTime.innerText = formatTime(date);
    clockDate.innerText = daysOfWeek[date.getDay()]+', '+date.getDate()+'. '+months[date.getMonth()]+' '+date.getFullYear();

    // Time based events
    var hours = date.getHours(), minutes = date.getMinutes();
    if(minutes == 0) {
        if(hours == 2 || hours == 14) {
            refreshScreen();
        }
        if(ws && ws.readyState == WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'fetch_history',
                entityId: 'sensor.ftj4cdk01h_pv_output_actual'
            }));
            ws.send(JSON.stringify({
                type: 'fetch_calendars',
                calendars: DISPLAY_CALENDARS,
                days: 14
            }));
        }
    }

    if(AUTO_NIGHT_MODE) {
        if(hours >= 20 || hours < 2) {
            if(nightMode == null || !nightMode) {
                nightMode = true;
                setScreenBrightness(SCREEN_BRIGHTNESS_NIGHT);
            }
        } else {
            if(nightMode == null || nightMode) {
                nightMode = false;
                setScreenBrightness(SCREEN_BRIGHTNESS_DEFAULT);
            }
        }
    }

    var timeToNextMin = 60000 - Date.now() % 60000 + 50;
    setTimeout(updateClock, timeToNextMin);
}
updateClock();

// Weather widget
var weatherForecasts = document.querySelectorAll('#weatherWidget .forecast');
function updateWeather() {
    var date = getLocalDate();
    var dateStart = date.toISOString().split('T')[0];
    date.setDate(date.getDate() + 4);
    var dateEnd = date.toISOString().split('T')[0]+'T23:59:59';

    var req = new XMLHttpRequest();
    req.onreadystatechange = function() {
        if(this.readyState != 4 || this.status != 200) return;

        var weatherByDate = {};
        var apiData = JSON.parse(this.responseText);
        apiData.weather.forEach(function(entry) {
            var entryDate = entry.timestamp.split('T')[0];
            if(weatherByDate[entryDate]) {
                weatherByDate[entryDate].temp_max = Math.max(weatherByDate[entryDate].temp_max, entry.temperature);
                weatherByDate[entryDate].temp_min = Math.min(weatherByDate[entryDate].temp_min, entry.temperature);
            } else {
                weatherByDate[entryDate] = {
                    temp_min: entry.temperature,
                    temp_max: entry.temperature,
                    icon: {
                        thunderstorm: 0,
                        hail: 0,
                        snow: 0,
                        sleet: 0,
                        rain: 0,
                        wind: 0,
                        fog: 0,
                        cloudy: 0,
                        'partly-cloudy': 0,
                        clear: 0
                    }
                };
            }
            
            var dateEntry = weatherByDate[entryDate];
            entry.icon = entry.icon.replace(/-day|-night/, '');
            if(entry.icon) dateEntry.icon[entry.icon]++;
        });

        var i = 0;
        for(var entryDate in weatherByDate) {
            var entry = weatherByDate[entryDate];
            var dayIcon = null;
            var highestValue = -Infinity;

            for(var icon in entry.icon) {
                if(entry.icon[icon] > highestValue) {
                    highestValue = entry.icon[icon];
                    dayIcon = icon;
                }
            }

            var dayIndex = getLocalDate(entryDate.replace(/-/g, '/')).getDay();
            var forecastElement = weatherForecasts[i];
            forecastElement.getElementsByClassName('day')[0].innerText = (i == 0) ? 'Heute' : daysOfWeek[dayIndex];
            forecastElement.getElementsByTagName('img')[0].src = 'img/weather/'+dayIcon+'.svg';
            forecastElement.getElementsByClassName('temp')[0].innerText = entry.temp_max;
            forecastElement.getElementsByClassName('temp-sm')[0].innerText = entry.temp_min;
            i++;
        }
    };
    req.open('GET', 'https://api.brightsky.dev/weather?date='+dateStart+'&last_date='+dateEnd+'&'+WEATHER_PARAMS);
    req.send();
}
updateWeather();
setInterval(updateWeather, 7200000); // 2h

// Charts
var photovoltaicsCtx = document.getElementById('photovoltaicsChart').getContext('2d');
var photovoltaicsChart = new Chart(photovoltaicsCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        data: [],
        fill: true,
        borderColor: '#474747',
        backgroundColor: '#a2a2a2'
      }]
    },
    options: {
        responsive: false,
        legend: {
            display: false
        },
        scales: {
            xAxes: [{ display: false }],
            yAxes: [{ display: false }]
        },
        tooltips: { enabled: false },
        hover: { mode: null },
        animation: { duration: 0 }
    }
});

var calendarList = document.getElementById('calendarList'), notificationList = document.getElementById('notificationList');
var buttonTimers = {}, notifications = {};
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
        var subscribeEntities = ['input_button.kindle_display_refresh', 'input_button.kindle_display_reload_page', 'input_number.kindle_display_brightness']; // Helper buttons
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
        ws.send(JSON.stringify({
            type: 'fetch_history',
            entityId: 'sensor.ftj4cdk01h_pv_output_actual'
        }));
        ws.send(JSON.stringify({
            type: 'fetch_calendars',
            calendars: DISPLAY_CALENDARS,
            days: 14
        }));
    };

    ws.onmessage = function(event) {
        if(event.data == 'pong') {
            receivedPong = true;
            return;
        }
        var msg = JSON.parse(event.data);
        switch(msg.type) {
            case 'state_change':
                if(!msg.firstUpdate) {
                    if(msg.states['input_button.kindle_display_refresh']) {
                        refreshScreen();
                        break;
                    } else if(msg.states['input_button.kindle_display_reload_page']) {
                        window.location.reload();
                        break;
                    } else if(msg.states['input_number.kindle_display_brightness']) {
                        var brightness = parseInt(msg.states['input_number.kindle_display_brightness'].s);
                        setScreenBrightness(brightness);
                    }
                }
                Object.keys(msg.states).forEach(function(entityId) {
                    var state = msg.states[entityId];
                    var element = document.querySelector('[data-entity-id="'+entityId+'"]');
                    if(!element) return;
                    if(element.classList.contains('badge')) {
                        // Badge
                        if(element.dataset.valType == 'battery') {
                            element.getElementsByTagName('img')[0].src = 'img/badges/battery-'+(Math.ceil((state.s||1) / 20) * 20)+'.svg';
                            element.getElementsByClassName('val')[0].innerText = state.s;
                        } else if(element.dataset.valType == 'last-triggered' && state.a.last_triggered) {
                            var lastTriggered = getLocalDate(state.a.last_triggered.replace(/-/g, '/').replace('T', ' ').split('.')[0]+' UTC');
                            /*var timeDifference = Date.now() - lastTriggered.getTime();
                            element.getElementsByClassName('value')[0].innerText = formatDuration(Math.floor(timeDifference/1000));*/
                            element.getElementsByClassName('value')[0].innerText = formatTime(lastTriggered);
                        }
                    } else if(element.classList.contains('card')) {
                        // Card
                        element.getElementsByClassName('val')[0].innerText = (state.s == 'unavailable' || state.s == 'unknown') ? '-/-' : state.s;
                    } else if(element.classList.contains('button')) {
                        // Button
                        if(buttonTimers[entityId]) clearTimeout(buttonTimers[entityId]);
                        if(state.s == 'on') {
                            element.classList.add('active');
                        } else {
                            element.classList.remove('active');
                        }
                        if(state.s == 'unavailable') {
                            element.classList.add('disabled');
                        } else {
                            element.classList.remove('disabled');
                        }
                    }
                });
                break;
            case 'history':
                if(msg.history['sensor.ftj4cdk01h_pv_output_actual']) {
                    var datapoints = msg.history['sensor.ftj4cdk01h_pv_output_actual'];
                    photovoltaicsChart.data.labels = [];
                    photovoltaicsChart.data.datasets[0].data = [];
                    for(var i=0; i<datapoints.length; i++) {
                        photovoltaicsChart.data.labels.push(i);
                        photovoltaicsChart.data.datasets[0].data.push(datapoints[i].mean);
                    }
                    photovoltaicsChart.update();
                }
                break;
            case 'calendars':
                if(msg.events.length == 0) {
                    // Trying to prevent ghosting
                    if(calendarList.innerText != 'Keine anstehenden Termine') {
                        calendarList.innerHTML = '<div class="text-empty">Keine anstehenden Termine</div>';
                    }
                } else {
                    calendarList.innerHTML = '';
                }
                for(var i=0; i<msg.events.length; i++) {
                    var event = msg.events[i];
                    var startDate = getLocalDate(event.start),
                        endDate = getLocalDate(event.end);
                    var eventEntry = document.createElement('div');
                    eventEntry.classList.add('event');
                    var dateHtml = '<div class="date">' + daysOfWeek[startDate.getDay()]+', '+startDate.getDate()+'. '+months[startDate.getMonth()];
                    if(startDate.getDate() != endDate.getDate() && !isMidnight(endDate)) {
                        // Event lasts longer than 1 day
                        dateHtml += ' - ' + daysOfWeek[endDate.getDay()]+', '+endDate.getDate()+'. '+months[endDate.getMonth()];
                    } else {
                        // Event starts and ends on one day
                        if(!isMidnight(startDate) && !isMidnight(endDate)) dateHtml += ' | '+formatTime(startDate)+' - '+formatTime(endDate);
                    }
                    eventEntry.innerHTML = dateHtml+'</div><div class="description">'+event.summary+'</div>';
                    calendarList.appendChild(eventEntry);
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

// Buttons widget
var buttons = document.querySelectorAll('#buttonsWidget .button');
function setButtonState(button, state) {
    if(state) {
        button.classList.add('active');
    } else {
        button.classList.remove('active');
    }
}
for(var i=0; i<buttons.length; i++) {
    var button = buttons[i];
    button.onclick = function() {
        var button = this;
        var entityId = button.dataset.entityId;
        if(button.classList.contains('disabled') || !ws) return;

        var isActive = button.classList.contains('active');
        if(buttonTimers[entityId]) clearTimeout(buttonTimers[entityId]);
        buttonTimers[entityId] = setTimeout(function() {
            setButtonState(button, isActive);
        }, 4000);
        setButtonState(button, !isActive);

        ws.send(JSON.stringify({
            type: 'call_service',
            entityId: button.dataset.entityAction || entityId,
            service: 'toggle'
        }));
    }
}
