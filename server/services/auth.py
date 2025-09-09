import json
import requests
from functools import wraps
from flask import request, jsonify, current_app, redirect, url_for, session
from jwcrypto import jwk
import jwt
import logging
from urllib.parse import urlencode
from datetime import datetime, timedelta
from jwcrypto import jwt as jwcrypto_jwt
from utils.auth0_utils import logout_user_by_email, logout_user_by_id
import hashlib
import time

ALGORITHMS = ['RS256']

# In-memory cache for userinfo to reduce Auth0 API calls
USER_INFO_CACHE = {}
CACHE_DURATION = 300  # 5 minutes in seconds

# TODO: This is hardcoded and needs to be pulled from the routes automatically
ALL_PERMISSIONS = [
    "devices:get",
    "devices:post",
    "devices:put",
    "devices:delete",
    "devices:calibrate",
    "devices:connect",
    "devices:disconnect",
    "devices:update_settings",
    "devices:start_analysis",
    "devices:stop_analysis",
    "experiments:get",
    "experiments:post",
    "experiments:put",
    "experiments:delete",
    "experiments:run",
    "filters:get",
    "filters:post",
    "filters:put",
    "filters:delete",
    "models:get",
    "models:post",
    "models:put",
    "models:delete",
    "participants:get",
    "participants:post",
    "participants:put",
    "participants:delete",
    "settings:get",
    "settings:put",
    "status:get",
    "storage:get",
    "storage:post",
    "storage:put",
    "storage:delete",
    "studies:get",
    "studies:post",
    "studies:put",
    "studies:delete",
    "analytics:get",
    "analytics:post",
    "analytics:put",
    "analytics:delete",
    "data:export",
    "user:get",
    "openapi:get",
    "eeg-socket:connect",
    "eeg-socket:disconnect",
    "eeg-socket:start_streaming",
    "eeg-socket:stop_streaming",
    "eeg-socket:start_pieeg_streaming",
    "eeg-socket:stop_pieeg_streaming",
    "eeg-socket:set_file_path"
]

def get_auth_config():
    """Retrieve the Auth0 configuration from the Flask app context."""
    config = current_app.config
    return {
        "AUTH0_DOMAIN": config['AUTH0_DOMAIN'],
        "JWKS_URL": f'https://{config["AUTH0_DOMAIN"]}/.well-known/jwks.json',
        "CLIENT_ID": config['AUTH0_CLIENT_ID'],
        "CLIENT_SECRET": config['AUTH0_CLIENT_SECRET'],
        "CALLBACK_URL": config['AUTH0_REDIRECT_URI'],
    }

def get_valid_audiences():
    """Get list of valid audiences for token validation (ai-core style)."""
    config = get_auth_config()
    return [
        f"https://{config['AUTH0_DOMAIN']}/api/v2/",
        f"https://{config['AUTH0_DOMAIN']}/userinfo",
        "https://mindgarden.us.auth0.com/userinfo",
        config['CLIENT_ID']  # Accept client ID as audience too (common for JWT tokens)
    ]

def get_jwks():
    """Fetch the JWKS keys from Auth0."""
    config = get_auth_config()
    response = requests.get(config['JWKS_URL'])
    response.raise_for_status()
    return response.json()

def get_signing_key(jwks, kid):
    """Get the signing key from JWKS."""
    for key in jwks['keys']:
        if key['kid'] == kid:
            return key
    raise Exception('Public key not found.')

def get_auth0_user_from_token(token, frontend_email=None):
    """Extract and validate Auth0 token using local validation only, then extract user info (ai-core style)."""
    try:
        # Validate the Auth0 token using local JWT validation
        auth0_payload = validate_auth0_token(token)
        if not auth0_payload:
            return None
        
        # Extract user info from JWT payload only (no userinfo calls)
        user_info = extract_user_info_from_jwt(auth0_payload, frontend_email=frontend_email)
        
        if not user_info:
            logging.error("Failed to extract user info from Auth0 token")
            return None
        
        # Log the final user information for debugging
        logging.info(f"Successfully authenticated Auth0 user using local validation: {user_info.get('email')} (Sub: {user_info.get('sub')})")
        
        return user_info
        
    except Exception as e:
        logging.error(f"Error getting Auth0 user from token: {e}")
        return None

def requires_auth(f):
    """Decorator to enforce authentication via Bearer token with userinfo fallback."""
    @wraps(f)
    def decorated(*args, **kwargs):
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization', None)
        if not auth_header:
            return jsonify({"message": "Missing authorization header"}), 401

        try:
            token = auth_header.split()[1]
            logging.info("Attempting Auth0 token validation")
            
            user_info = None
            
            # Try JWT validation first (works for JWT tokens)
            try:
                payload = validate_auth0_token(token)
                if payload:
                    # Extract email from frontend if provided via custom header
                    frontend_email = request.headers.get('X-User-Email')
                    user_info = extract_user_info_from_jwt(payload, frontend_email)
                    logging.info("Successfully validated JWT token locally")
            except Exception as e:
                logging.info(f"JWT validation failed, trying userinfo fallback: {e}")
            
            # Fallback to userinfo endpoint only as last resort (works for JWE tokens)
            if not user_info:
                try:
                    # Log that we're falling back to userinfo (helps identify if this happens too often)
                    logging.warning("JWT validation failed, falling back to userinfo API call")
                    user_info = get_user_info(token)
                    logging.info("Successfully validated token via userinfo endpoint (cached)")
                except Exception as e:
                    logging.error(f"Userinfo validation also failed: {e}")
                    return jsonify({"message": "Invalid Auth0 token"}), 401
            
            if not user_info:
                return jsonify({"message": "Unable to validate token"}), 401
            
            # Store user info in request for access in the route
            request.current_user = user_info
            
            # Also store in session for compatibility with existing code
            session['user'] = user_info
            
        except IndexError:
            return jsonify({"message": "Invalid authorization header format"}), 401
        except Exception as e:
            logging.error(f"Authentication error: {e}")
            return jsonify({"message": "Authentication error"}), 401

        return f(*args, **kwargs)
    return decorated

def login():
    """Redirect to Auth0 login page."""
    config = get_auth_config()
    params = {
        'response_type': 'code',
        'client_id': config['CLIENT_ID'],
        'redirect_uri': config['CALLBACK_URL'],
        'scope': 'openid profile email'
        # Remove audience parameter to get regular JWT tokens instead of JWE
    }
    auth_url = f"https://{config['AUTH0_DOMAIN']}/authorize?{urlencode(params)}"
    return redirect(auth_url)

def callback():
    """Handle Auth0 callback after successful authentication."""
    code = request.args.get('code')
    
    if not code:
        return jsonify({"error": "No authorization code provided"}), 400

    try:
        # Get Auth0 configuration
        auth0_domain = current_app.config.get('AUTH0_DOMAIN')
        auth0_client_id = current_app.config.get('AUTH0_CLIENT_ID')
        auth0_client_secret = current_app.config.get('AUTH0_CLIENT_SECRET')
        auth0_redirect_uri = current_app.config.get('AUTH0_REDIRECT_URI')

        # Check if all required configuration is present
        if not all([auth0_domain, auth0_client_id, auth0_client_secret, auth0_redirect_uri]):
            logging.error("Missing Auth0 configuration")
            return jsonify({"error": "Server configuration error"}), 500

        # Exchange the authorization code for an access token
        token_payload = {
            'grant_type': 'authorization_code',
            'client_id': auth0_client_id,
            'client_secret': auth0_client_secret,
            'code': code,
            'redirect_uri': auth0_redirect_uri
        }
        token_url = f"https://{auth0_domain}/oauth/token"
        token_response = requests.post(token_url, json=token_payload)
        token_data = token_response.json()

        if 'access_token' not in token_data:
            logging.error(f"Failed to obtain access token: {token_data}")
            return jsonify({"error": "Failed to obtain access token"}), 500

        # Store tokens in session
        session['access_token'] = token_data['access_token']
        if 'id_token' in token_data:
            session['id_token'] = token_data['id_token']
        if 'refresh_token' in token_data:
            session['refresh_token'] = token_data['refresh_token']
        if 'expires_in' in token_data:
            session['expires_at'] = datetime.now() + timedelta(seconds=token_data['expires_in'])

        # Extract user info from JWT and store it in the session (no API call)
        try:
            payload = validate_token(token_data['access_token'])
            if payload:
                # Get email from frontend if provided via custom header
                frontend_email = request.headers.get('X-User-Email')
                user_info = extract_user_info_from_jwt(payload, frontend_email)
                session['user'] = user_info
                logging.info(f"User info extracted from JWT during callback: {user_info}")
            else:
                # Fallback to userinfo if JWT validation fails (cached)
                logging.warning("Callback: JWT validation failed, falling back to userinfo API call")
                user_info = get_user_info(token_data['access_token'])
                session['user'] = user_info
                logging.info("Used cached userinfo fallback during callback")
        except Exception as e:
            logging.error(f"Failed to extract user info from JWT during callback: {e}")
            # Last resort fallback (cached)
            logging.warning("Callback: Exception occurred, using userinfo API as last resort")
            user_info = get_user_info(token_data['access_token'])
            session['user'] = user_info

        # Log the session contents for debugging
        logging.info(f"Session after callback: {session}")

        return jsonify({"access_token": token_data['access_token'], "user": user_info})

    except Exception as e:
        logging.error(f"Error in callback: {str(e)}")
        return jsonify({"error": "Authentication failed"}), 500

def logout():
    """Handle logout request."""
    token = get_token_from_auth_header()
    
    if not token:
        return jsonify({"error": "Missing access token"}), 401

    try:
        payload = validate_token(token)
        if not payload:
            return jsonify({"error": "Invalid token"}), 401

        # Attempt universal logout operations, but continue regardless of outcome
        try:
            if 'email' in payload:
                logout_user_by_email(payload['email'])
            elif 'sub' in payload:
                logout_user_by_id(payload['iss'], payload['sub'])
        except Exception as e:
            logging.warning(f"Universal logout operation failed: {str(e)}")

        # Clear the session
        session.clear()

        # Attempt to revoke the token on Auth0
        try:
            config = get_auth_config()
            revoke_url = f"https://{config['AUTH0_DOMAIN']}/v2/revoke"
            headers = {
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json'
            }
            requests.post(revoke_url, headers=headers, timeout=5)  # Add a timeout
        except requests.exceptions.RequestException as e:
            logging.warning(f"Error revoking token: {str(e)}")

        return jsonify({"message": "Logged out successfully."}), 200

    except Exception as e:
        logging.error(f"Error during logout: {str(e)}")
        return jsonify({"error": "An error occurred during logout"}), 500

def get_token_from_auth_header():
    """Obtain the Access Token from the Authorization Header."""
    auth = request.headers.get("Authorization", None)
    if not auth:
        return None

    parts = auth.split()
    if parts[0].lower() != "bearer":
        return None
    elif len(parts) == 1:
        return None
    elif len(parts) > 2:
        return None

    return parts[1]

def validate_auth0_token(token):
    """Validate Auth0 JWT token and return payload using local validation (ai-core style)."""
    try:
        logging.info("Starting Auth0 token validation")
        
        # Get unverified header to extract key ID
        unverified_header = jwt.get_unverified_header(token)
        logging.info(f"Unverified header: {unverified_header}")
        
        # Fetch JWKS from Auth0 (with caching)
        jwks = get_jwks()
        signing_key = get_signing_key(jwks, unverified_header['kid'])
        jwk_key = jwk.JWK.from_json(json.dumps(signing_key))
        public_key_pem = jwk_key.export_to_pem()

        # Decode the token with full validation
        payload = jwt.decode(
            token,
            public_key_pem,
            algorithms=ALGORITHMS,
            options={"verify_aud": False}  # We'll validate audience manually
        )

        # Log the actual audience from the token
        token_audience = payload.get('aud')
        logging.info(f"Actual audience in token: {token_audience}")

        # Acceptable audiences (ai-core style)
        valid_audiences = get_valid_audiences()
        logging.info(f"Accepting audiences: {valid_audiences}")

        # Verify the audience manually
        if isinstance(token_audience, list):
            if not any(aud in valid_audiences for aud in token_audience):
                logging.error(f"Invalid audience. Expected one of: {valid_audiences}, Got: {token_audience}")
                return None
        elif token_audience not in valid_audiences:
            logging.error(f"Invalid audience. Expected one of: {valid_audiences}, Got: {token_audience}")
            return None

        logging.info(f"Auth0 token decoded and validated successfully using local validation")
        return payload
        
    except jwt.ExpiredSignatureError:
        logging.error("Auth0 token has expired")
        return None
    except jwt.InvalidIssuerError:
        logging.error("Invalid Auth0 issuer")
        return None
    except jwt.InvalidTokenError as e:
        logging.error(f"Invalid Auth0 token: {str(e)}")
        return None
    except Exception as e:
        logging.exception(f"Unable to parse Auth0 authentication token: {str(e)}")
        return None

# Keep validate_token as alias for backwards compatibility
def validate_token(token):
    """Validate token - delegates to Auth0 validation."""
    return validate_auth0_token(token)

def extract_user_info_from_jwt(payload, frontend_email=None):
    """Extract user info from JWT payload locally (no API calls)."""
    auth0_sub = payload.get('sub')
    auth0_permissions = payload.get('permissions', [])
    
    # Use email from frontend if provided, otherwise fallback to JWT or generate one
    auth0_email = frontend_email or payload.get('email')
    if not auth0_email:
        # Generate email if not in JWT (common for Google OAuth)
        if auth0_sub and '|' in auth0_sub:
            unique_id = auth0_sub.split('|', 1)[1]
        else:
            unique_id = auth0_sub
        auth0_email = f"{unique_id}@mindgardenai.local"
        logging.info(f"No real email available, using generated email: {auth0_email}")
    else:
        logging.info(f"Using {'frontend-provided' if frontend_email else 'JWT'} email: {auth0_email}")
    
    # Use sub for name if no name provided
    auth0_name = payload.get('name') or auth0_sub
    
    # Return user info in the same format as Auth0 userinfo for compatibility
    user_info = {
        'sub': auth0_sub,
        'email': auth0_email,
        'name': auth0_name or auth0_sub,
        'permissions': auth0_permissions
    }
    
    logging.info(f"Extracted user info from JWT locally: {user_info}")
    return user_info

def _generate_cache_key(access_token):
    """Generate a cache key from the access token."""
    return hashlib.sha256(access_token.encode()).hexdigest()[:16]

def _is_cache_valid(cache_entry):
    """Check if a cache entry is still valid."""
    return time.time() - cache_entry['timestamp'] < CACHE_DURATION

def _cleanup_expired_cache():
    """Remove expired entries from the cache."""
    current_time = time.time()
    expired_keys = [
        key for key, entry in USER_INFO_CACHE.items() 
        if current_time - entry['timestamp'] >= CACHE_DURATION
    ]
    for key in expired_keys:
        del USER_INFO_CACHE[key]

def clear_user_info_cache():
    """Clear the entire user info cache (useful for debugging)."""
    global USER_INFO_CACHE
    cache_size = len(USER_INFO_CACHE)
    USER_INFO_CACHE.clear()
    logging.info(f"Cleared user info cache, removed {cache_size} entries")

def get_user_info(access_token):
    """Fetch user info from Auth0 with caching to reduce API calls."""
    # Generate cache key
    cache_key = _generate_cache_key(access_token)
    
    # Check cache first
    if cache_key in USER_INFO_CACHE:
        cache_entry = USER_INFO_CACHE[cache_key]
        if _is_cache_valid(cache_entry):
            logging.info(f"Using cached user info for key {cache_key}")
            return cache_entry['data']
        else:
            # Remove expired entry
            del USER_INFO_CACHE[cache_key]
    
    # Clean up expired entries periodically
    _cleanup_expired_cache()
    
    # Make the API call if not in cache or expired
    try:
        config = get_auth_config()
        user_info_url = f"https://{config['AUTH0_DOMAIN']}/userinfo"
        headers = {'Authorization': f'Bearer {access_token}'}
        
        logging.info(f"Making userinfo API call for cache key {cache_key}")
        response = requests.get(user_info_url, headers=headers)
        response.raise_for_status()
        user_data = response.json()
        
        # Cache the result
        USER_INFO_CACHE[cache_key] = {
            'data': user_data,
            'timestamp': time.time()
        }
        
        logging.info(f"Cached user info for key {cache_key}, cache size: {len(USER_INFO_CACHE)}")
        return user_data
        
    except Exception as e:
        logging.error(f"Error fetching user info from Auth0: {e}")
        raise

def is_token_expired():
    """Check if the current session token is expired."""
    expires_at = session.get('expires_at')
    if not expires_at:
        return True
    return datetime.now() > expires_at

def refresh_token(refresh_token):
    token_url = f"https://{config['AUTH0_DOMAIN']}/oauth/token"
    payload = {
        'grant_type': 'refresh_token',
        'client_id': config['AUTH0_CLIENT_ID'],
        'client_secret': config['AUTH0_CLIENT_SECRET'],
        'refresh_token': refresh_token
    }
    response = requests.post(token_url, json=payload)
    response.raise_for_status()
    new_tokens = response.json()
    return {
        'access_token': new_tokens['access_token'],
        'refresh_token': new_tokens.get('refresh_token', refresh_token)
    }

def validate_universal_logout_jwt(auth_header):
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ')[1]
    try:
        config = get_auth_config()
        jwks_url = f"https://{config['AUTH0_DOMAIN']}/.well-known/jwks.json"
        jwks_client = jwt.PyJWKClient(jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=ALGORITHMS,
            audience=config['CLIENT_ID'],
            issuer=f"https://{config['AUTH0_DOMAIN']}/"
        )
        return payload
    except jwt.ExpiredSignatureError:
        logging.error("Token has expired")
    except jwt.InvalidTokenError as e:
        logging.error(f"Invalid token: {str(e)}")
    except Exception as e:
        logging.error(f"Error validating universal logout JWT: {str(e)}")
    return None

def requires_rbac(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Check if user info is already available from @requires_auth decorator
        user_info = getattr(request, 'current_user', None)
        
        if not user_info:
            # Fallback: try to validate token directly if no user info available
            token = get_token_from_auth_header()
            if not token:
                return jsonify({"message": "Missing authorization header"}), 401

            try:
                # Try JWT validation first, fall back to userinfo
                payload = validate_auth0_token(token)
                if payload:
                    frontend_email = request.headers.get('X-User-Email')
                    user_info = extract_user_info_from_jwt(payload, frontend_email)
                else:
                    # Fallback to userinfo for JWE tokens (cached)
                    logging.warning("RBAC: JWT validation failed, falling back to userinfo API call")
                    user_info = get_user_info(token)
                    
                if not user_info:
                    return jsonify({"message": "Invalid token"}), 401
                    
                request.current_user = user_info
            except Exception as e:
                logging.error(f"RBAC token validation failed: {e}")
                return jsonify({"message": "Invalid token"}), 401

        try:

            # Extract namespace from the URL
            if hasattr(request, 'url_rule') and request.url_rule:
                url_parts = request.url_rule.rule.split('/')
                namespace = url_parts[2] if len(url_parts) > 2 else None
            elif hasattr(request, 'event') and hasattr(request, 'namespace'):
                # Handle WebSocket events
                namespace = request.namespace.strip('/')
                method = request.event
                required_permission = f"{namespace}:{method}"
            else:
                return jsonify({"message": "Unable to determine API namespace or WebSocket event"}), 500

            if not namespace:
                return jsonify({"message": "Unable to determine API namespace"}), 500

            # Determine the required permission
            method = request.method.lower()
            required_permission = f"{namespace}:{method}"

            # Check if RBAC is enabled
            enable_rbac = current_app.config.get('ENABLE_RBAC', False)
            
            if not enable_rbac:
                # RBAC disabled - grant access to all authenticated users
                logging.info(f"RBAC disabled - granting access to authenticated user for: {required_permission}")
            else:
                # RBAC enabled - check permissions
                user_permissions = user_info.get('permissions', [])
                logging.info(f"User permissions from Auth0: {user_permissions}")
                logging.info(f"Required permission: {required_permission}")

                # Get the super admin roles from the app config
                super_admin_roles = current_app.config.get('SUPER_ADMIN_ROLES', 'mindgardenai-admin').split(',')
                logging.info(f"Super admin roles: {super_admin_roles}")
                
                # For basic user endpoints, grant access to authenticated users
                basic_permissions = ['user:get', 'status:get', 'openapi:get']
                if required_permission in basic_permissions:
                    logging.info(f"Granting access to basic permission: {required_permission}")
                    # Allow access for basic user operations
                elif required_permission not in user_permissions and not any(role in user_permissions for role in super_admin_roles):
                    logging.warning(f"User lacks required permission: {required_permission} and is not a super admin")
                    return jsonify({"message": "Insufficient permissions"}), 403

        except Exception as e:
            logging.error(f"RBAC error: {e}")
            return jsonify({"message": "Authorization error"}), 401

        return f(*args, **kwargs)
    return decorated
