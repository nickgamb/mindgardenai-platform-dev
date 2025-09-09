# MindGarden Universal Agent

A modular, containerized agent for connecting EEG devices to the MindGarden platform. Supports multiple device types with automatic registration, Cloudflare tunneling, and real-time data streaming.

## 🎯 Overview

The Universal Agent acts as a bridge between physical EEG devices and the MindGarden cloud platform. It runs on edge devices (Pi 4/5) and provides:

- **Modular Device Support**: PiEEG (8/16 channel) and EMOTIV EPOC X
- **Auto-Registration**: Self-registers with MindGarden server via Auth0
- **Public Tunneling**: Cloudflare Tunnel for external access
- **Real-time Streaming**: WebSocket-based data transmission
- **Easy Installation**: Docker-based mgflow

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Universal Agent                          │
├─────────────────────────────────────────────────────────────┤
│  main.py (Flask App)                                       │
│  ├─ Registration UI (localhost:5000)                       │
│  ├─ Auth0 OAuth Flow                                       │
│  ├─ Device Type Selection                                  │
│  └─ Status Dashboard                                       │
├─────────────────────────────────────────────────────────────┤
│  Device Manager                                            │
│  ├─ Base Device Interface                                  │
│  ├─ PiEEG Module (SPI/GPIO)                               │
│  ├─ EMOTIV Module (Bluetooth HID)                         │
│  └─ Device Registry                                        │
├─────────────────────────────────────────────────────────────┤
│  Networking                                               │
│  ├─ Cloudflare Tunnel Client                             │
│  ├─ WebSocket Server                                      │
│  └─ API Client (MindGarden Server)                        │
├─────────────────────────────────────────────────────────────┤
│  Storage                                                  │
│  ├─ Device Configuration                                  │
│  ├─ Auth Tokens                                           │
│  └─ Streaming State                                       │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Installation & Setup

### Prerequisites
- Raspberry Pi 4/5 with Raspberry Pi OS
- Docker and Docker Compose
- Internet connection
- EEG device (PiEEG or EMOTIV EPOC X)

### Quick Start
```bash
# Clone the repository
git clone https://github.com/mindgardenai/mindgarden-platform.git
cd mindgarden-platform/universal-agent

# Install dependencies and build
chmod +x install.sh
./install.sh

# Run the agent
docker run -d \
  --name mindgarden-universal-agent \
  --privileged \
  -p 5000:5000 \
  -v /dev:/dev \
  -v $(pwd)/data:/app/data \
  mindgarden-universal-agent:latest
```

### Manual Setup
```bash
# Install Python dependencies
pip install -r requirements.txt

# Start the agent
python main.py
```

## 🔧 Device Registration Flow

### 1. Initial Setup
1. Agent starts and serves UI on `localhost:5000`
2. User navigates to registration page
3. Selects device type from dropdown
4. Clicks "Register Device"

### 2. Authentication
1. Redirects to `login.mindgardenai.com`
2. User logs in via Auth0
3. Agent receives auth token
4. Token stored securely for API calls

### 3. Auto-Registration
1. Agent starts NGROK tunnel
2. Calls MindGarden `/api/devices` endpoint
3. Registers device with public URL
4. Device appears in web-client

### 4. Ready State
1. Device shows as "Connected" in platform
2. Server can initiate streaming via WebSocket
3. User can monitor status on localhost or NGROK URL

## 📡 WebSocket Protocol

The agent implements the MindGarden WebSocket protocol for device control:

### Incoming Commands
- `start_streaming`: Begin data transmission
- `stop_streaming`: End data transmission  
- `device_status`: Get current device state
- `calibrate`: Run device calibration

### Outgoing Events
- `streaming_started`: Confirm streaming began
- `streaming_stopped`: Confirm streaming ended
- `eeg_data`: Real-time EEG samples
- `device_error`: Error notifications

### Data Format
```json
{
  "device_id": "device_123",
  "timestamp": "1234567890.123",
  "channels": ["CH1", "CH2", "CH3", "CH4"],
  "data": [0.1, 0.2, -0.1, 0.3],
  "sample_rate": 250,
  "device_model": "pieeg_8"
}
```

## 🔌 Supported Devices

### PiEEG (8/16 Channel)
- **Connection**: Direct SPI/GPIO to Pi
- **Channels**: 8 or 16 differential
- **Sample Rate**: 250 Hz
- **Installation**: Agent runs on PiEEG Pi itself

### EMOTIV EPOC X
- **Connection**: USB Dongle (HID) or Bluetooth LE (auto-fallback)
- **Channels**: 14 + motion sensors
- **Sample Rate**: 128 Hz
- **Installation**: Agent runs on Pi hub with USB/Bluetooth

### IDUN Guardian
- **Connection**: Bluetooth Low Energy (BLE)
- **Channels**: 1 (single-channel EEG)
- **Sample Rate**: 250 Hz
- **Installation**: Agent runs on Pi hub with Bluetooth LE

## 📁 Project Structure

```
universal-agent/
├── README.md                 # This file
├── requirements.txt          # Python dependencies
├── Dockerfile               # Container build
├── docker-compose.yml       # Multi-container setup
├── install.sh              # Installation script
├── main.py                 # Flask entry point
├── config/
│   ├── settings.py         # Configuration
│   └── logging.conf        # Logging setup
├── core/
│   ├── __init__.py
│   ├── auth.py            # Auth0 integration
│   ├── device_manager.py  # Device coordination
│   ├── ngrok_client.py    # NGROK management
│   └── websocket_server.py # WebSocket handling
├── devices/
│   ├── __init__.py
│   ├── base_device.py     # Abstract device interface
│   ├── pieeg/
│   │   ├── __init__.py
│   │   ├── pieeg_device.py
│   │   └── spi_interface.py
│   └── emotiv/
│       ├── __init__.py
│       ├── emotiv_device.py
│       └── hid_interface.py
├── templates/
│   ├── index.html         # Registration UI
│   ├── status.html        # Device status
│   └── error.html         # Error page
├── static/
│   ├── css/
│   ├── js/
│   └── images/
├── data/
│   ├── device_config.json # Device settings
│   ├── tokens.json        # Auth tokens
│   └── logs/              # Application logs
└── tests/
    ├── test_devices.py    # Device tests
    ├── test_auth.py       # Auth tests
    └── test_websocket.py  # WebSocket tests
```

## 🔄 Development Roadmap

### Phase 1: Core Infrastructure ✅
- [x] Project structure and README
- [x] Flask app with registration UI
- [x] Docker containerization
- [x] Basic device manager

### Phase 2: Authentication & Registration ✅
- [x] Auth0 OAuth integration
- [x] NGROK client implementation
- [x] Server API registration
- [x] Token management

### Phase 3: Device Integration ✅
- [x] Base device interface
- [x] PiEEG module refactoring
- [x] EMOTIV module refactoring
- [x] Device discovery and connection

### Phase 4: Streaming & Communication ✅
- [x] WebSocket server implementation
- [x] Real-time data streaming
- [x] Command handling
- [x] Error management

### Phase 5: Testing & MGFlow ✅
- [x] Installation automation
- [x] Documentation completion
- [ ] End-to-end testing (pending user testing)
- [ ] Performance optimization (ongoing)

## 🛠️ Development Status

### ✅ Completed
- ✅ Project structure and architecture
- ✅ Flask web application with registration UI
- ✅ Auth0 OAuth authentication flow
- ✅ NGROK tunnel integration
- ✅ Device manager and base device interface
- ✅ PiEEG SPI/GPIO implementation
- ✅ EMOTIV HID/Bluetooth implementation  
- ✅ WebSocket server for streaming commands
- ✅ Device self-registration with MindGarden server
- ✅ Docker containerization and mgflow
- ✅ Installation scripts and documentation

### 🚧 Ready for Testing
- End-to-end device registration flow
- Real-time EEG data streaming
- WebSocket command handling
- Docker mgflow on Raspberry Pi

### 📋 Future Enhancements
- Multi-device support per agent
- Advanced signal processing
- Device health monitoring
- Performance optimizations

## 🔗 Integration Points

### MindGarden Server
- **Auth**: `login.mindgardenai.com`
- **API**: `POST /api/devices` for registration
- **WebSocket**: Streaming command interface

### Supported Models
- `pieeg_8`: PiEEG 8 Channel
- `pieeg_16`: PiEEG 16 Channel  
- `emotiv_epoc_x`: EMOTIV EPOC X
- `idun_guardian`: IDUN Guardian

PS C:\Users\Nick> usbipd list
Connected:
BUSID  VID:PID    DEVICE                                                        STATE
1-2    1462:7d30  USB Input Device                                              Not shared
1-3    0db0:005a  Realtek USB2.0 Audio, USB Input Device                        Not shared
1-14   8087:0032  Intel(R) Wireless Bluetooth(R)                                Not shared
2-2    1b1c:1b64  USB Input Device                                              Not shared
3-1    1234:ed02  USB Input Device                                              Shared

Persisted:
GUID                                  DEVICE
ce4129d1-88e5-46c1-8e4d-a046338a3967  USB Serial Converter

PS C:\Users\Nick> usbipd attach --wsl --busid 3-1
usbipd: info: Using WSL distribution 'Ubuntu' to attach; the device will be available in all WSL 2 distributions.
usbipd: info: Using IP address 192.168.64.1 to reach the host.
PS C:\Users\Nick> bash

## 🔒 Security

- **JWT Authentication**: Full JWKS validation aligned with server
- **Auth0 Integration**: OAuth 2.0 flow with cryptographic token verification
- **Public Access Control**: JWT-protected endpoints prevent unauthorized access
- **HTTPS/WSS**: Encrypted communication via Cloudflare Tunnel
- **Local Token Storage**: Secure session persistence
- **Device Isolation**: Containerized mgflow

## 📞 Support

For issues or questions:
- GitHub Issues: [mindgarden-platform/issues](https://github.com/mindgardenai/mindgarden-platform/issues)
- Email: support@mindgardenai.com
- Documentation: [docs.mindgardenai.com](https://docs.mindgardenai.com)

## 📜 License

Licensed under Glyphware License v1.0 - See LICENSE-GLYPHWARE.md

---

*Building bridges between consciousness and technology* 🧠✨