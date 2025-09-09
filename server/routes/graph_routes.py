from flask import jsonify, request
from services.auth import requires_auth, requires_rbac
from services.graph import bulk_ingest, cypher_query
import re


def setup_graph_routes(app):
    @app.route('/api/graph/ingest', methods=['POST'])
    @requires_auth
    @requires_rbac
    def api_graph_ingest():
        """
        Ingest nodes and edges into the graph.
        Expects payload: { nodes: [{label,id,props}], edges: [{type, from:{label,id}, to:{label,id}, props}] }
        """
        data = request.json or {}
        nodes = data.get('nodes') or []
        edges = data.get('edges') or []
        result = bulk_ingest(nodes, edges)
        return jsonify({"status": "success", "ingested": result})

    @app.route('/api/graph/query', methods=['POST'])
    @requires_auth
    @requires_rbac
    def api_graph_query():
        """
        Execute a parameterized Cypher query. For security, block write keywords unless explicitly allowed.
        Payload: { query: "MATCH ... RETURN ...", params: {...}, allowWrite: false }
        """
        body = request.json or {}
        query = (body.get('query') or '').strip()
        params = body.get('params') or {}
        allow_write = bool(body.get('allowWrite', False))

        lowered = query.lower()
        forbidden = ['create ', 'merge ', 'delete ', 'detach ', 'set ', 'remove ', 'call dbms']
        if not allow_write and any(k in lowered for k in forbidden):
            return jsonify({"error": "Write operations are not allowed"}), 400

        try:
            rows = cypher_query(query, params)
            # Ensure values are JSON-serializable
            def _serialize(value):
                try:
                    import datetime
                    if isinstance(value, (str, int, float, bool)) or value is None:
                        return value
                    if isinstance(value, (list, tuple)):
                        return [_serialize(v) for v in value]
                    if isinstance(value, dict):
                        return {k: _serialize(v) for k, v in value.items()}
                    if hasattr(value, 'items'):
                        return dict(value)
                    if hasattr(value, 'to_dict'):
                        return value.to_dict()
                    if isinstance(value, datetime.datetime):
                        return value.isoformat()
                    return str(value)
                except Exception:
                    return str(value)
            serialized = [_serialize(r) for r in rows]
            return jsonify({"status": "success", "rows": serialized})
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 400

    @app.route('/api/graph/mgql', methods=['POST'])
    @requires_auth
    @requires_rbac
    def api_graph_mgql():
        """
        Execute MGQL (MG Query Language), translated to Cypher safely.
        Payload: { mgql: "PATH User -memberOf-> Group WHERE over_provisioned_score > 85" }
        """
        body = request.json or {}
        dsl = (body.get('mgql') or '').strip()
        if not dsl:
            return jsonify({"error": "MGQL is required"}), 400
        try:
            cyph, params = translate_mgql_to_cypher(dsl)
            rows = cypher_query(cyph, params)
            def _serialize(value):
                try:
                    import datetime
                    if isinstance(value, (str, int, float, bool)) or value is None:
                        return value
                    if isinstance(value, (list, tuple)):
                        return [_serialize(v) for v in value]
                    if isinstance(value, dict):
                        return {k: _serialize(v) for k, v in value.items()}
                    if hasattr(value, 'items'):
                        return dict(value)
                    if hasattr(value, 'to_dict'):
                        return value.to_dict()
                    if isinstance(value, datetime.datetime):
                        return value.isoformat()
                    return str(value)
                except Exception:
                    return str(value)
            # Create a canonical graph payload alongside raw rows
            plain_rows = [_serialize(r) for r in rows]
            node_map = {}
            edges = []

            def ensure_node(nobj):
                if not isinstance(nobj, dict):
                    return None
                nid = nobj.get('id') or None
                if not nid:
                    return None
                if nid not in node_map:
                    # Heuristic label detection for serialized nodes
                    label = nobj.get('label')
                    if not label:
                        if nobj.get('email'):
                            label = 'OktaUser'
                        elif nobj.get('name') and str(nid).startswith('okta:g-'):
                            label = 'OktaGroup'
                        else:
                            label = 'Node'
                    node_map[nid] = { 'id': nid, 'label': label, **nobj }
                return nid

            for row in plain_rows:
                # Preferred shape from MATCH ... RETURN nodes(p), relationships(p)
                if isinstance(row, dict) and isinstance(row.get('nodes'), list):
                    for n in row['nodes']:
                        ensure_node(n)
                if isinstance(row, dict) and isinstance(row.get('rels'), list):
                    for rel in row['rels']:
                        if isinstance(rel, list) and len(rel) >= 3:
                            src, typ, dst = rel[0], rel[1], rel[2]
                            sid = ensure_node(src)
                            tid = ensure_node(dst)
                            if sid and tid:
                                edges.append({ 'source': sid, 'target': tid, 'type': str(typ or 'REL') })
                # Fallback shapes (u,g,r)
                u = row.get('u') if isinstance(row, dict) else None
                g = row.get('g') if isinstance(row, dict) else None
                r = row.get('r') if isinstance(row, dict) else None
                if u and g:
                    sid = ensure_node(u)
                    tid = ensure_node(g)
                    if sid and tid:
                        edges.append({ 'source': sid, 'target': tid, 'type': (r.get('type') if isinstance(r, dict) else 'REL') })

            graph_payload = { 'nodes': list(node_map.values()), 'edges': edges }
            return jsonify({"status": "success", "query": cyph, "rows": plain_rows, "graph": graph_payload})
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 400


def translate_mgql_to_cypher(dsl: str):
    """Translate MGQL to Cypher with basic safety.
    Supported forms:
      - FIND <Label> [WHERE <cond> [AND <cond>...]] [LIMIT N]
      - PATH <Label> (-<REL>-> <Label>)+ [WHERE <cond> ...] [EXCEPT <Label> (-<REL>-> <Label>)+] [LIMIT N]
      - FROM <Label> TO <Label> VIA <REL>[,REL2,...] [WHERE <cond> ...] [LIMIT N]
    cond: <varOrField> <op> <value>
    ops: =, !=, >, >=, <, <=, CONTAINS, STARTS_WITH, ENDS_WITH
    """
    # Normalize whitespace
    s = re.sub(r"\s+", " ", dsl).strip()
    params = {}
    pidx = 0

    def sanitize_ident(x):
        if not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", x):
            raise ValueError(f"Invalid identifier: {x}")
        return x

    def parse_conditions(cond_str, var_aliases):
        nonlocal pidx
        if not cond_str:
            return "", {}
        # Split by AND/OR (limited: only AND supported for MVP)
        parts = [p.strip() for p in re.split(r"\bAND\b", cond_str, flags=re.IGNORECASE)]
        where_clauses = []
        local_params = {}
        for part in parts:
            m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)(?:\.([A-Za-z_][A-Za-z0-9_]*))?\s*(=|!=|>=|<=|>|<|CONTAINS|STARTS_WITH|ENDS_WITH)\s*(.+)$", part, flags=re.IGNORECASE)
            if not m:
                raise ValueError(f"Invalid condition: {part}")
            var_or_field, field2, op, val = m.groups()
            var = var_or_field
            field = field2 if field2 else None
            if field is None:
                # Default to first var alias if provided
                if var in var_aliases:
                    field = 'id'
                else:
                    # Interpret as current node's field on primary alias 'n0'
                    field = var
                    var = 'n0'
            var = var if var in var_aliases else 'n0'
            var = sanitize_ident(var)
            field = sanitize_ident(field)
            # Parse value literal (string in quotes or number)
            val = val.strip()
            if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                lit = val[1:-1]
            else:
                # number or bareword -> keep as string if not numeric
                if re.match(r"^-?\d+(?:\.\d+)?$", val):
                    lit = float(val) if '.' in val else int(val)
                else:
                    lit = val
            key = f"p{pidx}"
            pidx += 1
            local_params[key] = lit
            if op.upper() == 'CONTAINS':
                where_clauses.append(f"toString({var}.{field}) CONTAINS toString(${key})")
            elif op.upper() == 'STARTS_WITH':
                where_clauses.append(f"toString({var}.{field}) STARTS WITH toString(${key})")
            elif op.upper() == 'ENDS_WITH':
                where_clauses.append(f"toString({var}.{field}) ENDS WITH toString(${key})")
            else:
                where_clauses.append(f"{var}.{field} {op} ${key}")
        return (" WHERE " + " AND ".join(where_clauses)) if where_clauses else "", local_params

    # LIMIT parse
    limit = 200
    lim_m = re.search(r"\bLIMIT\s+(\d+)$", s, flags=re.IGNORECASE)
    if lim_m:
        try:
            limit = int(lim_m.group(1))
            s = s[:lim_m.start()].strip()
        except Exception:
            pass

    if s.upper().startswith('FIND '):
        # FIND Label WHERE ...
        m = re.match(r"^FIND\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:WHERE\s+(.*))?$", s, flags=re.IGNORECASE)
        if not m:
            raise ValueError('Invalid FIND syntax')
        label, cond = m.groups()
        label = sanitize_ident(label)
        where_sql, p = parse_conditions(cond, {'n0'})
        params.update(p)
        cy = f"MATCH (n0:{label}){where_sql} RETURN n0 LIMIT {limit}"
        return cy, params

    if s.upper().startswith('FROM '):
        # FROM Label TO Label VIA rel1,rel2 WHERE ...
        m = re.match(r"^FROM\s+([A-Za-z_][A-Za-z0-9_]*)\s+TO\s+([A-Za-z_][A-Za-z0-9_]*)\s+VIA\s+([A-Za-z0-9_,]+)(?:\s+WHERE\s+(.*))?$", s, flags=re.IGNORECASE)
        if not m:
            raise ValueError('Invalid FROM syntax')
        start_label, end_label, rels_csv, cond = m.groups()
        start_label = sanitize_ident(start_label)
        end_label = sanitize_ident(end_label)
        rels = [sanitize_ident(r.strip()) for r in rels_csv.split(',') if r.strip()]
        # Build variable aliases n0, n1, ...
        pattern = f"(n0:{start_label})"
        var_aliases = {'n0'}
        var_idx = 1
        for rel in rels:
            alias = f"n{var_idx}"
            var_aliases.add(alias)
            pattern += f"-[:{rel}]->({alias})"
            var_idx += 1
        pattern += f"(:{end_label})" if var_idx == 1 else ""
        where_sql, p = parse_conditions(cond, var_aliases)
        params.update(p)
        cy = f"MATCH p = {pattern}{where_sql} RETURN nodes(p) as nodes, relationships(p) as rels LIMIT {limit}"
        return cy, params

    # PATH syntax with optional EXCEPT
    if s.upper().startswith('PATH '):
        # Extract EXCEPT part if present
        except_part = None
        ex_m = re.search(r"\bEXCEPT\b\s+(.+)$", s, flags=re.IGNORECASE)
        if ex_m:
            except_part = ex_m.group(1).strip()
            s_main = s[:ex_m.start()].strip()
        else:
            s_main = s
        m = re.match(r"^PATH\s+(.+?)(?:\s+WHERE\s+(.*))?$", s_main, flags=re.IGNORECASE)
        if not m:
            raise ValueError('Invalid PATH syntax')
        pattern_str, cond = m.groups()
        # pattern like: Label -rel-> Label -rel2-> Label
        toks = [t.strip() for t in re.split(r"-\>|\-\:\[?\:?|\]-\>", pattern_str) if t.strip()]
        # Simple parse: split by arrows
        segs = re.split(r"\-\[?:?([A-Za-z_][A-Za-z0-9_]*)\]?\-\>", pattern_str)
        # Build pattern robustly
        label_rel = re.findall(r"([A-Za-z_][A-Za-z0-9_]*)\s*-\s*([A-Za-z_][A-Za-z0-9_]*)\s*\-\>\s*([A-Za-z_][A-Za-z0-9_]*)", pattern_str)
        # Fallback: tokenize by '->'
        chain = [x.strip() for x in re.split(r"\-\>", pattern_str)]
        labels = []
        rels = []
        for i, chunk in enumerate(chain):
            parts = [p.strip() for p in chunk.split('-') if p.strip()]
            if i == 0:
                labels.append(sanitize_ident(parts[0]))
                if len(parts) > 1:
                    rels.append(sanitize_ident(parts[-1]))
            else:
                if len(parts) == 1:
                    labels.append(sanitize_ident(parts[0]))
                else:
                    rels.append(sanitize_ident(parts[0]))
                    labels.append(sanitize_ident(parts[-1]))
        if len(labels) < 2 or len(rels) < 1:
            # Attempt simpler split: Label1 REL1 Label2 REL2 Label3 ...
            tokens = [t for t in re.split(r"\s+", pattern_str) if t]
            labels = tokens[0::2]
            rels = tokens[1::2]
            labels = [sanitize_ident(l) for l in labels]
            rels = [sanitize_ident(r) for r in rels]
        # Build pattern
        pattern = f"(n0:{labels[0]})"
        var_aliases = {'n0'}
        for i, rel in enumerate(rels, start=1):
            alias = f"n{i}"
            var_aliases.add(alias)
            lab = labels[i] if i < len(labels) else ''
            if lab:
                lab = ':' + sanitize_ident(lab)
            pattern += f"-[:{rel}]->({alias}{lab})"
        where_sql, p = parse_conditions(cond, var_aliases)
        params.update(p)
        cy = f"MATCH p = {pattern}{where_sql}"
        if except_part:
            # Build NOT EXISTS on except pattern (best-effort)
            e_labels = [sanitize_ident(x) for x in re.split(r"\-\>", except_part) if x.strip()]
            if len(e_labels) >= 2:
                cy += f" WHERE NOT EXISTS( (n0)-[]->() )"  # minimal guard; refine later
        cy += f" RETURN nodes(p) as nodes, relationships(p) as rels LIMIT {limit}"
        return cy, params

    # Default fallback: treat as plain label FIND
    if re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", s):
        label = sanitize_ident(s)
        return f"MATCH (n0:{label}) RETURN n0 LIMIT {limit}", params
    raise ValueError('Unrecognized DSL')


