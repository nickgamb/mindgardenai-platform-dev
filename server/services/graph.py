import os
from typing import Any, Dict, List, Optional

from neo4j import GraphDatabase, Driver


_driver: Optional[Driver] = None


def get_driver() -> Driver:
    global _driver
    if _driver:
        return _driver
    uri = os.getenv('NEO4J_URI', 'bolt://localhost:7687')
    user = os.getenv('NEO4J_USER', 'neo4j')
    password = os.getenv('NEO4J_PASSWORD', 'testpassword')
    _driver = GraphDatabase.driver(uri, auth=(user, password))
    return _driver


def close_driver() -> None:
    global _driver
    if _driver:
        _driver.close()
        _driver = None


def _label(label: str) -> str:
    return ''.join([c for c in label if c.isalnum() or c == '_'])


def upsert_node(label: str, node_id: str, props: Dict[str, Any]) -> None:
    label_safe = _label(label)
    with get_driver().session() as session:
        session.execute_write(
            lambda tx: tx.run(
                f"MERGE (n:{label_safe} {{ id: $id }}) SET n += $props",
                id=node_id,
                props=props or {},
            )
        )


def upsert_edge(edge_type: str, from_label: str, from_id: str, to_label: str, to_id: str, props: Optional[Dict[str, Any]] = None) -> None:
    from_label_safe = _label(from_label)
    to_label_safe = _label(to_label)
    edge_type_safe = _label(edge_type)
    with get_driver().session() as session:
        session.execute_write(
            lambda tx: tx.run(
                f"MERGE (a:{from_label_safe} {{ id: $from_id }}) "
                f"MERGE (b:{to_label_safe} {{ id: $to_id }}) "
                f"MERGE (a)-[r:{edge_type_safe}]->(b) "
                f"SET r += $props",
                from_id=from_id,
                to_id=to_id,
                props=props or {},
            )
        )


def cypher_query(query: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    with get_driver().session() as session:
        result = session.run(query, **(params or {}))
        return [record.data() for record in result]


def bulk_ingest(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> Dict[str, int]:
    created_nodes = 0
    created_edges = 0
    for n in nodes or []:
        upsert_node(n.get('label') or 'Node', str(n.get('id')), n.get('props') or {})
        created_nodes += 1
    for e in edges or []:
        src = e.get('from') or {}
        dst = e.get('to') or {}
        if not (src and dst):
            continue
        upsert_edge(
            e.get('type') or 'RELATES_TO',
            src.get('label') or 'Node',
            str(src.get('id')),
            dst.get('label') or 'Node',
            str(dst.get('id')),
            e.get('props') or {},
        )
        created_edges += 1
    return {"nodes": created_nodes, "edges": created_edges}


