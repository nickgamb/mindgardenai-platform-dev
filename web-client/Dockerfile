# docker build -t mgflow-assistant-web:latest .
# docker run -p 3000:3000 --name mgflow-assistant-web mgflow-assistant-web:latest

# syntax=docker/dockerfile:1
ARG NODE_VERSION=18
ARG BUILD_HASH=dev-build
ARG UID=0
ARG GID=0

######## Web Client Frontend ########
FROM node:${NODE_VERSION}-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    git \
    curl \
    jq \
    && rm -rf /var/cache/apk/*

# Use args
ARG UID
ARG GID
ARG BUILD_HASH

## Environment Config ##
ENV NODE_ENV=production \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1 \
    BUILD_HASH=${BUILD_HASH}

WORKDIR /app

# Create user and group if not root
RUN if [ $UID -ne 0 ]; then \
    if [ $GID -ne 0 ]; then \
        addgroup -g $GID app; \
    fi; \
    adduser -u $UID -G $(getent group $GID | cut -d: -f1) -h /home/app -D app; \
    else \
    addgroup -g 1001 app && adduser -u 1001 -G app -h /home/app -D app; \
    fi

# Copy package files
COPY --chown=$UID:$GID package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY --chown=$UID:$GID . .

# Copy .env files (Next.js will automatically load them)
COPY --chown=$UID:$GID .env* ./

# Build the application
RUN npm run build

# Remove development dependencies and clean up
RUN npm prune --production && \
    rm -rf .next/cache && \
    rm -rf node_modules/.cache

# Create necessary directories and set permissions
RUN mkdir -p /app/.next && \
    chown -R $UID:$GID /app

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl --silent --fail http://localhost:${PORT}/api/health || exit 1

USER $UID:$GID

# Start the application
CMD ["npm", "start"]