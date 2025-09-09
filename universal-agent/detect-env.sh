#!/bin/bash
# Environment Detection Script for MindGarden Universal Agent
# Automatically detects hardware and configures container accordingly

set -e

echo "🔍 MindGarden Universal Agent - Environment Detection"
echo "=================================================="

# Initialize variables
PI_DETECTED=false
HARDWARE_ACCESS=false
DEVICE_MOUNTS=""
GROUP_ADDITIONS=""

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Check for Pi-specific indicators (simplified to avoid hanging)
check_pi_hardware() {
    log "Checking for Raspberry Pi hardware..."
    
    # Quick check for Pi in CPU info (most reliable)
    if [ -f "/proc/cpuinfo" ]; then
        CPU_INFO=$(cat /proc/cpuinfo 2>/dev/null | grep -i "hardware\|model\|revision" | head -5)
        if echo "$CPU_INFO" | grep -q "BCM2708\|BCM2709\|BCM2710\|BCM2711\|BCM2835\|BCM2836\|BCM2837\|BCM2711"; then
            log "✅ Raspberry Pi detected via CPU info"
            PI_DETECTED=true
            return
        fi
    fi
    
    # Check OS release
    if [ -f "/etc/os-release" ]; then
        OS_INFO=$(cat /etc/os-release 2>/dev/null | grep -i "raspbian\|raspberry\|pi" | head -3)
        if [ ! -z "$OS_INFO" ]; then
            log "✅ Raspberry Pi OS detected"
            PI_DETECTED=true
            return
        fi
    fi
    
    # Check for Pi-specific hardware (quick checks)
    if [ -e "/dev/gpiochip0" ] 2>/dev/null; then
        log "✅ Raspberry Pi GPIO detected"
        PI_DETECTED=true
        return
    fi
    
    if [ -e "/dev/spidev0.0" ] 2>/dev/null || [ -e "/dev/spidev0.1" ] 2>/dev/null; then
        log "✅ Raspberry Pi SPI detected"
        PI_DETECTED=true
        return
    fi
    
    log "ℹ️  No Raspberry Pi hardware detected"
}

# Check for device access capabilities
check_device_access() {
    log "Checking device access capabilities..."
    
    # Always enable basic USB/HID device access for EEG devices (EMOTIV, etc.)
    # Pi hardware gets additional GPIO/SPI/I2C access
    if [ -r "/dev" ] 2>/dev/null; then
        log "✅ Device access available"
        HARDWARE_ACCESS=true
        DEVICE_MOUNTS="      - /dev:/dev"  # Need write access for HID devices and /dev/shm
    else
        log "ℹ️  No device access available"
        HARDWARE_ACCESS=false
    fi
    
    # Add system access for debugging (Pi only to avoid Docker Desktop issues)
    if [ "$PI_DETECTED" = true ] && [ -r "/sys" ] 2>/dev/null && [ -r "/proc" ] 2>/dev/null; then
        log "✅ System information access available (Pi mode)"
        if [ ! -z "$DEVICE_MOUNTS" ]; then
            DEVICE_MOUNTS="$DEVICE_MOUNTS
      - /sys:/sys:ro
      - /proc:/proc:ro"
        else
            DEVICE_MOUNTS="      - /sys:/sys:ro
      - /proc:/proc:ro"
        fi
    elif [ "$PI_DETECTED" = false ] && [ "$HARDWARE_ACCESS" = true ]; then
        log "ℹ️  Skipping /proc and /sys mounts (Docker Desktop compatibility)"
    fi
    
    if [ "$PI_DETECTED" = true ]; then
        log "🚀 Pi hardware detected - enabling GPIO/SPI/I2C access"
    else
        log "💻 Non-Pi system - enabling USB/HID access for EEG devices"
    fi
}

# Check for available groups
check_groups() {
    log "Checking available system groups..."
    
    # Always available groups
    GROUP_ADDITIONS="      - dialout"
    
    # Check for bluetooth
    if getent group bluetooth >/dev/null 2>&1; then
        log "✅ Bluetooth group available"
        GROUP_ADDITIONS="$GROUP_ADDITIONS
      - bluetooth"
    else
        log "ℹ️  Bluetooth group not available"
    fi
    
    # Pi-specific groups
    if [ "$PI_DETECTED" = true ]; then
        if getent group spi >/dev/null 2>&1; then
            log "✅ SPI group available"
            GROUP_ADDITIONS="$GROUP_ADDITIONS
      - spi"
        fi
        
        if getent group gpio >/dev/null 2>&1; then
            log "✅ GPIO group available"
            GROUP_ADDITIONS="$GROUP_ADDITIONS
      - gpio"
        fi
        
        if getent group i2c >/dev/null 2>&1; then
            log "✅ I2C group available"
            GROUP_ADDITIONS="$GROUP_ADDITIONS
      - i2c"
        fi
    fi
}

# Generate docker-compose override
generate_override() {
    log "Generating docker-compose configuration..."
    
    # Determine privileged mode - be conservative for WSL2/Windows Docker
    if [ "$PI_DETECTED" = true ] && [ "$HARDWARE_ACCESS" = true ]; then
        PRIVILEGED_MODE="true"
        log "🚀 Enabling privileged mode for Pi hardware access"
    else
        PRIVILEGED_MODE="false"
        if [ "$HARDWARE_ACCESS" = true ]; then
            log "🎧 Using device mounts for USB/HID access (WSL2/Windows Docker compatibility)"
        else
            log "💻 Running in development mode (no hardware access)"
        fi
    fi
    
    # Create override file with proper YAML formatting
    cat > docker-compose.override.yml << EOF
version: '3.8'

services:
  universal-agent:
    privileged: $PRIVILEGED_MODE
    volumes:
      - ./data:/app/data
EOF
    
    # Add device mounts if available
    if [ ! -z "$DEVICE_MOUNTS" ]; then
        echo "$DEVICE_MOUNTS" >> docker-compose.override.yml
    fi
    
    # Add USB device passthrough for Windows Docker Desktop
    cat >> docker-compose.override.yml << EOF
    devices:
      - "/dev/bus/usb:/dev/bus/usb"
    extra_hosts:
      - "host.docker.internal:host-gateway"
EOF
    
    # Add group_add section
    cat >> docker-compose.override.yml << EOF
    group_add:
$GROUP_ADDITIONS
EOF
    
    log "✅ Generated docker-compose.override.yml"
}

# Main detection logic
main() {
    log "Starting environment detection..."
    
    # Run detection checks
    check_pi_hardware
    check_device_access
    check_groups
    
    # Generate configuration
    generate_override
    
    # Summary
    echo ""
    echo "📋 Environment Summary:"
    echo "   Pi Detected: $PI_DETECTED"
    echo "   Hardware Access: $HARDWARE_ACCESS"
    echo "   Privileged Mode: $PRIVILEGED_MODE"
    echo "   Device Mounts: $([ ! -z "$DEVICE_MOUNTS" ] && echo "Enabled" || echo "Disabled")"
    echo "   Groups: $(echo "$GROUP_ADDITIONS" | wc -l) groups available"
    echo ""
    
    if [ "$PI_DETECTED" = true ]; then
        echo "🚀 Pi mode enabled - gpio/spi/i2c access available"
    else
        echo "💻 Not running on a Pi - gpio/spi/i2c access disabled"
    fi
    
    echo ""
    echo "💡 Next steps:"
    echo "   docker-compose up --build"
}

# Run main function
main "$@" 