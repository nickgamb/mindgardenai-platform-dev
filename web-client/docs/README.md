# Web-Client Documentation

- Attribute Mapping: `web-client/docs/ATTRIBUTE_MAPPING_GUIDE.md`
- Connector System: `web-client/docs/CONNECTOR_SYSTEM_GUIDE.md`
- NeuroTech Workloads: `web-client/docs/NEUROTECH_WORKLOADS.md`

Suggested reading order:
1) Root `README.md` (setup and running locally)
2) Connector System Guide (mental model of flows)
3) Attribute Mapping Guide (data wiring)
4) NeuroTech Workloads (if enabling devices/experiments)

## Feature Flags (Web)

- NeuroTech Workloads
  - Controls visibility of Devices and Experiments pages and MGFlow nodes
  - Toggle in `Settings > Feature Flags`
  - Persisted via `/api/user/settings` and mirrored in `localStorage` as `feature_neuroTechWorkloads`

## Auth & RBAC

- Uses Auth0; see root README for tenant setup and env vars.
- RBAC can be toggled via `NEXT_PUBLIC_ENABLE_RBAC`.

