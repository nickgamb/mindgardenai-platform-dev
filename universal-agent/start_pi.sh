#!/bin/bash
# MindGarden Universal Agent - Pi Native Startup Script
# Designed for direct Pi installation with GPIO/SPI access

export LANG=C.UTF-8
export LC_ALL=C.UTF-8

set -e

echo "🧠 MindGarden Universal Agent - Pi Native Startup"
echo "================================================="

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check if running on Raspberry Pi
check_pi_environment() {
    if [[ ! -f "/proc/device-tree/model" ]]; then
        log "⚠️  Warning: This script is designed for Raspberry Pi"
        log "   Some features may not work on other platforms"
        return 0
    fi
    
    PI_MODEL=$(cat /proc/device-tree/model)
    log "✅ Running on: $PI_MODEL"
}

# Function to install udev rules
install_udev_rules() {
    log "🔧 Installing udev rules for device access..."
    
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
}

# Function to check and enable SPI
check_spi() {
    log "🔍 Checking SPI interface..."
    
    # Check if SPI is enabled
    if ls /dev/spidev* 1> /dev/null 2>&1; then
        log "✅ SPI interface is enabled"
        ls /dev/spidev*
    else
        log "⚠️  SPI interface not found"
        log "   To enable SPI:"
        log "   sudo raspi-config"
        log "   Navigate to: Interface Options > SPI > Enable"
        log "   Then reboot the Pi"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "⚠️  Startup cancelled by user"
            exit 1
        fi
    fi
}

# Function to check Python dependencies
check_python_deps() {
    log "🔍 Checking Python dependencies..."
    
    if ! command -v python3 &> /dev/null; then
        log "❌ Error: Python 3 is not installed"
        log "   Install with: sudo apt update && sudo apt install python3 python3-pip"
        exit 1
    fi
    
    # Check if requirements.txt exists
    if [ ! -f "requirements.txt" ]; then
        log "❌ Error: requirements.txt not found"
        exit 1
    fi
    
    log "📦 Installing Python dependencies for GPIO/SPI compatibility..."
    log "   Using system packages for GPIO/SPI and pip for others"
    
    # Install critical GPIO/SPI packages via apt (system packages)
    log "🔧 Installing GPIO/SPI system packages..."
    sudo apt update
    sudo apt install -y python3-spidev python3-rpi.gpio python3-gpiozero python3-numpy python3-scipy python3-serial
    
    # Install remaining packages with --break-system-packages for compatibility
    if command -v pip3 &> /dev/null; then
        log "🔧 Installing remaining Python packages..."
        sudo pip3 install --break-system-packages -r requirements.txt
        log "✅ Python dependencies installed for GPIO/SPI compatibility"
    else
        log "❌ Error: pip3 not found"
        log "   Install with: sudo apt install python3-pip"
        exit 1
    fi
}

# Function to check and install cloudflared
check_cloudflared() {
    log "🔍 Checking cloudflared installation..."
    
    if command -v cloudflared &> /dev/null; then
        log "✅ cloudflared is already installed"
        cloudflared --version
    else
        log "📦 Installing cloudflared..."
        
        # Download and install cloudflared for ARM64 (Pi 4/5)
        if curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb; then
            sudo dpkg -i cloudflared.deb
            rm cloudflared.deb
            log "✅ cloudflared installed successfully"
        else
            log "⚠️  Failed to download cloudflared"
            log "   You can install it manually:"
            log "   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb"
            log "   sudo dpkg -i cloudflared.deb"
            log "   rm cloudflared.deb"
        fi
    fi
}

# Function to check environment file
check_env_file() {
    log "🔍 Checking environment configuration..."
    
    if [ ! -f ".env" ]; then
        if [ -f "config.env.template" ]; then
            log "📝 Creating .env file from template..."
            cp config.env.template .env
            log "✅ Created .env file from template"
            log "   Please edit .env file with your configuration"
        else
            log "⚠️  No .env file found and no template available"
            log "   You may need to create one manually"
        fi
    else
        log "✅ .env file found"
    fi
}

# Function to create systemd service (optional)
create_service() {
    read -p "Create systemd service for auto-start? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "🔧 Creating systemd service..."
        
        SERVICE_FILE="/etc/systemd/system/mindgarden-agent.service"
        CURRENT_DIR=$(pwd)
        USER=$(whoami)
        
        sudo tee $SERVICE_FILE > /dev/null <<EOF
[Unit]
Description=MindGarden Universal Agent
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$CURRENT_DIR
ExecStart=/usr/bin/python3 $CURRENT_DIR/main.py
Restart=always
RestartSec=10
Environment=PYTHONPATH=$CURRENT_DIR

[Install]
WantedBy=multi-user.target
EOF
        
        sudo systemctl daemon-reload
        sudo systemctl enable mindgarden-agent
        log "✅ Systemd service created and enabled"
        log "   Start with: sudo systemctl start mindgarden-agent"
        log "   Status: sudo systemctl status mindgarden-agent"
    fi
}

# Main execution
main() {
    # Check if we're in the right directory
    if [ ! -f "main.py" ]; then
        log "❌ Error: main.py not found"
        log "   Please run this script from the universal-agent directory"
        exit 1
    fi
    
    # Check Pi environment
    check_pi_environment
    
    # Install udev rules
    install_udev_rules
    
    # Check SPI interface
    check_spi
    
    # Check Python dependencies
    check_python_deps
    
    # Check cloudflared installation
    check_cloudflared
    
    # Check environment file
    check_env_file
    
    # Create systemd service (optional)
    create_service
    
    # Show startup information
    log "📋 Startup Information:"
    echo "----------------------------------------"
    log "   Access URL: http://localhost:5000"
    log "   Working Directory: $(pwd)"
    log "   Python Version: $(python3 --version)"
    log "   SPI Devices: $(ls /dev/spidev* 2>/dev/null || echo 'None found')"
    echo "----------------------------------------"
    
    # Ask for confirmation
    read -p "Start MindGarden Universal Agent with sudo (needed for GPIO/SPI)? (Y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        log "⚠️  Startup cancelled by user"
        exit 1
    fi
    
    # Start the application
    log "🚀 Starting MindGarden Universal Agent with sudo privileges..."
    log "   This is required for GPIO/SPI access on Raspberry Pi"
    log "   Press Ctrl+C to stop"
    
    # Set PYTHONPATH to include current directory
    export PYTHONPATH="$(pwd):$PYTHONPATH"
    
    # Prepare environment for sudo execution - using system Python for GPIO compatibility
    PYTHON_CMD="python3"
    
    # Check if sudo is available
    if command -v sudo &> /dev/null; then
        log "🔐 Requesting sudo privileges for GPIO/SPI access..."
        log "   Using system Python for maximum GPIO/SPI compatibility"
        # Run with sudo, preserving environment and using system Python
        sudo -E PYTHONPATH="$PYTHONPATH" "$PYTHON_CMD" main.py
    else
        log "⚠️  Warning: sudo not available, running without elevated privileges"
        log "   GPIO/SPI operations may fail"
        python3 main.py
    fi
}

# Run main function
main "$@" 