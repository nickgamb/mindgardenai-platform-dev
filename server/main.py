import eventlet
eventlet.monkey_patch()

import os
import logging
import redis
from flask import Flask, jsonify, request
from flask_socketio import SocketIO
from flask_cors import CORS
from routes.routes import setup_routes
from flask_session import Session
from services.auth import requires_auth
from dotenv import load_dotenv
from pathlib import Path
from services.database import init_db, DB_FILE
from time import strftime
import traceback

# Load environment variables from .env file
# Try multiple locations to ensure .env file is found
load_dotenv()  # Current directory
load_dotenv(Path(__file__).parent / '.env')  # Same directory as this file

# Get the client origin from environment variable
CLIENT_ORIGIN = os.getenv('CLIENT_ORIGIN', 'http://localhost:3000')
VERSION = os.getenv('VERSION', '0.0.1')

# Configure logging
logging_level = os.getenv('LOG_LEVEL', 'INFO').upper()
logging.basicConfig(level=getattr(logging, logging_level, logging.INFO))

app = Flask(__name__)
CORS(app, 
     supports_credentials=True, 
     origins=[CLIENT_ORIGIN], 
     allow_headers=["Content-Type", "Authorization", "X-User-Email"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# Configuration
app.secret_key = os.getenv('FLASK_SECRET_KEY')
if not app.secret_key:
    raise ValueError("FLASK_SECRET_KEY is not set. This is required for session management.")

app.config['SESSION_TYPE'] = os.getenv('FLASK_SESSION_TYPE', 'filesystem')
if os.getenv('FLASK_SESSION_REDIS_URL'):
    app.config['SESSION_REDIS'] = redis.from_url(os.getenv('FLASK_SESSION_REDIS_URL'))

# Production mgflow considerations
if os.getenv('RENDER'):  # Render sets this environment variable
    app.config['SESSION_COOKIE_SECURE'] = True
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'None'
else:
    # Development settings
    app.config['SESSION_COOKIE_SECURE'] = False
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# Auth0 configuration
app.config['AUTH0_DOMAIN'] = os.getenv('AUTH0_DOMAIN')
app.config['AUTH0_CLIENT_ID'] = os.getenv('AUTH0_CLIENT_ID')
app.config['AUTH0_CLIENT_SECRET'] = os.getenv('AUTH0_CLIENT_SECRET')
app.config['AUTH0_REDIRECT_URI'] = os.getenv('AUTH0_REDIRECT_URI')
app.config['AUTH0_API_IDENTIFIER'] = os.getenv('AUTH0_API_IDENTIFIER')
app.config['AUTH0_MGMT_CLIENT_ID'] = os.getenv('AUTH0_MGMT_CLIENT_ID')
app.config['AUTH0_MGMT_CLIENT_SECRET'] = os.getenv('AUTH0_MGMT_CLIENT_SECRET')

if not all([app.config['AUTH0_CLIENT_ID'], app.config['AUTH0_CLIENT_SECRET'], app.config['AUTH0_REDIRECT_URI']]):
    raise ValueError("AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, and AUTH0_REDIRECT_URI must be set for Auth0 integration.")

Session(app)

# Initialize SocketIO with production-ready configuration
print(f"🌐 Configuring SocketIO with CORS for: {CLIENT_ORIGIN}")
socketio = SocketIO(
    app, 
    cors_allowed_origins=[CLIENT_ORIGIN],
    async_mode='eventlet',
    logger=True,
    engineio_logger=True,
    ping_timeout=60,
    ping_interval=25,
    allow_upgrades=True,
    transports=['websocket', 'polling']
)

# Set up routes for API mode
setup_routes(app, socketio)

# Initialize mgflow assistant settings
mgflow_settings = {
    'max_concurrent_flows': 5,
    'default_timeout': 300,
    'enable_logging': True
}

init_db()

@app.route('/api/health')
def health_check():
    """API health check endpoint."""
    return jsonify({
        "status": "healthy", 
        "cors_origin": CLIENT_ORIGIN,
        "environment": "production" if os.getenv('RENDER') else "development"
    }), 200

# Handle preflight OPTIONS requests explicitly
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = jsonify()
        response.headers.add("Access-Control-Allow-Origin", CLIENT_ORIGIN)
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-Email")
        response.headers.add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        response.headers.add("Access-Control-Allow-Credentials", "true")
        return response

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = CLIENT_ORIGIN
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-User-Email'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    timestamp = strftime('[%Y-%b-%d %H:%M]')
    logging.getLogger('api').info('%s %s %s %s %s %s', timestamp, request.remote_addr, request.method, request.scheme, request.full_path, response.status)
    return response

# Enhanced error handler for debugging
@app.errorhandler(405)
def method_not_allowed(error):
    print(f"❌ 405 Method Not Allowed: {request.method} {request.path}")
    print(f"Available methods: {request.routing_exception}")
    return jsonify({
        "error": "Method not allowed",
        "method": request.method,
        "path": request.path,
        "message": "The requested method is not allowed for this endpoint"
    }), 405

# logging
'''
@app.errorhandler(Exception)
def exceptions(e):
    tb = traceback.format_exc()
    timestamp = strftime('[%Y-%b-%d %H:%M]')
    logging.getLogger('api').error('%s %s %s %s %s 5xx INTERNAL SERVER ERROR\n%s', timestamp, request.remote_addr, request.method, request.scheme, request.full_path, tb)
    return e.status_code
'''

def delete_and_reinit_db():
    if os.path.exists(DB_FILE):
        try:
            os.remove(DB_FILE)
            print("Existing database deleted.")
        except PermissionError:
            print("Unable to delete database. It may be in use. Please close all connections and try again.")
            return
    else:
        print("No existing database found.")

    init_db()
    print("Database reinitialized.")

# Uncomment the following line to delete and reinitialize the database
# delete_and_reinit_db()

if __name__ == '__main__':
    # Initialize mgflow flow tracking
    running_flows = {}
    active_mgflows = []
    
    # Get port from environment (Render sets PORT)
    port = int(os.getenv('PORT', 5000))
    host = '0.0.0.0'
    
    # Startup banner
    print(
        rf"""
███╗   ███╗██╗███╗   ██╗██████╗  ██████╗  █████╗ ██████╗ ██████╗ ███████╗███╗   ██╗     █████╗ ██╗
████╗ ████║██║████╗  ██║██╔══██╗██╔════╝ ██╔══██╗██╔══██╗██╔══██╗██╔════╝████╗  ██║    ██╔══██╗██║
██╔████╔██║██║██╔██╗ ██║██║  ██║██║  ███╗███████║██████╔╝██║  ██║█████╗  ██╔██╗ ██║    ███████║██║
██║╚██╔╝██║██║██║╚██╗██║██║  ██║██║   ██║██╔══██║██╔══██╗██║  ██║██╔══╝  ██║╚██╗██║    ██╔══██║██║
██║ ╚═╝ ██║██║██║ ╚████║██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝███████╗██║ ╚████║    ██║  ██║██║
╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═══╝    ╚═╝  ╚═╝╚═╝


MindGarden Platform v{VERSION} - We preserve the corpus of human knowledge - we do not rewrite it in our own image.
https://cloud.mindgardenai.com
"""
    )
    
    print("🚀 Starting MindGarden Platform Server...")
    print(f"🌍 Environment: {'Production' if os.getenv('MODE') == 'cloud' else 'Development'}")
    print(f"📡 WebSocket server will accept connections from: {CLIENT_ORIGIN}")
    print(f"🔌 Server will be available at: http://{host}:{port}")
    print(f"⚙️  Max concurrent flows: {mgflow_settings['max_concurrent_flows']}")
    
    socketio.run(app, host=host, port=port, allow_unsafe_werkzeug=True)
