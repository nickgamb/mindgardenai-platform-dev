# MindGarden Universal Agent - Quick Start Guide

## 🚀 Quick Installation (Raspberry Pi)

### Prerequisites
- Raspberry Pi 4/5 with Raspberry Pi OS
- Internet connection
- Admin access (sudo)

### One-Line Install
```bash
curl -fsSL https://raw.githubusercontent.com/mindgardenai/mindgarden-platform/main/universal-agent/install.sh | sudo bash
```

### Manual Installation
```bash
# Clone repository
git clone https://github.com/mindgardenai/mindgarden-platform.git
cd mindgarden-platform/universal-agent

# Run installer
sudo chmod +x install.sh
sudo ./install.sh
```

## ⚙️ Configuration

### 1. Edit Environment File
```bash
sudo nano /opt/mindgarden/universal-agent/.env
```

### 2. Required Settings
```bash
# Auth0 Configuration
AUTH0_CLIENT_ID=your_auth0_client_id
AUTH0_CLIENT_SECRET=your_auth0_client_secret

# NGROK Configuration (optional but recommended)
NGROK_AUTH_TOKEN=your_ngrok_auth_token
NGROK_SUBDOMAIN=your_preferred_subdomain
```

### 3. Start the Service
```bash
# Start the agent
sudo systemctl start mindgarden-universal-agent

# Enable auto-start on boot
sudo systemctl enable mindgarden-universal-agent

# Check status
sudo systemctl status mindgarden-universal-agent
```

## 🖥️ Access the Agent

### Local Access
Open your browser and navigate to:
```
http://localhost:5000
```

### Remote Access (with NGROK)
If NGROK is configured, you'll get a public URL like:
```
https://your-subdomain.ngrok.io
```

## 📱 Device Registration Flow

1. **Open Agent Interface**: Navigate to the agent URL
2. **Select Device Type**: Choose PiEEG or EMOTIV EPOC X
3. **Enter Device Name**: Give your device a friendly name
4. **Click Register**: This will redirect to login.mindgardenai.com
5. **Login**: Use your MindGarden account credentials
6. **Complete**: Device will appear in your MindGarden dashboard

## 🔧 Device-Specific Setup

### PiEEG Configuration
```bash
# Enable SPI interface
sudo raspi-config
# Navigate to: Interface Options > SPI > Enable

# Verify SPI is working
ls /dev/spidev*
# Should show: /dev/spidev0.0
```

### EMOTIV EPOC X Setup
**Option 1: USB Dongle (Recommended)**
1. Connect EMOTIV USB dongle to the Pi
2. Power on your EMOTIV EPOC X headset
3. Agent will automatically connect via HID interface

**Option 2: Direct Bluetooth (Auto-fallback)**
1. If no USB dongle detected, agent will scan for BLE devices
2. Power on your EMOTIV EPOC X headset
3. Agent will automatically discover and connect via Bluetooth LE

**Note**: The agent tries USB dongle first, then falls back to Bluetooth automatically

### IDUN Guardian Setup
1. Ensure Bluetooth LE is enabled on the Pi
2. Power on your IDUN Guardian device
3. The agent will scan for devices with "IGEB" prefix
4. Device will auto-connect during registration

## 📊 Monitoring

### Check Service Status
```bash
sudo systemctl status mindgarden-universal-agent
```

### View Logs
```bash
# Service logs
sudo journalctl -u mindgarden-universal-agent -f

# Container logs
cd /opt/mindgarden/universal-agent
sudo docker-compose logs -f
```

### Health Check
```bash
curl http://localhost:5000/health
```

## 🔥 Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check Docker status
sudo systemctl status docker

# Restart Docker
sudo systemctl restart docker

# Rebuild image
cd /opt/mindgarden/universal-agent
sudo docker-compose build --no-cache
```

#### Device Not Detected
```bash
# For PiEEG - check SPI
ls /dev/spidev*
sudo dmesg | grep spi

# For EMOTIV - check HID devices
ls /dev/hidraw*
lsusb | grep -i emotiv
```

#### Permission Issues
```bash
# Add user to required groups
sudo usermod -aG spi,gpio,dialout,input $USER

# Logout and login again
```

#### Network Issues
```bash
# Check if agent is listening
sudo netstat -tlnp | grep :5000

# Test local connection
curl -v http://localhost:5000/health

# Check NGROK status
sudo docker exec mindgarden-universal-agent pyngrok config
```

## 🛠️ Advanced Configuration

### Custom Docker Compose
```yaml
# docker-compose.override.yml
version: '3.8'
services:
  universal-agent:
    environment:
      - DEBUG=true
      - CUSTOM_SETTING=value
    ports:
      - "8080:5000"  # Custom port
```

### Development Mode
```bash
# Run without Docker
cd /opt/mindgarden/universal-agent
pip install -r requirements.txt
python main.py
```

## 📞 Support

- **Documentation**: [docs.mindgardenai.com](https://docs.mindgardenai.com)
- **GitHub Issues**: [github.com/mindgardenai/mindgarden-platform/issues](https://github.com/mindgardenai/mindgarden-platform/issues)
- **Email Support**: support@mindgardenai.com
- **Discord Community**: [discord.gg/mindgarden](https://discord.gg/mindgarden)

## 📋 Command Reference

```bash
# Service Management
sudo systemctl start mindgarden-universal-agent
sudo systemctl stop mindgarden-universal-agent
sudo systemctl restart mindgarden-universal-agent
sudo systemctl status mindgarden-universal-agent

# Docker Operations
cd /opt/mindgarden/universal-agent
sudo docker-compose up -d          # Start in background
sudo docker-compose down           # Stop containers
sudo docker-compose restart        # Restart services
sudo docker-compose logs -f        # Follow logs
sudo docker-compose build          # Rebuild image

# Configuration
sudo nano /opt/mindgarden/universal-agent/.env    # Edit config
sudo systemctl daemon-reload                      # Reload systemd
```

---

Happy brain-computer interfacing! 🧠✨