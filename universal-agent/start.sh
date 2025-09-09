#!/bin/bash
# MindGarden Universal Agent - Smart Startup Script
# Automatically detects environment and starts container with appropriate configuration

set -e

echo "🧠 MindGarden Universal Agent - Smart Startup"
echo "============================================="

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to install udev rules
install_udev_rules() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        log "🔧 Installing udev rules for EMOTIV devices..."
        
        # Check if udev rules file exists
        if [ ! -f "udev/99-emotiv-epoc.rules" ]; then
            log "❌ Error: udev rules file not found at udev/99-emotiv-epoc.rules"
            return 1
        fi
        
        # Check if running as root or with sudo
        if [ "$EUID" -eq 0 ]; then
            # Running as root
            cp udev/99-emotiv-epoc.rules /etc/udev/rules.d/
            udevadm control --reload-rules
            udevadm trigger
            log "✅ udev rules installed successfully"
        else
            # Not running as root, try with sudo
            if command -v sudo &> /dev/null; then
                log "🔐 Requesting sudo privileges to install udev rules..."
                sudo cp udev/99-emotiv-epoc.rules /etc/udev/rules.d/
                sudo udevadm control --reload-rules
                sudo udevadm trigger
                log "✅ udev rules installed successfully"
            else
                log "⚠️  Warning: Could not install udev rules (no sudo available)"
                log "   You may need to install them manually:"
                log "   sudo cp udev/99-emotiv-epoc.rules /etc/udev/rules.d/"
                log "   sudo udevadm control --reload-rules"
                log "   sudo udevadm trigger"
            fi
        fi
    else
        log "ℹ️  Skipping udev rules installation (not on Linux)"
    fi
}

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    log "❌ Error: docker-compose.yml not found"
    log "   Please run this script from the universal-agent directory"
    exit 1
fi

# Check if detect-env.sh exists
if [ ! -f "detect-env.sh" ]; then
    log "❌ Error: detect-env.sh not found"
    log "   Please ensure the detection script is present"
    exit 1
fi

# Make detection script executable
chmod +x detect-env.sh

# Install udev rules for EMOTIV devices
install_udev_rules

# Run environment detection
log "🔍 Running environment detection..."
./detect-env.sh

# Check if override file was created
if [ ! -f "docker-compose.override.yml" ]; then
    log "❌ Error: docker-compose.override.yml was not created"
    exit 1
fi

# Show the generated configuration
log "📋 Generated configuration:"
echo "----------------------------------------"
cat docker-compose.override.yml
echo "----------------------------------------"

# Ask for confirmation (optional)
read -p "Continue with this configuration? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log "⚠️  Startup cancelled by user"
    exit 1
fi

# Start the container
log "🚀 Starting MindGarden Universal Agent..."
#docker-compose build --no-cache
docker-compose build
docker-compose up

# Cleanup on exit
cleanup() {
    log "🧹 Cleaning up..."
    if [ -f "docker-compose.override.yml" ]; then
        rm docker-compose.override.yml
        log "✅ Removed temporary override file"
    fi
}

# Set up cleanup trap
trap cleanup EXIT

echo ""
log "✅ MindGarden Universal Agent started successfully!"
log "   Access the application at: http://localhost:5000" 