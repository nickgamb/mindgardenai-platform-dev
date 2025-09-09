# docker build -t mgflow-assistant-server:latest .
# docker run -p 5000:5000 --name mgflow-assistant-server mgflow-assistant-server:latest

# syntax=docker/dockerfile:1
ARG PYTHON_VERSION=3.11
ARG BUILD_HASH=dev-build
ARG UID=0
ARG GID=0

######## Backend Server ########
FROM python:${PYTHON_VERSION}-slim AS base

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        git \
        build-essential \
        curl \
        jq \
        netcat-openbsd \
        gcc \
        nodejs \
        npm \
        && rm -rf /var/lib/apt/lists/*

# Ensure 'node' command exists (some distros install as 'nodejs')
RUN if ! command -v node >/dev/null 2>&1 && command -v nodejs >/dev/null 2>&1; then \
      ln -s /usr/bin/nodejs /usr/bin/node; \
    fi

# Use args
ARG UID
ARG GID
ARG BUILD_HASH

## Environment Config ##
ENV ENV=prod \
    PORT=5000 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    BUILD_HASH=${BUILD_HASH}

## Flask Config ##
ENV FLASK_APP=main.py \
    FLASK_ENV=production \
    FLASK_RUN_HOST=0.0.0.0 \
    FLASK_RUN_PORT=5000

## Database and Storage Config ##
ENV DATABASE_PATH=/app/data/mindgarden.db \
    UPLOAD_FOLDER=/app/data/uploads

## Security Config ##
ENV SECRET_KEY="" \
    AUTH0_DOMAIN="" \
    AUTH0_CLIENT_ID="" \
    AUTH0_CLIENT_SECRET="" \
    AUTH0_API_IDENTIFIER=""

WORKDIR /app

# Create user and group if not root
RUN if [ $UID -ne 0 ]; then \
    if [ $GID -ne 0 ]; then \
        addgroup --gid $GID app; \
    fi; \
    adduser --uid $UID --gid $GID --home /home/app --disabled-password --no-create-home app; \
    fi

# Create necessary directories
RUN mkdir -p /app/data /app/data/uploads && \
    chown -R $UID:$GID /app

# Install Python dependencies
COPY --chown=$UID:$GID requirements.txt ./

# Install pip dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code (includes .env file)
COPY --chown=$UID:$GID . .

# Set permissions
RUN chown -R $UID:$GID /app

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl --silent --fail http://localhost:${PORT}/api/status || exit 1

USER $UID:$GID

# Start the application
CMD ["python", "main.py"]