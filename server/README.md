# Server (Flask) Quickstart

- Reads configuration from environment variables (see root `.env.example`).
- Exposes REST API under `/api/*` and WebSocket via Flask-SocketIO.
- Auth: Auth0 Bearer tokens with JWKS validation; RBAC optional.

Docs:
- User settings and feature flags: `server/services/user_settings.py`, `server/routes/user_settings_routes.py`
- Auth: `server/services/auth.py`, `server/routes/auth_routes.py`
