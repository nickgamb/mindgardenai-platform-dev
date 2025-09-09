import requests
from flask import current_app, session, request
import logging

def get_auth0_management_token():
    try:
        domain = current_app.config['AUTH0_DOMAIN']
        auth0_domain = 'mindgarden.us.auth0.com'  # Use your actual Auth0 domain here
        client_id = current_app.config['AUTH0_MGMT_CLIENT_ID']
        client_secret = current_app.config['AUTH0_MGMT_CLIENT_SECRET']
        audience = f'https://{auth0_domain}/api/v2/'

        if not all([domain, client_id, client_secret]):
            missing = [k for k, v in {
                'AUTH0_DOMAIN': domain, 
                'AUTH0_MGMT_CLIENT_ID': client_id, 
                'AUTH0_MGMT_CLIENT_SECRET': client_secret
            }.items() if not v]
            logging.error(f"Missing Auth0 configuration: {', '.join(missing)}")
            return None

        payload = {
            'client_id': client_id,
            'client_secret': client_secret,
            'audience': audience,
            'grant_type': 'client_credentials'
        }
        
        response = requests.post(f'https://{auth0_domain}/oauth/token', json=payload, timeout=10)
        response.raise_for_status()
        
        token = response.json().get('access_token')
        if not token:
            logging.error("Auth0 response did not contain an access token")
            return None
        
        return token

    except requests.exceptions.RequestException as e:
        logging.error(f"Error obtaining Auth0 management token: {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            logging.error(f"Response status code: {e.response.status_code}")
            logging.error(f"Response content: {e.response.text}")
        return None
    except Exception as e:
        logging.error(f"Unexpected error in get_auth0_management_token: {str(e)}")
        return None

def get_user_by_email(email):
    try:
        token = get_auth0_management_token()
        if not token:
            logging.error("Failed to obtain Auth0 management token")
            return None

        domain = current_app.config.get('AUTH0_DOMAIN')
        if not domain:
            logging.error("AUTH0_DOMAIN not found in configuration")
            return None

        headers = {'Authorization': f'Bearer {token}'}
        
        response = requests.get(f'https://{domain}/api/v2/users-by-email', 
                                headers=headers, 
                                params={'email': email})
        response.raise_for_status()
        users = response.json()
        return users[0] if users else None

    except requests.exceptions.RequestException as e:
        logging.error(f"Error in get_user_by_email: {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            logging.error(f"Response status code: {e.response.status_code}")
            logging.error(f"Response content: {e.response.text}")
        return None
    except Exception as e:
        logging.error(f"Unexpected error in get_user_by_email: {str(e)}")
        return None

def get_user_by_id(user_id):
    try:
        token = get_auth0_management_token()
        if not token:
            logging.error("Failed to obtain Auth0 management token")
            return None

        domain = current_app.config.get('AUTH0_DOMAIN')
        if not domain:
            logging.error("AUTH0_DOMAIN not found in configuration")
            return None

        headers = {'Authorization': f'Bearer {token}'}
        
        response = requests.get(f'https://{domain}/api/v2/users/{user_id}', 
                                headers=headers)
        response.raise_for_status()
        return response.json()

    except requests.exceptions.RequestException as e:
        logging.error(f"Error in get_user_by_id: {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            logging.error(f"Response status code: {e.response.status_code}")
            logging.error(f"Response content: {e.response.text}")
        return None
    except Exception as e:
        logging.error(f"Unexpected error in get_user_by_id: {str(e)}")
        return None

def revoke_all_refresh_tokens(user_id):
    try:
        token = get_auth0_management_token()
        if not token:
            logging.error("Failed to obtain Auth0 management token")
            return False

        domain = current_app.config.get('AUTH0_DOMAIN')
        if not domain:
            logging.error("AUTH0_DOMAIN not found in configuration")
            return False

        url = f"https://{domain}/api/v2/users/{user_id}/multifactor/actions/invalidate-remember-browser"
        headers = {'Authorization': f'Bearer {token}'}
        
        response = requests.post(url, headers=headers)
        response.raise_for_status()
        return response.status_code == 204

    except requests.exceptions.RequestException as e:
        logging.error(f"Error in revoke_all_refresh_tokens: {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            logging.error(f"Response status code: {e.response.status_code}")
            logging.error(f"Response content: {e.response.text}")
        return False
    except Exception as e:
        logging.error(f"Unexpected error in revoke_all_refresh_tokens: {str(e)}")
        return False

def logout_user_by_email(email):
    try:
        user = get_user_by_email(email)
        if not user:
            logging.warning(f"User not found for email: {email}")
            return False
        
        user_id = user['user_id']
        success = revoke_all_refresh_tokens(user_id)
        invalidate_access_tokens(user_id)
        
        # Clear server-side session if it exists
        if 'user' in session and session['user'].get('email') == email:
            session.clear()
        
        return success

    except Exception as e:
        logging.error(f"Unexpected error in logout_user_by_email: {str(e)}")
        return False

def logout_user_by_id(issuer, subject):
    try:
        user = get_user_by_id(subject)
        if not user or user.get('identities')[0].get('provider') != issuer:
            logging.warning(f"User not found or issuer mismatch for subject: {subject}")
            return False
        
        success = revoke_all_refresh_tokens(subject)
        invalidate_access_tokens(subject)
        
        # Clear server-side session if it exists
        if 'user' in session and session['user'].get('sub') == subject:
            session.clear()
        
        return success

    except Exception as e:
        logging.error(f"Unexpected error in logout_user_by_id: {str(e)}")
        return False

def revoke_refresh_token(refresh_token):
    # This function is not needed when using Auth0
    # Auth0 doesn't provide a way to revoke individual refresh tokens
    logging.warning("Attempt to revoke individual refresh token. This operation is not supported by Auth0.")
    pass

def invalidate_access_tokens(user_id):
    try:
        token = get_auth0_management_token()
        if not token:
            logging.error("Failed to obtain Auth0 management token")
            return False

        domain = current_app.config.get('AUTH0_DOMAIN')
        if not domain:
            logging.error("AUTH0_DOMAIN not found in configuration")
            return False

        url = f"https://{domain}/api/v2/users/{user_id}/sessions"
        headers = {'Authorization': f'Bearer {token}'}
        
        response = requests.delete(url, headers=headers)
        response.raise_for_status()
        return response.status_code == 204

    except requests.exceptions.RequestException as e:
        logging.error(f"Error in invalidate_access_tokens: {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            logging.error(f"Response status code: {e.response.status_code}")
            logging.error(f"Response content: {e.response.text}")
        return False
    except Exception as e:
        logging.error(f"Unexpected error in invalidate_access_tokens: {str(e)}")
        return False
