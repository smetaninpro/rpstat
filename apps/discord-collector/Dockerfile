FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /app
COPY package*.json ./
COPY apps/discord-collector/package.json apps/discord-collector/package.json
RUN npm install
COPY apps/discord-collector apps/discord-collector
CMD ["sh", "-c", "rm -f /data/discord-profile/SingletonLock /data/discord-profile/SingletonCookie /data/discord-profile/SingletonSocket /tmp/.X99-lock; Xvfb :99 -screen 0 1440x900x24 -nolisten tcp -ac & xvfb_pid=$!; trap 'kill $xvfb_pid 2>/dev/null; wait $xvfb_pid 2>/dev/null' EXIT INT TERM; export DISPLAY=:99; for attempt in $(seq 1 20); do [ -S /tmp/.X11-unix/X99 ] && break; kill -0 $xvfb_pid 2>/dev/null || exit 1; sleep 1; done; [ -S /tmp/.X11-unix/X99 ] || exit 1; npm run start --workspace=@rmrp/discord-collector"]
