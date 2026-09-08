#!/usr/bin/env sh
set -eu

export DISPLAY=:99
rm -f /data/discord-profile/SingletonLock /data/discord-profile/SingletonCookie /data/discord-profile/SingletonSocket
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99
Xvfb "$DISPLAY" -screen 0 1366x768x24 -nolisten tcp >/tmp/xvfb.log 2>&1 &
xvfb_pid=$!
sleep 1
if ! kill -0 "$xvfb_pid" 2>/dev/null; then cat /tmp/xvfb.log >&2; exit 1; fi
openbox-session &
x11vnc -display "$DISPLAY" -localhost -forever -shared -nopw -rfbport 5900 &
websockify --web /usr/share/novnc 6080 localhost:5900 &

echo "Open http://127.0.0.1:6080/vnc.html in a local browser and complete Discord login manually."
exec npm run auth --workspace=@rmrp/discord-collector
