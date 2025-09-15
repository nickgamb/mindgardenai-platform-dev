# NeuroTech Workloads

NeuroTech extends the core platform with device streaming and experiment mgflow:
- Adds Devices and Experiments pages
- Adds MGFlow nodes for device streaming and experiments
- Integrates with the Universal Agent for real-time EEG streaming

## Enabling/Disabling

- In the Web-Client, go to Settings > Feature Flags and toggle “NeuroTech Workloads”.
- This persists to `/api/user/settings` and mirrors to `localStorage` as `feature_neuroTechWorkloads`.
- Server defaults the flag to true for new users; see `server/services/user_settings.py`.

## Universal Agent Setup (EEG streaming)

1) Prerequisites
- Raspberry Pi 4/5 with Docker & Compose
- Supported device (PiEEG, EMOTIV EPOC X, IDUN Guardian)
- Network access to your MindGarden Server

2) Build/Run
- On the Pi, clone this repo and go to `universal-agent/`.
- Copy `config.env.template` to `.env` and fill Auth0 and API settings.
- Option A: Docker
  - `./install.sh` then run the container (see agent README)
- Option B: Python
  - `pip install -r requirements.txt && python main.py`

3) Registration Flow
- Visit `http://<pi-ip>:5000` and choose device type
- Complete Auth0 login; agent registers device via `/api/devices`
- Device appears on the platform Devices page

4) Streaming Control
- From the platform, use Devices page or MGFlow nodes to start/stop streaming
- WebSocket channel is established by the agent; events include `start_streaming`, `stop_streaming`, and `eeg_data`

## Experiments

- Experiments page allows managing experiment definitions and running sessions
- Feature-gated by the same NeuroTech flag

## Troubleshooting

- Device not showing: verify agent can reach server `/api/devices` and Auth0 tokens are valid
- Streaming not starting: check WebSocket connectivity and agent logs
- USB/HID on Windows WSL: use `usbipd` to attach devices to WSL as needed
