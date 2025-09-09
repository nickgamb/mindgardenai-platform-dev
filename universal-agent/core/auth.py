"""
Auth0 Integration and Server Communication Module

Handles OAuth flow, token validation, and device registration with MindGarden server.
"""

import os
import json
import logging
import requests
import jwt
from urllib.parse import urlencode, quote_plus
from typing import Dict, Optional, Any

logger = logging.getLogger('auth')

class AuthManager:
    """Manages authentication and server communication"""
    
    def __init__(self, config):
        self.config = config
        self.auth0_domain = config.AUTH0_DOMAIN
        self.client_id = config.AUTH0_CLIENT_ID
        self.client_secret = config.AUTH0_CLIENT_SECRET
        self.audience = config.AUTH0_AUDIENCE
        self.api_base = config.MINDGARDEN_API_BASE
        
    def get_auth_url(self, redirect_uri: str) -> str:
        """Generate Auth0 authorization URL"""
        try:
            callback_url = f"{redirect_uri.rstrip('/')}/api/callback"
            
            params = {
                'response_type': 'code',
                'client_id': self.client_id,
                'redirect_uri': callback_url,
                'scope': 'openid profile email',
                'audience': self.audience,
                'state': 'mindgarden-universal-agent'
            }
            
            auth_url = f"https://{self.auth0_domain}/authorize?" + urlencode(params, quote_via=quote_plus)
            logger.info(f"Generated auth URL: {auth_url}")
            return auth_url
            
        except Exception as e:
            logger.error(f"Error generating auth URL: {e}")
            raise
    
    def exchange_code_for_token(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        """Exchange authorization code for access token"""
        try:
            callback_url = f"{redirect_uri.rstrip('/')}/api/callback"
            
            token_data = {
                'grant_type': 'authorization_code',
                'client_id': self.client_id,
                'client_secret': self.client_secret,
                'code': code,
                'redirect_uri': callback_url
            }
            
            token_url = f"https://{self.auth0_domain}/oauth/token"
            
            logger.info(f"Exchanging code for token at: {token_url}")
            response = requests.post(token_url, json=token_data, timeout=30)
            response.raise_for_status()
            
            token_info = response.json()
            logger.info("Successfully obtained access token")
            
            # Store token securely
            self._store_token(token_info)
            
            return token_info
            
        except requests.exceptions.RequestException as e:
            logger.error(f"HTTP error during token exchange: {e}")
            raise
        except Exception as e:
            logger.error(f"Error exchanging code for token: {e}")
            raise
    
    def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Get user information from Auth0"""
        try:
            headers = {'Authorization': f'Bearer {access_token}'}
            userinfo_url = f"https://{self.auth0_domain}/userinfo"
            
            response = requests.get(userinfo_url, headers=headers, timeout=30)
            response.raise_for_status()
            
            user_info = response.json()
            logger.info(f"Retrieved user info for: {user_info.get('email', 'unknown')}")
            
            return user_info
            
        except requests.exceptions.RequestException as e:
            logger.error(f"HTTP error getting user info: {e}")
            raise
        except Exception as e:
            logger.error(f"Error getting user info: {e}")
            raise
    
    def validate_token(self, access_token: str) -> bool:
        """Validate JWT access token"""
        try:
            # Decode without verification for development
            # In production, you should verify the signature
            decoded = jwt.decode(access_token, options={"verify_signature": False})
            
            # Check if token is expired
            import time
            if decoded.get('exp', 0) < time.time():
                logger.warning("Token is expired")
                return False
            
            logger.info("Token is valid")
            return True
            
        except jwt.InvalidTokenError as e:
            logger.error(f"Invalid token: {e}")
            return False
        except Exception as e:
            logger.error(f"Error validating token: {e}")
            return False
    
    def register_device_with_server(self, device_config: Dict[str, Any], access_token: str) -> Dict[str, Any]:
        """Register device with MindGarden server"""
        try:
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            
            registration_data = {
                'device_name': device_config['device_name'],
                'device_model': device_config['device_model'],
                'device_settings': device_config['device_settings']
            }
            
            register_url = f"{self.api_base}/api/devices"
            
            logger.info(f"Registering device with server: {register_url}")
            logger.info(f"Registration data: {registration_data}")
            
            response = requests.post(
                register_url, 
                json=registration_data, 
                headers=headers, 
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                logger.info(f"Device registered successfully: {result}")
                return {
                    'success': True,
                    'device_id': result.get('device', {}).get('device_id'),
                    'message': result.get('message', 'Device registered successfully')
                }
            else:
                logger.error(f"Registration failed: {response.status_code} - {response.text}")
                return {
                    'success': False,
                    'error': f"Registration failed: {response.status_code}"
                }
                
        except requests.exceptions.RequestException as e:
            logger.error(f"HTTP error during device registration: {e}")
            return {'success': False, 'error': f"Network error: {str(e)}"}
        except Exception as e:
            logger.error(f"Error registering device: {e}")
            return {'success': False, 'error': str(e)}
    
    def register_device_with_server_custom_id(self, registration_data: Dict[str, Any], access_token: str) -> Dict[str, Any]:
        """Register device with MindGarden server using custom device ID"""
        try:
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            
            register_url = f"{self.api_base}/api/devices"
            
            logger.info(f"Registering device with custom ID: {register_url}")
            logger.info(f"Registration data: {registration_data}")
            
            response = requests.post(
                register_url, 
                json=registration_data, 
                headers=headers, 
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                logger.info(f"Device registered successfully: {result}")
                
                # Extract the server's device ID from the response
                server_device_id = result.get('device', {}).get('device_id', registration_data['device_id'])
                
                return {
                    'success': True,
                    'device_id': server_device_id,  # Use the server's ID
                    'message': result.get('message', 'Device registered successfully')
                }
            else:
                logger.error(f"Registration failed: {response.status_code} - {response.text}")
                return {
                    'success': False,
                    'error': f"Registration failed: {response.status_code}"
                }
                
        except requests.exceptions.RequestException as e:
            logger.error(f"HTTP error during device registration: {e}")
            return {'success': False, 'error': f"Network error: {str(e)}"}
        except Exception as e:
            logger.error(f"Error registering device: {e}")
            return {'success': False, 'error': str(e)}
    
    def unregister_device_from_server(self, device_id: str, access_token: str) -> Dict[str, Any]:
        """Unregister device from MindGarden server"""
        try:
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }
            
            unregister_url = f"{self.api_base}/api/devices/{device_id}"
            
            logger.info(f"Unregistering device from server: {unregister_url}")
            
            response = requests.delete(
                unregister_url, 
                headers=headers, 
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                logger.info(f"Device unregistered successfully: {result}")
                return {
                    'success': True,
                    'message': result.get('message', 'Device unregistered successfully')
                }
            else:
                logger.error(f"Unregistration failed: {response.status_code} - {response.text}")
                return {
                    'success': False,
                    'error': f"Unregistration failed: {response.status_code}"
                }
                
        except requests.exceptions.RequestException as e:
            logger.error(f"HTTP error during device unregistration: {e}")
            return {'success': False, 'error': f"Network error: {str(e)}"}
        except Exception as e:
            logger.error(f"Error unregistering device: {e}")
            return {'success': False, 'error': str(e)}
    
    def refresh_token(self, refresh_token: str) -> Optional[Dict[str, Any]]:
        """Refresh access token using refresh token"""
        try:
            token_data = {
                'grant_type': 'refresh_token',
                'client_id': self.client_id,
                'client_secret': self.client_secret,
                'refresh_token': refresh_token
            }
            
            token_url = f"https://{self.auth0_domain}/oauth/token"
            
            response = requests.post(token_url, json=token_data, timeout=30)
            response.raise_for_status()
            
            token_info = response.json()
            logger.info("Successfully refreshed access token")
            
            # Store refreshed token
            self._store_token(token_info)
            
            return token_info
            
        except requests.exceptions.RequestException as e:
            logger.error(f"HTTP error during token refresh: {e}")
            return None
        except Exception as e:
            logger.error(f"Error refreshing token: {e}")
            return None
    
    def _store_token(self, token_info: Dict[str, Any]):
        """Store token information securely"""
        try:
            # In production, encrypt this data
            token_file = self.config.TOKEN_FILE
            os.makedirs(os.path.dirname(token_file), exist_ok=True)
            
            with open(token_file, 'w') as f:
                json.dump(token_info, f, indent=2)
            
            logger.info("Token stored successfully")
            
        except Exception as e:
            logger.error(f"Error storing token: {e}")
    
    def load_stored_token(self) -> Optional[Dict[str, Any]]:
        """Load stored token information"""
        try:
            token_file = self.config.TOKEN_FILE
            
            if os.path.exists(token_file):
                with open(token_file, 'r') as f:
                    token_info = json.load(f)
                
                # Validate token is still valid
                if self.validate_token(token_info.get('access_token', '')):
                    logger.info("Loaded valid stored token")
                    return token_info
                else:
                    logger.warning("Stored token is invalid or expired")
                    return None
            
            return None
            
        except Exception as e:
            logger.error(f"Error loading stored token: {e}")
            return None
    
    def clear_stored_token(self):
        """Clear stored token information"""
        try:
            token_file = self.config.TOKEN_FILE
            if os.path.exists(token_file):
                os.remove(token_file)
                logger.info("Stored token cleared")
        except Exception as e:
            logger.error(f"Error clearing stored token: {e}")