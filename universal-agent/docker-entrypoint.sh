#!/bin/bash
set -e

# MindGarden Universal Agent Entrypoint Script

echo "🧠 Starting MindGarden Universal Agent..."
echo "Version: 1.0.0"
echo "Environment: ${FLASK_ENV:-development}"

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Check if running in privileged mode for device access
if [ ! -w /dev ]; then
    log "⚠️  Warning: No write access to /dev - device functionality may be limited"
    log "   Run with --privileged flag for full device support"
fi

# Create data directories if they don't exist
mkdir -p /app/data/logs
mkdir -p /app/static/css /app/static/js /app/static/images

# Set permissions for data directory
if [ -w /app/data ]; then
    log "📁 Data directory is writable"
else
    log "⚠️  Warning: Data directory is not writable - state persistence may fail"
fi

# Check for required environment variables
if [ -z "$NGROK_AUTH_TOKEN" ]; then
    log "⚠️  Warning: NGROK_AUTH_TOKEN not set - using free tier (limited)"
fi

if [ -z "$AUTH0_CLIENT_ID" ] || [ -z "$AUTH0_CLIENT_SECRET" ]; then
    log "⚠️  Warning: Auth0 credentials not set - authentication may fail"
fi

# Check for device access
if [ -e /dev/spidev0.0 ]; then
    log "✅ SPI device detected: /dev/spidev0.0"
else
    log "ℹ️  SPI device not found - PiEEG functionality may be limited"
fi

if [ -e /dev/gpiochip0 ]; then
    log "✅ GPIO chip detected: /dev/gpiochip0"
else
    log "ℹ️  GPIO chip not found - PiEEG functionality may be limited"
fi

# Check for USB/HID devices
if ls /dev/hidraw* 1> /dev/null 2>&1; then
    log "✅ HID devices detected"
else
    log "ℹ️  No HID devices found - EMOTIV functionality may be limited"
fi

# Check for Bluetooth
if command -v bluetoothctl &> /dev/null; then
    log "✅ Bluetooth support available"
    if timeout 5 bluetoothctl show &> /dev/null; then
        log "✅ Bluetooth adapter detected"
    else
        log "ℹ️  Bluetooth adapter not available - IDUN/BLE functionality may be limited"
    fi
else
    log "ℹ️  Bluetooth tools not found - IDUN functionality may be limited"
fi

# Initialize configuration if it doesn't exist
if [ ! -f /app/data/device_config.json ]; then
    log "📝 Initializing device configuration..."
    echo '{}' > /app/data/device_config.json
fi

# Wait for network if needed
if [ "${WAIT_FOR_NETWORK:-false}" = "true" ]; then
    log "🌐 Waiting for network connectivity..."
    for i in {1..30}; do
        if curl -s --head http://google.com > /dev/null; then
            log "✅ Network connectivity confirmed"
            break
        fi
        if [ $i -eq 30 ]; then
            log "⚠️  Network connectivity timeout - continuing anyway"
        fi
        sleep 1
    done
fi

# Show startup information
log "🚀 Configuration:"
log "   Host: ${HOST:-0.0.0.0}"
log "   Port: ${PORT:-5000}"
log "   Debug: ${DEBUG:-false}"
log "   API Base: ${MINDGARDEN_API_BASE:-https://api.example.com}"
log "   Auth Base: ${MINDGARDEN_AUTH_BASE:-https://auth.example.com}"

# Export any additional environment variables from .env file if it exists
if [ -f /app/.env ]; then
    log "📋 Loading environment from .env file..."
    # Convert Windows line endings to Unix and source the file
    tr -d '\r' < /app/.env > /tmp/.env.unix
    set -a
    source /tmp/.env.unix
    set +a
    rm -f /tmp/.env.unix
fi

# Add system Python path for hidapi
log "🔍 Setting up Python path for hidapi..."
export PYTHONPATH="/usr/lib/python3/dist-packages:$PYTHONPATH"
log "✅ Added /usr/lib/python3/dist-packages to PYTHONPATH"

# Test hidapi import
log "🔍 Testing hidapi import..."
python -c "import hidapi; print('hidapi imported successfully')" || {
    log "❌ hidapi import failed - HID functionality will be disabled"
}

# Start the application
log "🎯 Starting Universal Agent..."
exec "$@"