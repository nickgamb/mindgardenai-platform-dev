# Auth0 Integration for Open WebUI Backend

This document describes the Auth0 integration implemented in the Open WebUI backend (`alden-core/`).

## Overview

The Auth0 integration replaces the local JWT-based authentication system with Auth0's centralized authentication service. This provides:

- Centralized user management through Auth0
- Enhanced security with Auth0's enterprise-grade authentication
- Integration with existing Auth0 user base
- Automatic user provisioning and mapping

## Configuration

### Environment Variables

Add the following environment variables to enable Auth0 authentication:

```bash
# Enable Auth0 authentication (replaces local JWT authentication)
ENABLE_AUTH0=true

# Auth0 domain (e.g., "mindgarden.us.auth0.com")
AUTH0_DOMAIN=mindgarden.us.auth0.com

# Auth0 client ID
AUTH0_CLIENT_ID=your_auth0_client_id

# Auth0 API identifier (audience)
AUTH0_API_IDENTIFIER=your_api_identifier

# Auth0 client secret (for management API if needed)
AUTH0_CLIENT_SECRET=your_auth0_client_secret

# Auth0 redirect URI (for OAuth flow if needed)
AUTH0_REDIRECT_URI=your_redirect_uri
```

### Auth0 Application Setup

1. Create an Auth0 application in your Auth0 dashboard
2. Configure the application settings:
   - **Application Type**: Machine to Machine (for API access)
   - **Allowed Callback URLs**: Your application's callback URL
   - **Allowed Web Origins**: Your application's domain
   - **Allowed Logout URLs**: Your application's logout URL

3. Create an API in Auth0:
   - **Identifier**: Your API identifier (e.g., `https://your-api.com`)
   - **Signing Algorithm**: RS256
   - **Allow Offline Access**: Yes (if you need refresh tokens)

## How It Works

### Authentication Flow

1. **Frontend**: Sends Auth0 access token in Authorization header
   ```
   Authorization: Bearer <auth0_access_token>
   ```

2. **Backend**: Validates the Auth0 token
   - Fetches JWKS from Auth0
   - Validates token signature using RS256
   - Verifies audience and issuer
   - Extracts user information from token

3. **User Mapping**: Maps Auth0 user to local user
   - Looks up user by Auth0 `sub` (subject)
   - If not found, looks up by email
   - If still not found, creates new local user
   - Updates user's last active timestamp

### User Management

- **User Creation**: Automatically creates local users when they first authenticate
- **User Updates**: Updates local user information from Auth0 user info
- **Role Management**: Uses Auth0 roles/permissions for access control
- **User Sync**: Optionally fetches additional user info from Auth0 `/userinfo` endpoint

## API Changes

### Disabled Endpoints (when Auth0 is enabled)

The following endpoints are disabled when `ENABLE_AUTH0=true`:

- `POST /auth/signin` - Local authentication
- `POST /auth/signup` - Local registration
- `POST /auth/add` - Local user creation
- `POST /auth/update/password` - Local password updates

### Modified Endpoints

- `GET /auth/` - Now supports Auth0 tokens
- All protected endpoints - Now accept Auth0 Bearer tokens

## Implementation Details

### Files Modified

1. **`open_webui/env.py`**
   - Added Auth0 configuration variables
   - Added `ENABLE_AUTH0` flag

2. **`open_webui/utils/auth0_auth.py`** (new)
   - Auth0 token validation
   - JWKS fetching and key management
   - User mapping and creation
   - Auth0 user info fetching

3. **`open_webui/utils/auth.py`**
   - Updated `get_current_user()` to support Auth0 tokens
   - Added Auth0 authentication flow
   - Maintains backward compatibility

4. **`open_webui/routers/auths.py`**
   - Disabled local authentication endpoints when Auth0 is enabled
   - Added appropriate error messages

5. **`requirements.txt`**
   - Added `jwcrypto==1.5.1` for JWT validation

### Database Schema

The existing user schema supports Auth0 integration:

```sql
CREATE TABLE user (
    id VARCHAR PRIMARY KEY,
    name VARCHAR,
    email VARCHAR,
    role VARCHAR,
    profile_image_url TEXT,
    last_active_at BIGINT,
    updated_at BIGINT,
    created_at BIGINT,
    api_key VARCHAR,
    settings JSON,
    info JSON,
    oauth_sub TEXT UNIQUE  -- Used for Auth0 sub mapping
);
```

## Testing

Run the test script to verify the integration:

```bash
cd alden-core
python test_auth0_integration.py
```

This will test:
- Configuration loading
- Module imports
- JWKS fetching
- User model functionality

## Migration Guide

### From Local Authentication to Auth0

1. **Backup existing users** (if needed)
2. **Set up Auth0 application** and API
3. **Configure environment variables**
4. **Test with existing users** (they will be automatically mapped)
5. **Update frontend** to use Auth0 tokens
6. **Enable Auth0** by setting `ENABLE_AUTH0=true`

### Frontend Changes Required

The frontend needs to:

1. **Implement Auth0 login** using Auth0 SDK
2. **Send Auth0 tokens** in Authorization header
3. **Handle token refresh** when needed
4. **Remove local authentication UI** when Auth0 is enabled

## Security Considerations

- **Token Validation**: All Auth0 tokens are validated using RS256 signatures
- **Audience Verification**: Ensures tokens are intended for your API
- **User Mapping**: Secure mapping between Auth0 and local users
- **No Local Passwords**: When Auth0 is enabled, no local passwords are stored
- **API Key Support**: API keys still work for programmatic access

## Troubleshooting

### Common Issues

1. **Invalid Token**: Check Auth0 domain and audience configuration
2. **JWKS Fetch Failed**: Verify Auth0 domain and network connectivity
3. **User Not Found**: Check user mapping logic and database
4. **Permission Denied**: Verify Auth0 roles and permissions

### Debugging

Enable debug logging by setting:

```bash
OAUTH_LOG_LEVEL=DEBUG
```

This will show detailed Auth0 authentication logs.

## Future Enhancements

- **User Info Sync**: Periodic sync of user information from Auth0
- **Role Mapping**: Map Auth0 roles to local permissions
- **Management API**: Use Auth0 Management API for advanced user operations
- **Multi-tenancy**: Support for multiple Auth0 tenants 