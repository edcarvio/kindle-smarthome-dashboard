#!/bin/sh
# Name: SmartHome Display
# Author: 1RandomDev
# DontUseFBInk

APP_DIR="/mnt/us/extensions/smarthomedisplay"
APP_ID="org.im1random.smarthomedisplay"

if [ -d /etc/upstart ]; then
    export INIT_TYPE="upstart"
    if [ -f /etc/upstart/functions ]; then
        . /etc/upstart/functions
    fi
else
    export INIT_TYPE="sysv"
    if [ -f /etc/rc.d/functions ]; then
        . /etc/rc.d/functions
    fi
fi

refresh_screen(){
    eips -c &> /dev/null
    eips -c &> /dev/null
}

prevent_screensaver(){
    lipc-set-prop com.lab126.powerd preventScreenSaver $1
}

stop_system_gui(){
    echo "Stopping gui"

    ## Check if using framework or labgui, then stop ui
    if [ "${INIT_TYPE}" = "sysv" ]; then
        /etc/init.d/framework stop
    else
        trap "" TERM
        stop lab126_gui
        usleep 1250000
        trap - TERM
    fi
    
    refresh_screen
}

start_system_gui(){
    echo "Starting gui"
    ## Check if using framework or labgui, then start ui
    if [ "${INIT_TYPE}" = "sysv" ]; then
        cd / && /etc/init.d/framework start
    else
        cd / && start lab126_gui
        usleep 1250000
    fi
    eips 1 1 "Please wait while Kindle UI is starting"
}

# Prevent crash dump generation
touch /var/local/system/KPPMainAppNormalExit 2>/dev/null
stop KPPMainAppCrashRecovery 2>/dev/null
stop CrashReportService 2>/dev/null
stop tmd 2>/dev/null

# Timestamp for identifying crash dumps created during this session
SESSION_START=$(date +%s)

# Clean up crash dumps from this session
cleanup_crash_dumps() {
    find /mnt/us/documents/ -name "KPPMainApp*" -exec rm -rf {} + 2>/dev/null
    # Remove crash logs (date-stamped .tgz/.txt/.sdr) created after session start
    for f in /mnt/us/documents/*.tgz /mnt/us/documents/*.sdr; do
        [ -e "$f" ] || continue
        # Only remove files newer than session start
        if [ "$(stat -c %Y "$f" 2>/dev/null || echo 0)" -ge "$SESSION_START" ]; then
            rm -rf "$f"
        fi
    done
    for f in /mnt/us/documents/*.txt; do
        [ -e "$f" ] || continue
        case "$f" in
            *_202[0-9].txt) # crash dump pattern: date_timestamp_year.txt
                if [ "$(stat -c %Y "$f" 2>/dev/null || echo 0)" -ge "$SESSION_START" ]; then
                    rm -f "$f"
                fi
                ;;
        esac
    done
}

# Clean on exit — kill background job, wait for late dumps, then clean
trap 'kill $CLEANUP_PID 2>/dev/null; sleep 2; cleanup_crash_dumps' EXIT

# Background cleanup — catches dumps generated after GUI stop
(while true; do sleep 30; cleanup_crash_dumps; done) &
CLEANUP_PID=$!

# Stop Kindle UI to save resources and remove all menu bars
stop_system_gui
# Disable screensaver/standby mode
prevent_screensaver 1

# Start UtilD (needed for setting the screen brightness from within the app)
if [ -e /lib/ld-linux-armhf.so.3 ]; then
    chmod +x "$APP_DIR/bin/UtildHF"
    "$APP_DIR/bin/UtildHF"
else
    chmod +x "$APP_DIR/bin/UtildSF"
    "$APP_DIR/bin/UtildSF"
fi

# Register app
sqlite3 "/var/local/appreg.db" <<EOF
INSERT OR IGNORE INTO interfaces(interface) VALUES('application');

INSERT OR IGNORE INTO handlerIds(handlerId) VALUES('$APP_ID');

INSERT OR REPLACE INTO properties(handlerId,name,value)
  VALUES('$APP_ID','lipcId','$APP_ID');
INSERT OR REPLACE INTO properties(handlerId,name,value)
  VALUES('$APP_ID','command','/usr/bin/mesquite -l $APP_ID -c file://$APP_DIR/mesquite/');
INSERT OR REPLACE INTO properties(handlerId,name,value)
  VALUES('$APP_ID','supportedOrientation','U');
EOF

# Battery monitor — writes level to a file the dashboard JS can read
BATTERY_FILE="$APP_DIR/mesquite/battery.js"
update_battery() {
    while true; do
        # Try multiple methods to read battery level
        BATT=$(lipc-get-prop com.lab126.powerd battLevel 2>/dev/null)
        if [ -z "$BATT" ] || [ "$BATT" = "" ]; then
            BATT=$(gasgauge-info -c 2>/dev/null)
        fi
        if [ -z "$BATT" ] || [ "$BATT" = "" ]; then
            BATT=$(cat /sys/devices/system/wario_battery/wario_battery0/battery_capacity 2>/dev/null)
        fi
        if [ -z "$BATT" ] || [ "$BATT" = "" ]; then
            BATT="-"
        fi
        echo "var KINDLE_BATTERY = $BATT;" > "$BATTERY_FILE"
        sleep 60
    done
}
update_battery &

# Start actual app
lipc-set-prop com.lab126.appmgrd start "app://$APP_ID"

# Power button closes the app and restores Kindle UI
script -f /dev/null -c "evtest /dev/input/event0" | while read line; do
    case "$line" in
        *"code 116 (Power), value 1"*)
            echo "Power button pressed"
            browserPid=$(gdbus call -y -d org.freedesktop.DBus -o / -m org.freedesktop.DBus.GetConnectionUnixProcessID "$APP_ID" | sed -E 's/.* ([0-9]+),.*/\1/')
            echo "Killing PID $browserPid"
            kill $browserPid

            start_system_gui
            prevent_screensaver 0
            exit
            ;;
    esac
done
