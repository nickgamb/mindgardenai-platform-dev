import json
import logging
import requests
import jwt
from typing import Optional, Dict, Any
from fastapi import HTTPException, status, Request
from jwcrypto import jwk
from open_webui.models.users import Users
from open_webui.env import SRC_LOG_LEVELS
import os
import time
from functools import lru_cache

log = logging.getLogger(__name__)
log.setLevel(SRC_LOG_LEVELS["OAUTH"])

# Auth0 configuration - these should be set in environment variables
from open_webui.env import (
    AUTH0_DOMAIN,
    AUTH0_CLIENT_ID,
    AUTH0_API_IDENTIFIER,
    AUTH0_CLIENT_SECRET,
    AUTH0_REDIRECT_URI,
    ENABLE_AUTH0
)

ALGORITHMS = ['RS256']

# Cache for JWKS to avoid repeated HTTP calls
_jwks_cache = {}
_jwks_cache_time = 0
JWKS_CACHE_DURATION = 3600  # 1 hour cache

def get_auth0_config():
    """Get Auth0 configuration from environment variables."""
    return {
        "AUTH0_DOMAIN": AUTH0_DOMAIN,
        "JWKS_URL": f'https://{AUTH0_DOMAIN}/.well-known/jwks.json',
        "CLIENT_ID": AUTH0_CLIENT_ID,
        "API_IDENTIFIER": AUTH0_API_IDENTIFIER,
    }

def get_jwks():
    """Fetch the JWKS keys from Auth0 with caching."""
    global _jwks_cache, _jwks_cache_time
    
    current_time = time.time()
    
    # Return cached JWKS if still valid
    if _jwks_cache and (current_time - _jwks_cache_time) < JWKS_CACHE_DURATION:
        log.debug("Using cached JWKS")
        return _jwks_cache
    
    config = get_auth0_config()
    try:
        log.info("Fetching fresh JWKS from Auth0")
        response = requests.get(config['JWKS_URL'], timeout=10)
        response.raise_for_status()
        jwks_data = response.json()
        
        # Update cache
        _jwks_cache = jwks_data
        _jwks_cache_time = current_time
        
        log.info("Successfully cached new JWKS")
        return jwks_data
    except Exception as e:
        log.error(f"Failed to fetch JWKS: {e}")
        # If we have cached data, use it even if expired
        if _jwks_cache:
            log.warning("Using expired cached JWKS due to fetch failure")
            return _jwks_cache
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch authentication keys"
        )

def get_signing_key(jwks, kid):
    """Get the signing key from JWKS."""
    for key in jwks['keys']:
        if key['kid'] == kid:
            return key
    raise Exception('Public key not found.')

def get_valid_audiences():
    env_val = os.environ.get('AUTH0_VALID_AUDIENCES')
    if env_val:
        audiences = [aud.strip() for aud in env_val.split(',') if aud.strip()]
        if audiences:
            return audiences
    # Default
    return [
        'https://platform.mindgardenai.com',
        'https://mindgarden.us.auth0.com/userinfo'
    ]

def validate_auth0_token(token: str, request: Request) -> Optional[Dict[str, Any]]:
    """Validate Auth0 JWT token and return payload using local validation."""
    try:
        log.info("Starting Auth0 token validation")
        
        # Get unverified header to extract key ID
        unverified_header = jwt.get_unverified_header(token)
        log.info(f"Unverified header: {unverified_header}")
        
        # Fetch JWKS from Auth0 (with caching)
        jwks = get_jwks()
        signing_key = get_signing_key(jwks, unverified_header['kid'])
        jwk_key = jwk.JWK.from_json(json.dumps(signing_key))
        public_key_pem = jwk_key.export_to_pem()

        # Get the API server's origin for audience validation
        api_origin = str(request.base_url).rstrip('/')

        # Decode the token with full validation
        payload = jwt.decode(
            token,
            public_key_pem,
            algorithms=ALGORITHMS,
            options={"verify_aud": False}  # We'll validate audience manually
        )

        # Log the actual audience from the token
        token_audience = payload.get('aud')
        log.info(f"Actual audience in token: {token_audience}")

        # Acceptable audiences
        valid_audiences = get_valid_audiences()
        log.info(f"Accepting audiences: {valid_audiences}")

        # Verify the audience manually
        if isinstance(token_audience, list):
            if not any(aud in valid_audiences for aud in token_audience):
                log.error(f"Invalid audience. Expected one of: {valid_audiences}, Got: {token_audience}")
                return None
        elif token_audience not in valid_audiences:
            log.error(f"Invalid audience. Expected one of: {valid_audiences}, Got: {token_audience}")
            return None

        log.info(f"Auth0 token decoded and validated successfully using local validation")
        return payload
        
    except jwt.ExpiredSignatureError:
        log.error("Auth0 token has expired")
        return None
    except jwt.InvalidIssuerError:
        log.error("Invalid Auth0 issuer")
        return None
    except jwt.InvalidTokenError as e:
        log.error(f"Invalid Auth0 token: {str(e)}")
        return None
    except Exception as e:
        log.exception(f"Unable to parse Auth0 authentication token: {str(e)}")
        return None

def map_auth0_user_to_local_user(auth0_payload: Dict[str, Any], access_token: str = None, frontend_email: str = None) -> Optional[Users]:
    """Map Auth0 user to local user using JWT payload only - no userinfo calls needed."""
    try:
        # Extract user information from Auth0 token
        auth0_sub = auth0_payload.get('sub')
        auth0_permissions = auth0_payload.get('permissions', [])
        
        # Use email from frontend if provided, otherwise fallback to JWT or generate one
        auth0_email = frontend_email or auth0_payload.get('email')
        if not auth0_email:
            # Create a deterministic email from sub for database requirements
            # Extract unique ID from sub (e.g., "google-oauth2|108556027097413969988" -> "108556027097413969988")
            if '|' in auth0_sub:
                unique_id = auth0_sub.split('|', 1)[1]
            else:
                unique_id = auth0_sub
            auth0_email = f"{unique_id}@mindgardenai.local"
            log.info(f"No real email available, using generated email: {auth0_email}")
        else:
            log.info(f"Using {'frontend-provided' if frontend_email else 'JWT'} email: {auth0_email}")
        
        # Use sub for name if no name provided
        auth0_name = auth0_payload.get('name') or auth0_sub
        
        # Validate required fields
        if not auth0_sub:
            log.error(f"Missing required Auth0 sub: {auth0_sub}")
            return None
        
        log.info(f"Auth0 permissions for user {auth0_sub}: {auth0_permissions}")
        
        # Determine role based on Auth0 permissions - only allow specific roles
        role = None
        if "mindgardenai-admin" in auth0_permissions:
            role = "admin"
            log.info(f"User {auth0_sub} has mindgardenai-admin permission, setting role to admin")
        elif "gnosis-gpt-user" in auth0_permissions:
            role = "user"
            log.info(f"User {auth0_sub} has gnosis-gpt-user permission, setting role to user")
        else:
            log.warning(f"User {auth0_sub} has no recognized permissions: {auth0_permissions}")
            # Don't create account for users without recognized permissions
            return None
        
        # Try to find existing user by Auth0 sub first
        user = Users.get_user_by_oauth_sub(auth0_sub)
        
        if user:
            # Update email if we now have a real email and current email is generated
            if frontend_email and user.email.endswith('@mindgardenai.local'):
                log.info(f"Updating user {user.id} email from generated {user.email} to real {frontend_email}")
                try:
                    # Check if another user already has this email
                    existing_email_user = Users.get_user_by_email(frontend_email)
                    if existing_email_user and existing_email_user.id != user.id:
                        log.warning(f"Cannot update email - {frontend_email} already belongs to user {existing_email_user.id}")
                    else:
                        # Update the user's email using the generic update method
                        updated_user = Users.update_user_by_id(user.id, {"email": frontend_email})
                        if updated_user:
                            user.email = frontend_email  # Update the local object too
                            log.info(f"Successfully updated user {user.id} email to {frontend_email}")
                        else:
                            log.error(f"Failed to update user {user.id} email in database")
                except Exception as e:
                    log.error(f"Failed to update user email: {e}")
        
        if not user:
            # Try to find by email as fallback
            user = Users.get_user_by_email(auth0_email)
            
            if user:
                # Update existing user with Auth0 sub and potentially new role
                Users.update_user_oauth_sub_by_id(user.id, auth0_sub)
                # Update role if it has changed and role is not None
                if role and user.role != role:
                    Users.update_user_role_by_id(user.id, role)
                    log.info(f"Updated user {user.id} role from {user.role} to {role}")
            else:
                # Only create new user if they have a recognized role
                if role is None:
                    log.warning(f"Not creating user account for {auth0_sub} - no recognized permissions")
                    return None
                
                # Create new user
                user_count = Users.get_num_users()
                # Only use "admin" for first user if they don't have mindgardenai-admin permission
                if user_count == 0 and role != "admin":
                    role = "admin"
                    log.info(f"First user created, setting role to admin")
                
                user = Users.insert_new_user(
                    id=auth0_sub,  # Use Auth0 sub as user ID
                    name=auth0_name,
                    email=auth0_email,
                    profile_image_url="/user.png",
                    role=role,
                    oauth_sub=auth0_sub
                )
                
                if not user:
                    log.error(f"Failed to create local user for Auth0 user: {auth0_sub}")
                    return None
        else:
            # Update role if it has changed based on current permissions
            if role and user.role != role:
                Users.update_user_role_by_id(user.id, role)
                log.info(f"Updated existing user {user.id} role from {user.role} to {role}")
        
        # Update user's last active timestamp
        Users.update_user_last_active_by_id(user.id)
        
        return user
        
    except Exception as e:
        log.error(f"Error mapping Auth0 user to local user: {e}")
        return None

def get_auth0_user_from_token(token: str, request: Request, frontend_email: str = None) -> Optional[Users]:
    """Extract and validate Auth0 token using local validation only, then map to local user."""
    try:
        # Validate the Auth0 token using local JWT validation
        auth0_payload = validate_auth0_token(token, request)
        if not auth0_payload:
            return None
        
        # Map to local user using JWT payload only (no userinfo calls)
        user = map_auth0_user_to_local_user(auth0_payload, frontend_email=frontend_email)
        
        if not user:
            log.error("Failed to map Auth0 user to local user")
            return None
        
        # Log the final user information for debugging
        log.info(f"Successfully authenticated Auth0 user using local validation: {user.email} (ID: {user.id}, Role: {user.role})")
        
        return user
        
    except Exception as e:
        log.error(f"Error getting Auth0 user from token: {e}")
        return None 