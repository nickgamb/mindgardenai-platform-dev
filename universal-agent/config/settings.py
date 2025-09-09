# Configuration settings for Universal Agent
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Base configuration"""
    
    # Flask settings
    SECRET_KEY = os.environ.get('SECRET_KEY', 'mindgarden-universal-agent-dev-key-2024')
    FLASK_ENV = os.environ.get('FLASK_ENV', 'development')
    DEBUG = os.environ.get('DEBUG', 'true').lower() == 'true'
    
    # Server settings
    HOST = os.environ.get('HOST', '0.0.0.0')
    PORT = int(os.environ.get('PORT', 5000))
    
    # MindGarden API settings
    MINDGARDEN_API_BASE = os.environ.get('MINDGARDEN_API_BASE', 'https://api.example.com')
    MINDGARDEN_AUTH_BASE = os.environ.get('MINDGARDEN_AUTH_BASE', 'https://auth.example.com')
    
    # Auth0 settings
    AUTH0_DOMAIN = os.environ.get('AUTH0_DOMAIN', 'auth.example.com')
    AUTH0_CLIENT_ID = os.environ.get('AUTH0_CLIENT_ID', '')
    AUTH0_CLIENT_SECRET = os.environ.get('AUTH0_CLIENT_SECRET', '')
    AUTH0_AUDIENCE = os.environ.get('AUTH0_AUDIENCE', 'https://api.example.com')
    
    # Note: Agent security now uses JWT validation only
    
    # Device settings
    SUPPORTED_DEVICES = {
        'pieeg_8': {
            'name': 'PiEEG 8 Channel',
            'channels': 8,
            'sample_rate': 250,
            'connection_type': 'spi'
        },
        'pieeg_16': {
            'name': 'PiEEG 16 Channel',
            'channels': 16,
            'sample_rate': 250,
            'connection_type': 'spi'
        },
        'emotiv_epoc_x': {
            'name': 'EMOTIV EPOC X',
            'channels': 14,
            'sample_rate': 128,
            'connection_type': 'hid_bluetooth'
        },
        'idun_guardian': {
            'name': 'IDUN Guardian',
            'channels': 1,
            'sample_rate': 250,
            'connection_type': 'bluetooth_le'
        }
    }
    
    # Storage paths
    DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
    CONFIG_FILE = os.path.join(DATA_DIR, 'device_config.json')
    TOKEN_FILE = os.path.join(DATA_DIR, 'tokens.json')
    LOG_DIR = os.path.join(DATA_DIR, 'logs')
    
    # WebSocket settings
    WEBSOCKET_PING_TIMEOUT = 60
    WEBSOCKET_PING_INTERVAL = 25
    
    # Device communication timeouts
    DEVICE_CONNECT_TIMEOUT = 30
    DEVICE_STREAM_TIMEOUT = 5
    
    # Data streaming settings
    BUFFER_SIZE = 1000
    MAX_RECONNECT_ATTEMPTS = 5
    RECONNECT_DELAY = 5
    
    @classmethod
    def init_directories(cls):
        """Create necessary directories if they don't exist"""
        import os
        os.makedirs(cls.DATA_DIR, exist_ok=True)
        os.makedirs(cls.LOG_DIR, exist_ok=True)

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    
class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False

class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    DEBUG = True

# Configuration mapping
config_map = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}

def get_config():
    """Get the appropriate configuration"""
    env = os.environ.get('FLASK_ENV', 'development')
    return config_map.get(env, DevelopmentConfig)