"""
JWT Authentication Module

Provides JWT token validation using JWKS, aligned with server implementation.
"""

import json
import requests
import jwt
import logging
from functools import wraps
from flask import request, jsonify
from jwcrypto import jwk
from typing import Optional, Dict, Any

logger = logging.getLogger('jwt_auth')

ALGORITHMS = ['RS256']

class JWTValidator:
    """JWT token validator using JWKS caching"""
    
    def __init__(self, config):
        self.config = config
        self.auth0_domain = config.AUTH0_DOMAIN
        self.audience = config.AUTH0_AUDIENCE
        self.jwks_url = f"https://{self.auth0_domain}/.well-known/jwks.json"
        self._jwks_cache = None
        
    def get_jwks(self) -> Dict[str, Any]:
        """Fetch the JWKS keys from Auth0 with caching"""
        if self._jwks_cache is None:
            try:
                response = requests.get(self.jwks_url, timeout=10)
                response.raise_for_status()
                self._jwks_cache = response.json()
                logger.info("JWKS keys fetched and cached")
            except Exception as e:
                logger.error(f"Failed to fetch JWKS: {e}")
                raise
        return self._jwks_cache
    
    def get_signing_key(self, jwks: Dict[str, Any], kid: str) -> Dict[str, Any]:
        """Get the signing key from JWKS"""
        for key in jwks['keys']:
            if key['kid'] == kid:
                return key
        raise Exception(f'Public key not found for kid: {kid}')
    
    def validate_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Validate JWT token and return payload"""
        try:
            logger.debug("Starting token validation")
            
            # Get unverified header to extract kid
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get('kid')
            if not kid:
                logger.error("Token missing kid in header")
                return None
            
            # Get JWKS and signing key
            jwks = self.get_jwks()
            signing_key = self.get_signing_key(jwks, kid)
            
            # Convert JWK to PEM
            jwk_key = jwk.JWK.from_json(json.dumps(signing_key))
            public_key_pem = jwk_key.export_to_pem()
            
            # Decode and validate token
            payload = jwt.decode(
                token,
                public_key_pem,
                algorithms=ALGORITHMS,
                audience=self.audience,
                issuer=f"https://{self.auth0_domain}/"
            )
            
            logger.debug("Token validated successfully")
            return payload
            
        except jwt.ExpiredSignatureError:
            logger.warning("Token has expired")
            return None
        except jwt.InvalidAudienceError:
            logger.warning(f"Invalid audience. Expected: {self.audience}")
            return None
        except jwt.InvalidIssuerError:
            logger.warning(f"Invalid issuer. Expected: https://{self.auth0_domain}/")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token: {e}")
            return None
        except Exception as e:
            logger.error(f"Token validation error: {e}")
            return None
    
    def extract_user_info(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Extract user info from JWT payload"""
        return {
            'sub': payload.get('sub'),
            'email': payload.get('email'),
            'name': payload.get('name') or payload.get('sub'),
            'permissions': payload.get('permissions', [])
        }
    
    def clear_cache(self):
        """Clear JWKS cache (useful for testing or key rotation)"""
        self._jwks_cache = None
        logger.info("JWKS cache cleared")

def create_auth_decorator(config):
    """Create authentication decorator with proper JWT validation"""
    
    jwt_validator = JWTValidator(config)
    
    def require_jwt_auth(f):
        """Decorator to require JWT authentication for agent access"""
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get current app state (passed as global or context)
            from main import app_state
            
            # Allow unauthenticated access only to registration flow
            if not app_state.get('registered'):
                return f(*args, **kwargs)
            
            # Check for valid user session first
            if app_state.get('auth_token') and app_state.get('user_info'):
                # Optionally validate the stored token is still valid
                stored_token = app_state.get('auth_token')
                if stored_token:
                    payload = jwt_validator.validate_token(stored_token)
                    if payload:
                        return f(*args, **kwargs)
                    else:
                        # Token expired or invalid, clear session
                        logger.info("Stored token invalid, clearing session")
                        app_state.update({
                            'auth_token': None,
                            'user_info': None
                        })
            
            # Check for JWT token in Authorization header (server API calls)
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
                
                # Validate JWT token
                payload = jwt_validator.validate_token(token)
                if payload:
                    logger.info("Valid JWT token provided")
                    # Store validated user info in request context
                    request.current_user = jwt_validator.extract_user_info(payload)
                    return f(*args, **kwargs)
                else:
                    logger.warning(f"Invalid JWT token from {request.remote_addr}")
                    return jsonify({'error': 'Invalid token'}), 403
            
            # No fallback - JWT validation only
            
            # Unauthorized access
            logger.warning(f"Unauthorized access attempt from {request.remote_addr}")
            return jsonify({'error': 'Authentication required'}), 401
        
        return decorated_function
    
    return require_jwt_auth