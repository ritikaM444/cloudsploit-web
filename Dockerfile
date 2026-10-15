# Multi-stage build for the CloudSploit web app. Produces a single image that
# contains the scanner, the API/worker, and the built SPA.
FROM node:22-slim AS build
WORKDIR /app

# 1) Scanner dependencies
COPY cloudsploit/package.json cloudsploit/package-lock.json ./cloudsploit/
RUN cd cloudsploit && npm install --omit=dev --no-audit --no-fund
COPY cloudsploit/ ./cloudsploit/

# 2) Client build
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm install --no-audit --no-fund
COPY client/ ./client/
RUN cd client && npm run build

# 3) Server dependencies (tsx is needed at runtime to run TypeScript directly)
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm install --no-audit --no-fund
COPY server/ ./server/

FROM node:22-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATA_DIR=/data \
    SCANNER_PATH=/app/cloudsploit/index.js \
    COOKIE_SECURE=false

COPY --from=build /app /app

RUN mkdir -p /data \
 && useradd --create-home --shell /usr/sbin/nologin app \
 && chown -R app:app /app /data
USER app

EXPOSE 3000
WORKDIR /app/server
CMD ["node", "--import", "tsx", "src/index.ts"]
