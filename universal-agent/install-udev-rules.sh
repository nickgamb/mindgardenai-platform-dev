#!/bin/bash
# EMOTIV EPOC udev rules installation script
# This script installs udev rules for EMOTIV EPOC devices on Linux systems

set -e

echo "🔧 EMOTIV EPOC udev Rules Installation"
echo "======================================"

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Check if we're on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    log "❌ Error: This script is for Linux systems only"
    log "   Current OS: $OSTYPE"
    exit 1
fi

# Check if udev rules file exists
if [ ! -f "udev/99-emotiv-epoc.rules" ]; then
    log "❌ Error: udev rules file not found at udev/99-emotiv-epoc.rules"
    log "   Please run this script from the universal-agent directory"
    exit 1
fi

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    log "🔧 Installing udev rules as root..."
    
    # Backup existing rules if they exist
    if [ -f "/etc/udev/rules.d/99-emotiv-epoc.rules" ]; then
        cp /etc/udev/rules.d/99-emotiv-epoc.rules /etc/udev/rules.d/99-emotiv-epoc.rules.backup
        log "📦 Backed up existing rules to 99-emotiv-epoc.rules.backup"
    fi
    
    # Install the rules
    cp udev/99-emotiv-epoc.rules /etc/udev/rules.d/
    udevadm control --reload-rules
    udevadm trigger
    
    log "✅ udev rules installed successfully!"
    
else
    # Not running as root, try with sudo
    if command -v sudo &> /dev/null; then
        log "🔐 Requesting sudo privileges to install udev rules..."
        
        # Backup existing rules if they exist
        if [ -f "/etc/udev/rules.d/99-emotiv-epoc.rules" ]; then
            sudo cp /etc/udev/rules.d/99-emotiv-epoc.rules /etc/udev/rules.d/99-emotiv-epoc.rules.backup
            log "📦 Backed up existing rules to 99-emotiv-epoc.rules.backup"
        fi
        
        # Install the rules
        sudo cp udev/99-emotiv-epoc.rules /etc/udev/rules.d/
        sudo udevadm control --reload-rules
        sudo udevadm trigger
        
        log "✅ udev rules installed successfully!"
        
    else
        log "❌ Error: No sudo available and not running as root"
        log "   Please run this script with sudo or as root:"
        log "   sudo ./install-udev-rules.sh"
        exit 1
    fi
fi

# Show what was installed
echo ""
log "📋 Installed udev rules:"
echo "----------------------------------------"
cat udev/99-emotiv-epoc.rules
echo "----------------------------------------"

# Show next steps
echo ""
log "🎯 Next steps:"
log "   1. Connect your EMOTIV EPOC device"
log "   2. The device should now be accessible without root privileges"
log "   3. You can verify by running: ls -la /dev/emotiv-epoc*"
log "   4. If you have issues, check: dmesg | grep emotiv"

echo ""
log "✅ Installation complete!" 