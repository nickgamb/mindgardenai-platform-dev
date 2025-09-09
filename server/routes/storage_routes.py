from flask import jsonify, request, session
from services.auth import requires_auth, requires_rbac
from services.database import add_storage_item, get_storage_items, update_storage_item, delete_storage_item
from services.database import pg_conn
import logging

def setup_storage_routes(app):
  # Ensure default MG Graph storage exists for the user
  def ensure_default_graph_storage(user_id):
      try:
          items = get_storage_items(user_id)
          for it in items:
              if it.get('file_type') == 'graph' and it.get('file_name') == 'MG Graph':
                  # Optionally load demo graph once, controlled by env
                  import os
                  import json
                  details = {}
                  try:
                      details = json.loads(it.get('file_path') or '{}')
                  except Exception:
                      details = {}
                  already_loaded = bool(details.get('demo_loaded'))
                  if os.getenv('LOAD_DEMO_GRAPH', 'true').lower() in ['1', 'true', 'yes'] and not already_loaded:
                      try:
                          from services.graph import bulk_ingest
                          demo_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'demo_graph.json')
                          with open(demo_path, 'r', encoding='utf-8') as f:
                              demo = json.load(f)
                          bulk_ingest(demo.get('nodes') or [], demo.get('edges') or [])
                          # Mark as loaded by updating file_path JSON
                          details['demo_loaded'] = True
                          update_storage_item(it['id'], user_id, it.get('file_name'), it.get('file_type'), it.get('file_size'), json.dumps(details))
                      except Exception as de:
                          print(f"⚠️ DemoGraph load failed: {de}")
                  return it
          import json
          details = json.dumps({
              'host': 'neo4j',
              'username': 'neo4j',
              'password': 'testpassword',
              'database': 'neo4j'
          })
          add_storage_item(user_id, 'MG Graph', 'graph', 7687, details, None, None)
      except Exception:
          pass

  def ensure_default_postgres_storage(user_id):
      try:
          items = get_storage_items(user_id)
          for it in items:
              if it.get('file_type') == 'postgres' and it.get('file_name') == 'MG Postgres':
                  return it
          import json, os
          details = json.dumps({
              'host': os.getenv('PG_HOST', 'postgres'),
              'port': int(os.getenv('PG_PORT', '5432')),
              'username': os.getenv('PG_USER', 'mg'),
              'database': os.getenv('PG_DB', 'mindgarden')
          })
          # file_size field reused as port like graph
          add_storage_item(user_id, 'MG Postgres', 'postgres', int(os.getenv('PG_PORT', '5432')), details, None, None)
      except Exception:
          pass
  # Storage routes
  @app.route('/api/storage', methods=['GET'])
  @requires_auth
  @requires_rbac
  def api_get_storage_items():
      """
      Get all storage items for the authenticated user.
      ---
      get:
        summary: Get storage items
        description: Retrieve all storage items for the authenticated user.
        tags:
          - storage
        security:
          - BearerAuth: []
        responses:
          '200':
            description: Successful response
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    storage_items:
                      type: array
                      items:
                        type: object
                        properties:
                          id:
                            type: integer
                          file_name:
                            type: string
                          file_type:
                            type: string
                          file_size:
                            type: integer
                          file_path:
                            type: string
          '401':
            description: Unauthorized
      """
      user_id = session['user']['sub']
      ensure_default_graph_storage(user_id)
      ensure_default_postgres_storage(user_id)
      storage_items = get_storage_items(user_id)
      return jsonify({"storage_items": storage_items})

  @app.route('/api/storage', methods=['POST'])
  @requires_auth
  @requires_rbac
  def api_add_storage_item():
      """
      Add a new storage item for the authenticated user.
      ---
      post:
        summary: Add storage item
        description: Create a new storage item for the authenticated user.
        tags:
          - storage
        security:
          - BearerAuth: []
        requestBody:
          required: true
          content:
            application/json:
              schema:
                type: object
                properties:
                  file_name:
                    type: string
                  file_type:
                    type: string
                  file_size:
                    type: integer
                  file_path:
                    type: string
                  shared_with:
                    type: array
                    items:
                      type: string
                  studies:
                    type: array
                    items:
                      type: integer
        responses:
          '200':
            description: Storage item added successfully
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    status:
                      type: string
                    message:
                      type: string
          '401':
            description: Unauthorized
          '500':
            description: Failed to add storage item
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    status:
                      type: string
                    message:
                      type: string
      """
      user_id = session['user']['sub']
      data = request.json
      add_storage_item(user_id, data['file_name'], data['file_type'], data['file_size'], data['file_path'], data.get('shared_with'), data.get('studies'))
      return jsonify({"status": "success", "message": "Storage item added successfully"})

  @app.route('/api/storage/<int:id>', methods=['PUT'])
  @requires_auth
  @requires_rbac
  def api_update_storage_item(id):
      """
      Update an existing storage item for the authenticated user.
      ---
      put:
        summary: Update storage item
        description: Update an existing storage item for the authenticated user.
        tags:
          - storage
        security:
          - BearerAuth: []
        parameters:
          - in: path
            name: id
            required: true
            schema:
              type: integer
            description: The ID of the storage item to update
        requestBody:
          required: true
          content:
            application/json:
              schema:
                type: object
                properties:
                  file_name:
                    type: string
                  file_type:
                    type: string
                  file_size:
                    type: integer
                  file_path:
                    type: string
                  shared_with:
                    type: array
                    items:
                      type: string
                  studies:
                    type: array
                    items:
                      type: integer
        responses:
          '200':
            description: Storage item updated successfully
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    status:
                      type: string
                    message:
                      type: string
          '401':
            description: Unauthorized
          '404':
            description: Storage item not found
          '500':
            description: Failed to update storage item
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    status:
                      type: string
                    message:
                      type: string
      """
      user_id = session['user']['sub']
      data = request.json
      update_storage_item(id, user_id, data['file_name'], data['file_type'], data['file_size'], data['file_path'], data.get('shared_with'), data.get('studies'))
      return jsonify({"status": "success", "message": "Storage item updated successfully"})

  @app.route('/api/storage/<int:id>', methods=['DELETE'])
  @requires_auth
  @requires_rbac
  def api_delete_storage_item(id):
      """
      Delete a storage item for the authenticated user.
      ---
      delete:
        summary: Delete storage item
        description: Delete an existing storage item for the authenticated user.
        tags:
          - storage
        security:
          - BearerAuth: []
        parameters:
          - in: path
            name: id
            required: true
            schema:
              type: integer
            description: The ID of the storage item to delete
        responses:
          '200':
            description: Storage item deleted successfully
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    status:
                      type: string
                    message:
                      type: string
          '401':
            description: Unauthorized
          '404':
            description: Storage item not found
          '500':
            description: Failed to delete storage item
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    status:
                      type: string
                    message:
                      type: string
      """
      print(f"🗑️ DELETE /api/storage/{id} - User ID: {session.get('user', {}).get('sub', 'Unknown')}")
      try:
          user_id = session['user']['sub']
          # Prevent deletion of default MG Graph
          items = get_storage_items(user_id)
          for it in items:
              if it['id'] == id and it.get('file_type') == 'graph' and it.get('file_name') == 'MG Graph':
                  return jsonify({"status": "error", "message": "Cannot delete default MG Graph connection"}), 400
          delete_storage_item(id, user_id)
          print(f"✅ Successfully deleted storage item {id}")
          return jsonify({"status": "success", "message": "Storage item deleted successfully"})
      except Exception as e:
          print(f"❌ Error deleting storage item {id}: {str(e)}")
          return jsonify({"status": "error", "message": f"Failed to delete storage item: {str(e)}"}), 500

  @app.route('/api/storage/<int:id>/data', methods=['GET'])
  @requires_auth
  @requires_rbac
  def api_get_storage_data(id):
      """
      Get data from a specific storage item.
      ---
      get:
        summary: Get storage data
        description: Retrieve the actual data stored in a specific storage item.
        tags:
          - storage
        security:
          - BearerAuth: []
        parameters:
          - in: path
            name: id
            required: true
            schema:
              type: integer
            description: The ID of the storage item
        responses:
          '200':
            description: Storage data retrieved successfully
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    data:
                      type: object
                      description: The actual data stored
                    metadata:
                      type: object
                      properties:
                        size:
                          type: integer
                        recordCount:
                          type: integer
                        lastUpdated:
                          type: string
                        schema:
                          type: object
          '401':
            description: Unauthorized
          '404':
            description: Storage item not found
          '500':
            description: Failed to retrieve storage data
      """
      try:
          user_id = session['user']['sub']
          
          # Get storage item from database
          storage_items = get_storage_items(user_id)
          storage_item = None
          for item in storage_items:
              if item['id'] == id:
                  storage_item = item
                  break
          
          if not storage_item:
              return jsonify({"error": "Storage item not found"}), 404
          
          # Parse storage details
          import json
          try:
              storage_details = json.loads(storage_item['file_path'])
          except json.JSONDecodeError:
              return jsonify({"error": "Invalid storage configuration"}), 500
          
          # Handle different storage types
          if storage_item['file_type'] == 'blob_storage':
              # For blob storage, return the stored data
              data = storage_details.get('data', [])
              metadata = {
                  'size': len(str(data)),
                  'recordCount': len(data) if isinstance(data, list) else 1,
                  'lastUpdated': storage_details.get('created_at', storage_item.get('created_at')),
                  'schema': None  # Could be enhanced to include schema info
              }
              
              return jsonify({
                  "data": data,
                  "metadata": metadata
              }), 200
          elif storage_item['file_type'] == 'graph':
              # Summarize graph contents (labels and counts), return small sample
              from services.graph import cypher_query
              try:
                  counts = cypher_query("MATCH (n) UNWIND labels(n) AS label RETURN label, count(*) AS count ORDER BY count DESC LIMIT 25")
              except Exception:
                  counts = []
              try:
                  sample_nodes = cypher_query("MATCH (n) RETURN n LIMIT 25")
                  sample_rels = cypher_query("MATCH ()-[r]->() RETURN r LIMIT 25")
              except Exception:
                  sample_nodes, sample_rels = [], []
              return jsonify({
                  "data": {
                      "labels": counts,
                      "sample_nodes": sample_nodes,
                      "sample_relationships": sample_rels
                  },
                  "metadata": {
                      'size': storage_item['file_size'],
                      'recordCount': 'Unknown',
                      'lastUpdated': storage_item.get('created_at'),
                      'schema': None
                  }
              }), 200
          elif storage_item['file_type'] == 'postgres':
              # Query Postgres for tables, counts, and small samples
              try:
                  import json as _json
                  details = _json.loads(storage_item.get('file_path') or '{}')
              except Exception:
                  details = {}
              schema = (details.get('schema') or 'public')
              conn = pg_conn()
              if not conn:
                  return jsonify({"error": "Postgres not available"}), 500
              cur = conn.cursor()
              try:
                  # Safer, schema-scoped list
                  cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema=%s ORDER BY table_name LIMIT 50", (schema,))
                  names = [r[0] for r in (cur.fetchall() or [])]
                  result_tables = []
                  for name in names[:8]:
                      fq = f'"{schema}"."{name}"'
                      count = 0
                      sample = []
                      try:
                          cur.execute(f'SELECT COUNT(*) FROM {fq}')
                          count = cur.fetchone()[0]
                      except Exception as _e:
                          count = 0
                      try:
                          cur.execute(f'SELECT * FROM {fq} LIMIT 5')
                          cols = [desc[0] for desc in cur.description or []]
                          rows = cur.fetchall() or []
                          for r in rows:
                              sample.append({cols[i]: r[i] for i in range(len(cols))})
                      except Exception as _e:
                          sample = []
                      result_tables.append({
                          'schema': schema,
                          'name': name,
                          'count': count,
                          'sample_rows': sample
                      })
                  conn.close()
                  return jsonify({
                      "data": {"tables": result_tables},
                      "metadata": {
                          'host': details.get('host'),
                          'port': storage_item['file_size'],
                          'database': details.get('database'),
                          'username': details.get('username'),
                          'schema': schema
                      }
                  })
              except Exception as e:
                  try:
                      conn.close()
                  except Exception:
                      pass
                  logging.error(f"Error reading postgres storage: {e}")
                  return jsonify({"error": str(e)}), 500
          else:
              # External connection placeholder
              metadata = {
                  'size': storage_item['file_size'],
                  'recordCount': 'Unknown',
                  'lastUpdated': storage_item.get('created_at'),
                  'schema': None
              }
              return jsonify({
                  "data": f"External {storage_item['file_type']} connection",
                  "metadata": metadata
              }), 200
              
      except Exception as e:
          logging.error(f"Error getting storage data: {str(e)}")
          return jsonify({"error": str(e)}), 500

  @app.route('/api/storage/<int:id>/presets', methods=['GET'])
  @requires_auth
  @requires_rbac
  def api_get_storage_presets(id):
      """Return graph presets stored on the storage connection's file_path JSON."""
      try:
          user_id = session['user']['sub']
          items = get_storage_items(user_id)
          storage = next((s for s in items if s['id'] == id), None)
          if not storage:
              return jsonify({"error": "Storage not found"}), 404
          import json
          details = {}
          try:
              details = json.loads(storage.get('file_path') or '{}')
          except Exception:
              details = {}
          presets = details.get('presets') or []
          return jsonify({"presets": presets})
      except Exception as e:
          logging.error(f"Error getting storage presets: {e}")
          return jsonify({"error": str(e)}), 500

  @app.route('/api/storage/<int:id>/presets', methods=['PUT'])
  @requires_auth
  @requires_rbac
  def api_update_storage_presets(id):
      """Update graph presets on the storage connection's file_path JSON."""
      try:
          user_id = session['user']['sub']
          body = request.get_json() or {}
          new_presets = body.get('presets')
          if not isinstance(new_presets, list):
              return jsonify({"error": "presets must be a list"}), 400
          # Load storage
          items = get_storage_items(user_id)
          storage = next((s for s in items if s['id'] == id), None)
          if not storage:
              return jsonify({"error": "Storage not found"}), 404
          import json
          details = {}
          try:
              details = json.loads(storage.get('file_path') or '{}')
          except Exception:
              details = {}
          details['presets'] = new_presets
          # Save back
          update_storage_item(
              id,
              user_id,
              storage.get('file_name'),
              storage.get('file_type'),
              storage.get('file_size'),
              json.dumps(details)
          )
          return jsonify({"status": "success"})
      except Exception as e:
          logging.error(f"Error updating storage presets: {e}")
          return jsonify({"error": str(e)}), 500
