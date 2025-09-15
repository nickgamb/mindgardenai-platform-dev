# Third-Party Notices and Attribution

This project incorporates open source software. We thank the authors and communities that make this work possible.

## Direct Upstreams

- Open WebUI (AGPL-3.0) — used as the basis for AI-Core functionality.
  - Source: https://github.com/open-webui/open-webui
  - License: AGPL-3.0

## Dependency Reports

To review transitive dependencies and licenses:

- Web-Client (Node/Next.js)
  - Generate dependency tree and licenses:
    ```bash
    cd web-client
    npm ci
    npx license-checker --production --summary
    npx license-checker --production --csv > ../third_party_web_client.csv
    ```

- Server and AI-Core (Python)
  - Generate license metadata (examples):
    ```bash
    cd server
    pip install -r requirements.txt pip-licenses
    pip-licenses --from=mixed --format=markdown > ../third_party_server.md

    cd ../ai-core
    pip install -r requirements.txt pip-licenses
    pip-licenses --from=mixed --format=markdown > ../third_party_ai_core.md
    ```

Keep this file and generated reports under version control as appropriate.

If you notice any attribution missing or inaccurate, please open an issue or PR.
