#!/usr/bin/env python3
"""
MindGarden Universal Agent - Main Entry Point

A modular agent for connecting EEG devices to the MindGarden platform.
Supports PiEEG and EMOTIV devices with automatic registration and streaming.
"""
# TODO: Bug it opens a tunnel and then opens a new tunnel 
import os
import sys
import logging
import logging.config
import json
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from flask_socketio import SocketIO, emit
from flask_cors import CORS

# Import our modules
from config.settings import get_config
from core.auth import AuthManager
from core.device_manager import DeviceManager  
from core.cloudflare_client import CloudflareClient
from core.websocket_server import WebSocketHandler
from core.jwt_auth import create_auth_decorator


# Initialize configuration
config = get_config()
config.init_directories()

# Configure logging
log_config_path = os.path.join(project_root, 'config', 'logging.conf')
try:
    logging.config.fileConfig(log_config_path)
except Exception as e:
    logging.basicConfig(level=logging.INFO)
    logging.warning(f"Could not load logging config: {e}")

logger = logging.getLogger('app')

# Initialize Flask app
app = Flask(__name__)
app.config.from_object(config)

# Initialize extensions
cors = CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", ping_timeout=config.WEBSOCKET_PING_TIMEOUT)

# Initialize managers
auth_manager = AuthManager(config)
device_manager = DeviceManager(config)
tunnel_client = CloudflareClient(config)
websocket_handler = WebSocketHandler(socketio, device_manager, config)

# Initialize JWT authentication
require_auth = create_auth_decorator(config)

# Global state
app_state = {
    'registered': False,
    'device_config': None,
    'tunnel_url': None,
    'auth_token': None,
    'user_info': None,
    'device_id': None,
    'device_status': 'disconnected'
}

def load_state():
    """Load application state from disk"""
    global app_state
    try:
        if os.path.exists(config.CONFIG_FILE):
            with open(config.CONFIG_FILE, 'r') as f:
                saved_config = json.load(f)
                app_state.update(saved_config)
                logger.info("Loaded saved configuration")
    except Exception as e:
        logger.error(f"Error loading state: {e}")

def save_state():
    """Save application state to disk"""
    try:
        with open(config.CONFIG_FILE, 'w') as f:
            json.dump(app_state, f, indent=2)
        logger.info("Saved application state")
    except Exception as e:
        logger.error(f"Error saving state: {e}")

# Routes

@app.route('/')
@require_auth
def index():
    """Main landing page"""
    if app_state['registered']:
        # For registered devices, always redirect to auth gate first
        return redirect(url_for('auth_gate'))
    return render_template('index.html', 
                         devices=config.SUPPORTED_DEVICES,
                         tunnel_url=app_state.get('tunnel_url'))

@app.route('/register')
def register():
    """Device registration page"""
    if app_state['registered']:
        return redirect(url_for('auth_gate'))
    return render_template('register.html', devices=config.SUPPORTED_DEVICES)

@app.route('/auth-gate')
def auth_gate():
    """Authentication gate for registered devices - always redirect to Auth0"""
    if not app_state['registered']:
        return redirect(url_for('index'))
    
    # Always redirect to Auth0 for authentication
    base_url = app_state.get('tunnel_url') or request.url_root
    auth_url = auth_manager.get_auth_url(base_url)
    logger.info(f"Redirecting to Auth0 for authentication: {auth_url}")
    return redirect(auth_url)

@app.route('/status')
def status():
    """Device status page - only accessible after Auth0 verification"""
    if not app_state['registered']:
        return redirect(url_for('index'))
    
    # Check if user just came from successful auth (has valid token)
    if not app_state.get('auth_token') or not app_state.get('user_info'):
        logger.warning("No valid authentication found, redirecting to auth gate")
        return redirect(url_for('auth_gate'))
    
    return render_template('status.html', 
                         state=app_state,
                         device_info=config.SUPPORTED_DEVICES.get(app_state.get('device_config', {}).get('device_model')))

@app.route('/api/register', methods=['POST'])
def api_register_device():
    """Start device registration process - first scan for physical device"""
    try:
        data = request.json
        device_model = data.get('device_model')
        device_name = data.get('device_name', f'Universal Agent - {device_model}')
        
        if device_model not in config.SUPPORTED_DEVICES:
            return jsonify({'error': 'Unsupported device model'}), 400
        
        # First, scan for the actual physical device using existing device classes
        logger.info(f"Scanning for physical {device_model} device...")
        
        if device_model == 'emotiv_epoc_x':
            # Try USB interface first, then HID as fallback
            from devices.emotiv.usb_interface import USBInterface
            from devices.emotiv.hid_interface import HIDInterface
            
            # Try USB first
            usb_interface = USBInterface()
            available_devices = usb_interface.scan_devices()
            
            if not available_devices:
                # Fallback to HID
                hid_interface = HIDInterface()
                available_devices = hid_interface.scan_devices()
                
                if not available_devices:
                    return jsonify({
                        'error': 'No EMOTIV device found. Please ensure your EMOTIV USB dongle is connected and device is powered on.'
                    }), 400
            
            # Use the first available device
            device_info = available_devices[0]
            device_serial = device_info['serial_number']
            if not device_serial or device_serial == 'None':
                # No fallback generation - if no serial available, fail
                logger.error("No device serial number available - device may not be properly connected")
                return jsonify({'error': 'No device serial number available - device may not be properly connected'}), 400
                
        elif device_model in ['pieeg_8', 'pieeg_16']:
            # Scan for PiEEG devices using the device class
            from devices.pieeg.pieeg_device import PiEEGDevice
            
            # Create a temporary device instance to scan for physical devices
            temp_config = {
                'channels': 8 if device_model == 'pieeg_8' else 16,
                'gain': 6,
                'spi_bus': 0,
                'spi_device': 0,
                'gpio_pin': 26
            }
            
            temp_device = PiEEGDevice('temp_scan', temp_config)
            available_devices = temp_device.get_available_devices()
            
            if not available_devices:
                return jsonify({
                    'error': 'No PiEEG device found. Please ensure your PiEEG board is properly connected via SPI/GPIO.'
                }), 400
            
            # Use the first available device
            device_info = available_devices[0]
            device_serial = device_info['address']  # Use address as serial for PiEEG
            if not device_serial:
                logger.error("No device address available - PiEEG may not be properly connected")
                return jsonify({'error': 'No device address available - PiEEG may not be properly connected'}), 400
                
        else:
            return jsonify({'error': f'Physical device scanning not implemented for {device_model}'}), 400
        
        logger.info(f"Found {device_model} device with serial: {device_serial}")
        
        # Store registration intent with actual device serial as ID
        app_state['device_config'] = {
            'device_name': device_name,
            'device_model': device_model,
            'device_serial': device_serial,
            'device_settings': {}
        }
        app_state['device_id'] = device_serial  # Use device serial as ID
        save_state()
        
        # Use tunnel URL for Auth0 redirect if available, otherwise use localhost
        base_url = app_state.get('tunnel_url') or request.url_root
        
        # Redirect to Auth0 login
        auth_url = auth_manager.get_auth_url(base_url)
        logger.info(f"Generated auth URL with base: {base_url}")
        return jsonify({'auth_url': auth_url})
        
    except Exception as e:
        logger.error(f"Registration error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/callback')
def auth_callback():
    """Handle Auth0 callback"""
    try:
        code = request.args.get('code')
        if not code:
            return redirect(url_for('index', error='Authentication failed'))
        
        # Exchange code for tokens using the same base URL that was used for auth
        base_url = app_state.get('tunnel_url') or request.url_root
        token_info = auth_manager.exchange_code_for_token(code, base_url)
        logger.info(f"Using base URL for token exchange: {base_url}")
        app_state['auth_token'] = token_info['access_token']
        
        # Get user info and refresh stored token
        user_info = auth_manager.get_user_info(token_info['access_token'])
        app_state['user_info'] = user_info
        logger.info(f"Token refreshed for user: {user_info.get('email', user_info['sub'])}")
        
        # Check if this is initial registration or subsequent auth
        if not app_state.get('registered'):
            # Initial registration flow
            # Tunnel should already be running from startup
            if not app_state.get('tunnel_url'):
                logger.warning("No tunnel URL available - this might cause issues with server registration")
                return redirect(url_for('index', error='Tunnel not available'))
            
            # Register device with MindGarden server using device serial as ID
            device_config = app_state['device_config']
            device_config['device_settings']['tunnel_url'] = app_state['tunnel_url']
            device_serial = device_config['device_serial']
            
            # Use device serial number as the device ID for server registration
            registration_data = {
                'device_id': device_serial,  # Use actual device serial
                'device_name': device_config['device_name'],
                'device_model': device_config['device_model'],
                'device_settings': device_config['device_settings']
            }
            
            registration_result = auth_manager.register_device_with_server_custom_id(
                registration_data, 
                token_info['access_token']
            )
            
            if registration_result['success']:
                app_state['registered'] = True
                app_state['device_id'] = device_serial  # Use device serial as ID for device manager
                app_state['server_device_id'] = registration_result.get('device_id', device_serial)  # Store server's ID for API calls
                
                # Now create device instance with the actual device serial
                device_creation_config = {
                    'device_model': device_config['device_model'],
                    'sample_rate': config.SUPPORTED_DEVICES[device_config['device_model']]['sample_rate'],
                    'channels': config.SUPPORTED_DEVICES[device_config['device_model']]['channels'],
                    'device_name': device_config['device_name'],
                    'device_serial': device_serial
                }
                
                create_result = device_manager.create_device(device_config['device_model'], device_serial, device_creation_config)
                if create_result:
                    logger.info(f"Device instance created successfully: {device_serial}")
                    app_state['device_status'] = 'disconnected'  # Created but not connected yet
                    success_message = f'Device {device_serial} registered successfully. Use Connect button to connect to physical device.'
                else:
                    app_state['device_status'] = 'error'
                    logger.error(f"Failed to create device instance: {device_serial}")
                    success_message = 'Device registered but failed to create device instance'
                
                save_state()
                logger.info(f"Device registration completed: {device_serial}")
                return redirect(url_for('status', success=success_message))
            else:
                logger.error(f"Device registration failed: {registration_result['error']}")
                return redirect(url_for('index', error=registration_result['error']))
        else:
            # Subsequent authentication - just refresh token and redirect to status
            save_state()
            logger.info("User re-authenticated successfully")
            return redirect(url_for('status'))
            
    except Exception as e:
        logger.error(f"Callback error: {e}")
        return redirect(url_for('index', error='Authentication callback failed'))

@app.route('/api/logout', methods=['POST'])
def api_logout():
    """Logout and reset device"""
    try:
        # Unregister device from server if registered
        if app_state.get('registered') and (app_state.get('device_id') or app_state.get('server_device_id')):
            try:
                # Get current access token, refresh if needed
                access_token = app_state.get('auth_token')
                if not access_token:
                    # Try to load stored token
                    stored_token = auth_manager.load_stored_token()
                    if stored_token:
                        access_token = stored_token.get('access_token')
                
                # Use server's device ID for unregistration if available, otherwise use device_id
                device_id_to_unregister = app_state.get('server_device_id') or app_state.get('device_id')
                
                if access_token:
                    logger.info(f"Unregistering device {device_id_to_unregister} from server")
                    unregister_result = auth_manager.unregister_device_from_server(
                        device_id_to_unregister, 
                        access_token
                    )
                    
                    if unregister_result['success']:
                        logger.info("Device successfully unregistered from server")
                    else:
                        logger.warning(f"Failed to unregister device from server: {unregister_result['error']}")
                        # Try with token refresh if unregistration failed
                        if '401' in str(unregister_result.get('error', '')) or '403' in str(unregister_result.get('error', '')):
                            logger.info("Token may be expired, attempting token refresh...")
                            stored_token = auth_manager.load_stored_token()
                            if stored_token and stored_token.get('refresh_token'):
                                refreshed_token = auth_manager.refresh_token(stored_token['refresh_token'])
                                if refreshed_token:
                                    # Try unregistration again with refreshed token
                                    unregister_result = auth_manager.unregister_device_from_server(
                                        device_id_to_unregister, 
                                        refreshed_token['access_token']
                                    )
                                    if unregister_result['success']:
                                        logger.info("Device successfully unregistered from server after token refresh")
                                    else:
                                        logger.warning(f"Failed to unregister device even after token refresh: {unregister_result['error']}")
                else:
                    logger.warning("No access token available for device unregistration")
                    
            except Exception as e:
                logger.warning(f"Error unregistering device from server: {e}")
                # Continue with logout even if unregistration fails
        
        # Keep tunnel running - only stop on server shutdown
        # Tunnel should persist across user sessions for continuous access
        
        # Stop any active streaming
        device_manager.stop_all_streaming()
        
        # Clear state
        app_state.update({
            'registered': False,
            'device_config': None,
            'tunnel_url': None,
            'auth_token': None,
            'user_info': None,
            'device_id': None,
            'server_device_id': None,
            'device_status': 'disconnected'
        })
        save_state()
        
        # Clear stored tokens
        auth_manager.clear_stored_token()
        
        logger.info("Device logged out and reset")
        return jsonify({'success': True})
        
    except Exception as e:
        logger.error(f"Logout error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/device/status')
@require_auth
def api_device_status():
    """Get current device status"""
    return jsonify({
        'registered': app_state['registered'],
        'device_status': app_state['device_status'],
        'tunnel_url': app_state['tunnel_url'],
        'user_info': app_state['user_info'],
        'device_config': app_state['device_config']
    })

@app.route('/api/device/connect', methods=['POST'])
@require_auth
def api_connect_device():
    """Connect to physical device"""
    try:
        if not app_state.get('registered') or not app_state.get('device_id'):
            return jsonify({'error': 'Device not registered'}), 400
        
        device_id = app_state['device_id']
        result = device_manager.connect_device(device_id)
        
        if result['success']:
            app_state['device_status'] = 'connected'
            save_state()
            logger.info(f"Device {device_id} connected via API")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"API connect device error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/device/disconnect', methods=['POST'])
@require_auth
def api_disconnect_device():
    """Disconnect from physical device"""
    try:
        if not app_state.get('registered') or not app_state.get('device_id'):
            return jsonify({'error': 'Device not registered'}), 400
        
        device_id = app_state['device_id']
        result = device_manager.disconnect_device(device_id)
        
        if result['success']:
            app_state['device_status'] = 'disconnected'
            save_state()
            logger.info(f"Device {device_id} disconnected via API")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"API disconnect device error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/device/stream/start', methods=['POST'])
@require_auth  
def api_start_streaming():
    """Start device streaming"""
    try:
        if not app_state.get('registered') or not app_state.get('device_id'):
            return jsonify({'error': 'Device not registered'}), 400
        
        device_id = app_state['device_id']
        device_model = app_state['device_config']['device_model']
        
        result = device_manager.start_streaming(device_model, device_id, socketio)
        
        if result['success']:
            app_state['device_status'] = 'streaming'
            save_state()
            logger.info(f"Device {device_id} streaming started via API")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"API start streaming error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/device/stream/stop', methods=['POST'])
@require_auth
def api_stop_streaming():
    """Stop device streaming"""
    try:
        if not app_state.get('registered') or not app_state.get('device_id'):
            return jsonify({'error': 'Device not registered'}), 400
        
        device_id = app_state['device_id']
        result = device_manager.stop_streaming(device_id)
        
        if result['success']:
            app_state['device_status'] = 'connected'
            save_state()
            logger.info(f"Device {device_id} streaming stopped via API")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"API stop streaming error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/debug/devices')
# Allowing for debugging without auth for now
# @require_auth
def api_debug_devices():
    """Debug endpoint to show device manager state"""
    try:
        return jsonify({
            'app_state': {
                'registered': app_state.get('registered'),
                'device_id': app_state.get('device_id'),
                'device_status': app_state.get('device_status'),
                'device_config': app_state.get('device_config')
            },
            'device_manager': {
                'devices': list(device_manager.devices.keys()),
                'active_streams': list(device_manager.active_streams.keys()),
                'supported_devices': list(device_manager.device_classes.keys())
            }
        })
        
    except Exception as e:
        logger.error(f"Debug devices error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/debug/hid')
# Allowing for debugging without auth for now
# @require_auth
def api_debug_hid():
    """Debug endpoint to list HID devices with comprehensive system info"""
    try:
        import sys
        sys.path.append('/usr/lib/python3/dist-packages')
        import hidapi
        import os
        import platform
        import glob
        
        devices = []
        device_list = hidapi.hidapi.hid_enumerate(0, 0)  # Enumerate all devices
        current = device_list
        while current:
            # Convert CFFI objects to Python strings/bytes
            ffi = hidapi.ffi
            
            # Convert bytes to strings for JSON serialization
            def safe_convert_c_string(c_string):
                if not c_string:
                    return 'None'
                try:
                    result = ffi.string(c_string)
                    if isinstance(result, bytes):
                        return result.decode('utf-8', errors='replace')
                    return str(result)
                except Exception:
                    return 'None'
            
            serial_number = safe_convert_c_string(current.serial_number)
            manufacturer = safe_convert_c_string(current.manufacturer_string)
            product = safe_convert_c_string(current.product_string)
            path = safe_convert_c_string(current.path)
            
            devices.append({
                'vendor_id': current.vendor_id,
                'vendor_id_hex': f"0x{current.vendor_id:04x}",
                'product_id': current.product_id, 
                'product_id_hex': f"0x{current.product_id:04x}",
                'serial_number': serial_number,
                'manufacturer': manufacturer,
                'product': product,
                'path': path,
                'is_emotiv': current.vendor_id == 4660
            })
            current = current.next
        
        # Get comprehensive system information
        system_info = {
            'platform': platform.platform(),
            'python_version': platform.python_version(),
            'hidapi_module': str(hidapi.__file__ if hasattr(hidapi, '__file__') else 'unknown'),
            'container_id': os.environ.get('HOSTNAME', 'unknown'),
            'user_id': os.getuid() if hasattr(os, 'getuid') else 'unknown',
            'groups': [str(g) for g in os.getgroups()] if hasattr(os, 'getgroups') else [],
            'dev_readable': os.access('/dev', os.R_OK),
            'dev_writable': os.access('/dev', os.W_OK),
            'is_docker': os.path.exists('/.dockerenv'),
            'is_privileged': os.access('/proc/1/cgroup', os.R_OK)
        }
        
        # Check USB-related paths
        usb_paths = {
            'hidraw_devices': len(glob.glob('/dev/hidraw*')),
            'usb_devices': len(glob.glob('/dev/usb/*')),
            'proc_usb': len(glob.glob('/proc/bus/usb/*')),
            'sys_usb': len(glob.glob('/sys/bus/usb/devices/*'))
        }
        
        # Check permissions on key directories
        permissions = {}
        for path in ['/dev', '/dev/hidraw0', '/proc/bus/usb', '/sys/bus/usb']:
            try:
                if os.path.exists(path):
                    stat = os.stat(path)
                    permissions[path] = f"mode: {oct(stat.st_mode)}, uid: {stat.st_uid}, gid: {stat.st_gid}"
                else:
                    permissions[path] = "does not exist"
            except Exception as e:
                permissions[path] = f"error: {e}"
        
        emotiv_devices = [d for d in devices if d['is_emotiv']]
        
        return jsonify({
            'success': True,
            'hid_devices': devices,
            'emotiv_devices': emotiv_devices,
            'total_devices': len(devices),
            'emotiv_count': len(emotiv_devices),
            'system_info': system_info,
            'usb_paths': usb_paths,
            'permissions': permissions,
            'environment_vars': {
                'AUTO_DETECT_HARDWARE': os.environ.get('AUTO_DETECT_HARDWARE'),
                'FLASK_ENV': os.environ.get('FLASK_ENV'),
                'PATH': os.environ.get('PATH', '')[:200] + '...' if len(os.environ.get('PATH', '')) > 200 else os.environ.get('PATH', '')
            }
        })
        
    except Exception as e:
        logger.error(f"Debug HID error: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

@app.route('/api/debug/usb')
# Allowing for debugging without auth for now
# @require_auth
def api_debug_usb():
    """Debug USB device status"""
    try:
        from devices.emotiv.usb_interface import USBInterface
        
        usb_interface = USBInterface()
        devices = usb_interface.scan_devices()
        
        # If we have a connected device, check its status
        device_status = None
        if devices:
            try:
                # Try to connect to the first device to check status
                if usb_interface.connect(devices[0].get('serial_number')):
                    device_status = usb_interface.check_device_status()
                    usb_interface.disconnect()
            except Exception as e:
                device_status = {'error': str(e)}
        
        return jsonify({
            'usb_devices': devices,
            'total_devices': len(devices),
            'device_status': device_status
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/debug/pieeg')
# Allowing for debugging without auth for now
# @require_auth
def api_debug_pieeg():
    """Debug PiEEG device status and SPI/GPIO"""
    try:
        import spidev
        from RPi import GPIO
        import os
        
        # Check SPI devices
        spi_devices = []
        for bus in range(2):
            for device in range(2):
                try:
                    spi = spidev.SpiDev()
                    spi.open(bus, device)
                    spi.close()
                    spi_devices.append(f"spidev{bus}.{device}")
                except Exception as e:
                    spi_devices.append(f"spidev{bus}.{device}: Error - {e}")
        
        # Check GPIO pin 37 (the actual PiEEG DRDY pin)
        gpio_status = {}
        try:
            # Check if PiEEG is currently streaming to avoid interference
            device_manager = app_state.get('device_manager')
            pieeg_streaming = False
            if device_manager:
                devices = device_manager.get_devices()
                for device_id, device in devices.items():
                    if hasattr(device, 'device_model') and 'pieeg' in device.device_model.lower():
                        if hasattr(device, 'is_streaming') and device.is_streaming:
                            pieeg_streaming = True
                            break
            
            # Always skip GPIO operations if any PiEEG device exists to avoid interference
            if not pieeg_streaming and not device_manager:
                GPIO.setwarnings(False)
                GPIO.setmode(GPIO.BOARD)
                GPIO.setup(37, GPIO.IN)  # Use pin 37 (actual PiEEG pin)
                gpio_status['pin_37'] = GPIO.input(37)
                GPIO.cleanup()
            else:
                gpio_status['pin_37'] = "Skipped - PiEEG device exists or streaming active"
        except Exception as e:
            gpio_status['pin_37'] = f"Error - {e}"
        
        # Test ADS1299 communication
        ads1299_status = {}
        try:
            spi = spidev.SpiDev()
            spi.open(0, 0)
            spi.max_speed_hz = 600000
            spi.mode = 1
            
            # Try to read device ID
            read_cmd = 0x20 | 0x00
            data = [read_cmd, 0x00, 0x00]
            result = spi.xfer(data)
            ads1299_status['device_id'] = result
            ads1299_status['device_id_hex'] = [f"0x{x:02X}" for x in result]
            
            spi.close()
        except Exception as e:
            ads1299_status['error'] = str(e)
        
        # Check system info
        system_info = {
            'platform': os.uname() if hasattr(os, 'uname') else 'unknown',
            'spi_enabled': os.path.exists('/dev/spidev0.0'),
            'gpio_available': os.path.exists('/sys/class/gpio'),
            'user_id': os.getuid() if hasattr(os, 'getuid') else 'unknown',
            'groups': [str(g) for g in os.getgroups()] if hasattr(os, 'getgroups') else []
        }
        
        return jsonify({
            'success': True,
            'spi_devices': spi_devices,
            'gpio_status': gpio_status,
            'ads1299_status': ads1299_status,
            'system_info': system_info
        })
        
    except Exception as e:
        logger.error(f"Debug PiEEG error: {e}")
        import traceback
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

@app.route('/api/debug/device-status')
@require_auth
def api_debug_device_status():
    """Debug device status"""
    try:
        device_manager = app_state.get('device_manager')
        if not device_manager:
            return jsonify({'error': 'Device manager not initialized'}), 500
        
        devices = device_manager.get_devices()
        status_info = {}
        
        for device_id, device in devices.items():
            if hasattr(device, 'check_device_status'):
                status_info[device_id] = device.check_device_status()
            else:
                status_info[device_id] = {
                    'device_id': device_id,
                    'is_connected': device.is_connected if hasattr(device, 'is_connected') else False,
                    'is_streaming': device.is_streaming if hasattr(device, 'is_streaming') else False
                }
        
        return jsonify({
            'total_devices': len(devices),
            'devices': status_info,
            'app_state': {
                'device_manager_initialized': device_manager is not None,
                'tunnel_url': app_state.get('tunnel_url'),
                'server_device_id': app_state.get('server_device_id')
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/debug/activate-device/<device_id>')
@require_auth
def api_debug_activate_device(device_id):
    """Try to activate a specific device"""
    try:
        device_manager = app_state.get('device_manager')
        if not device_manager:
            return jsonify({'error': 'Device manager not initialized'}), 500
        
        device = device_manager.get_device(device_id)
        if not device:
            return jsonify({'error': f'Device {device_id} not found'}), 404
        
        if hasattr(device, 'activate_device'):
            success = device.activate_device()
            return jsonify({
                'device_id': device_id,
                'activation_success': success,
                'status': device.check_device_status() if hasattr(device, 'check_device_status') else {}
            })
        else:
            return jsonify({'error': 'Device does not support activation'}), 400
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'version': '1.0.0',
        'tunnel_url': app_state.get('tunnel_url'),
        'registered': app_state.get('registered', False)
    })

@app.route('/favicon.ico')
def favicon():
    """Redirect favicon.ico requests to favicon.png"""
    return redirect(url_for('static', filename='favicon.png'))

# WebSocket events
@socketio.on('connect')
def handle_connect():
    """Handle WebSocket connection"""
    logger.info(f"WebSocket client connected: {request.sid}")
    emit('connected', {'status': 'Connected to Universal Agent'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnection"""
    logger.info(f"WebSocket client disconnected: {request.sid}")

@socketio.on('start_streaming')
def handle_start_streaming(data):
    """Handle start streaming command from server"""
    try:
        logger.info(f"Received start_streaming command: {data}")
        
        if not app_state['registered']:
            emit('streaming_error', {'error': 'Device not registered'})
            return
        
        device_id = data.get('device_id')
        device_model = app_state['device_config']['device_model']
        
        # Start device streaming
        result = device_manager.start_streaming(device_model, device_id, socketio)
        
        if result['success']:
            app_state['device_status'] = 'streaming'
            emit('streaming_started', {
                'device_id': device_id,
                'status': 'Streaming started',
                'device_model': device_model
            })
            logger.info(f"Streaming started for device {device_id}")
        else:
            emit('streaming_error', {'error': result['error']})
            logger.error(f"Failed to start streaming: {result['error']}")
            
    except Exception as e:
        logger.error(f"Start streaming error: {e}")
        emit('streaming_error', {'error': str(e)})

@socketio.on('stop_streaming')
def handle_stop_streaming(data):
    """Handle stop streaming command from server"""
    try:
        logger.info(f"Received stop_streaming command: {data}")
        
        device_id = data.get('device_id')
        
        # Stop device streaming
        result = device_manager.stop_streaming(device_id)
        
        if result['success']:
            app_state['device_status'] = 'connected'
            emit('streaming_stopped', {
                'device_id': device_id,
                'status': 'Streaming stopped'
            })
            logger.info(f"Streaming stopped for device {device_id}")
        else:
            emit('streaming_error', {'error': result['error']})
            logger.error(f"Failed to stop streaming: {result['error']}")
            
    except Exception as e:
        logger.error(f"Stop streaming error: {e}")
        emit('streaming_error', {'error': str(e)})

def cleanup():
    """Cleanup resources on shutdown"""
    logger.info("Shutting down Universal Agent...")
    try:
        device_manager.cleanup()
        tunnel_client.stop_tunnel()
    except Exception as e:
        logger.error(f"Cleanup error: {e}")

if __name__ == '__main__':
    try:
        logger.info("Starting MindGarden Universal Agent...")
        try:
            version = getattr(config, 'VERSION', 'dev') if hasattr(config, 'VERSION') else 'dev'
            print(rf"""
███╗   ███╗██╗███╗   ██╗██████╗  ██████╗  █████╗ ██████╗ ██████╗ ███████╗███╗   ██╗     █████╗ ██╗
████╗ ████║██║████╗  ██║██╔══██╗██╔════╝ ██╔══██╗██╔══██╗██╔══██╗██╔════╝████╗  ██║    ██╔══██╗██║
██╔████╔██║██║██╔██╗ ██║██║  ██║██║  ███╗███████║██████╔╝██║  ██║█████╗  ██╔██╗ ██║    ███████║██║
██║╚██╔╝██║██║██║╚██╗██║██║  ██║██║   ██║██╔══██║██╔══██╗██║  ██║██╔══╝  ██║╚██╗██║    ██╔══██║██║
██║ ╚═╝ ██║██║██║ ╚████║██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝███████╗██║ ╚████║    ██║  ██║██║
╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═══╝    ╚═╝  ╚═╝╚═╝


v{version} - We preserve the corpus of human knowledge - we do not rewrite it in our own image.
https://cloud.mindgardenai.com
""")
        except Exception:
            pass
        logger.info(f"Configuration: {config.__class__.__name__}")
        
        # Load saved state
        load_state()
        
        # Always start tunnel on startup for incoming requests
        try:
            logger.info("Starting tunnel for public access...")
            tunnel_url = tunnel_client.start_tunnel(config.PORT)
            app_state['tunnel_url'] = tunnel_url
            save_state()
            logger.info(f"Tunnel established: {tunnel_url}")
            
            # If user is already registered, recreate device instance and update server
            if app_state['registered'] and app_state['auth_token'] and app_state['device_id']:
                try:
                    logger.info("User already registered, recreating device instance and updating server...")
                    
                    # Scan for actual device to get correct serial number
                    device_config = app_state['device_config']
                    device_model = device_config['device_model']
                    
                    if device_model == 'emotiv_epoc_x':
                        # Try to find the actual device
                        from devices.emotiv.usb_interface import USBInterface
                        from devices.emotiv.hid_interface import HIDInterface
                        
                        actual_device_serial = None
                        
                        # Try USB first
                        try:
                            usb_interface = USBInterface()
                            available_devices = usb_interface.scan_devices()
                            if available_devices:
                                actual_device_serial = available_devices[0]['serial_number']
                                logger.info(f"Found actual device via USB: {actual_device_serial}")
                        except Exception as e:
                            logger.debug(f"USB scan failed: {e}")
                        
                        # Try HID if USB failed
                        if not actual_device_serial:
                            try:
                                hid_interface = HIDInterface()
                                available_devices = hid_interface.scan_devices()
                                if available_devices:
                                    actual_device_serial = available_devices[0]['serial_number']
                                    logger.info(f"Found actual device via HID: {actual_device_serial}")
                            except Exception as e:
                                logger.debug(f"HID scan failed: {e}")
                        
                        # Use actual device serial if found, otherwise use stored
                        if actual_device_serial and actual_device_serial != 'Unknown':
                            device_id = actual_device_serial
                            logger.info(f"Using actual device serial: {device_id}")
                        else:
                            device_id = app_state['device_id']
                            logger.info(f"Using stored device ID: {device_id}")
                    else:
                        device_id = app_state['device_id']
                    
                    # Recreate device instance if it doesn't exist
                    if device_id not in device_manager.devices:
                        logger.info(f"Recreating device instance for {device_id}")
                        device_creation_config = {
                            'device_model': device_model,
                            'sample_rate': config.SUPPORTED_DEVICES[device_model]['sample_rate'],
                            'channels': config.SUPPORTED_DEVICES[device_model]['channels'],
                            'device_name': device_config['device_name'],
                            'device_serial': device_id
                        }
                        device_manager.create_device(device_model, device_id, device_creation_config)
                    
                    # Update server with new tunnel URL
                    device_config['device_settings']['tunnel_url'] = tunnel_url
                    
                    registration_result = auth_manager.register_device_with_server(
                        device_config, 
                        app_state['auth_token']
                    )
                    
                    if registration_result['success']:
                        logger.info(f"Updated server with new tunnel URL: {tunnel_url}")
                    else:
                        logger.warning(f"Failed to update server with new tunnel URL: {registration_result['error']}")
                        
                except Exception as e:
                    logger.warning(f"Failed to update server with new tunnel URL: {e}")
                    
        except Exception as e:
            logger.warning(f"Failed to start tunnel on startup: {e}")
            # Continue without tunnel - user can still access via localhost
            app_state['tunnel_url'] = None
            save_state()
        
        # Register cleanup handler
        import atexit
        atexit.register(cleanup)
        
        # Start the server
        logger.info(f"Server starting on {config.HOST}:{config.PORT}")
        socketio.run(app, 
                    host=config.HOST, 
                    port=config.PORT, 
                    debug=config.DEBUG,
                    allow_unsafe_werkzeug=True)
                    
    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
        cleanup()
    except Exception as e:
        logger.error(f"Startup error: {e}")
        sys.exit(1)