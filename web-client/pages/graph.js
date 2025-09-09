import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Box, Typography, TextField, Button, Paper, MenuItem, Select, InputLabel, FormControl, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Chip } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import api from '../lib/api';
import { systemGraphPresets, systemGraphPresetMap } from '../components/GraphPresets';
import dynamic from 'next/dynamic';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
// Register fCoSE once (client-side)
if (typeof window !== 'undefined') {
  try { cytoscape.use(fcose); } catch (e) {}
}

const defaultQuery = 'MATCH (n)-[r]->(m) RETURN n, type(r) as rel, m LIMIT 50';

const GraphPage = () => {
  const [query, setQuery] = useState(defaultQuery);
  const [rows, setRows] = useState([]);
  const [mgql, setMgql] = useState('PATH OktaUser -memberOf-> OktaGroup LIMIT 200');
  const [error, setError] = useState('');
  const [hasGraph, setHasGraph] = useState(true);
  const [loading, setLoading] = useState(false);
  const [preset, setPreset] = useState('okta_users_groups');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customPresets, setCustomPresets] = useState([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const graphWrapRef = useRef(null);
  const cyRef = useRef(null);
  const [graphSize, setGraphSize] = useState({ w: 0, h: 0 });
  const [graphOverride, setGraphOverride] = useState(null);
  const [viewMode, setViewMode] = useState('2d'); // '2d' | '3d'
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoverNode, setHoverNode] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [hoverPinned, setHoverPinned] = useState(false);
  const [hover3DNode, setHover3DNode] = useState(null);
  const [hover3DPos, setHover3DPos] = useState({ x: 0, y: 0 });
  const [hover3DExpanded, setHover3DExpanded] = useState(false);
  const [hover3DPinned, setHover3DPinned] = useState(false);
  // Visual theming for edges by type
  const linkColorForType = useMemo(() => ({
    memberOf: '#8b5cf6', // purple
    uses: '#10b981',     // emerald
    assignedTo: '#22c55e',
    hasRole: '#f59e0b',
    identifies: '#38bdf8',
    reportsTo: '#ea580c'
  }), []);
  const [filters, setFilters] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState({ entity: 'OktaUser', attribute: 'email', operator: 'CONTAINS', value: '' });

  const presets = useMemo(() => systemGraphPresetMap, []);
  const entityAttributeMap = useMemo(() => ({
    OktaUser: ['email', 'status', 'mfa', 'id'],
    OktaGroup: ['name', 'id'],
    Employee: ['department', 'cost_center', 'status', 'email', 'employeeId'],
    ADUser: ['email', 'samAccountName', 'enabled', 'id'],
    App: ['name', 'provider', 'id']
  }), []);
  const operators = ['=', '!=', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', '>', '>=', '<', '<='];

  const addFilter = () => {
    const draft = filterDraft || {};
    if (!draft.attribute || draft.value === undefined) return;
    setFilters(prev => [...prev, { ...draft }]);
    setFilterOpen(false);
  };
  const removeFilter = (idx) => setFilters(prev => prev.filter((_, i) => i !== idx));
  const quoteIfNeeded = (val) => {
    if (typeof val === 'number') return String(val);
    const num = Number(val);
    if (!Number.isNaN(num) && String(num) === String(val)) return String(val);
    const escaped = String(val).replace(/"/g, '\\"');
    return `"${escaped}"`;
  };
  const computeMgqlWithFilters = (base, list) => {
    if (!list || list.length === 0) return base;
    const limMatch = base.match(/\bLIMIT\s+\d+\s*$/i);
    const limitStr = limMatch ? limMatch[0] : '';
    const withoutLimit = limMatch ? base.slice(0, limMatch.index).trim() : base.trim();
    const existingWhere = /\bWHERE\b/i.test(withoutLimit);
    const conds = list.map(f => {
      const op = (f.operator || '=').toUpperCase();
      return `${f.attribute || 'id'} ${op} ${quoteIfNeeded(f.value ?? '')}`;
    }).join(' AND ');
    const withWhere = existingWhere ? `${withoutLimit} AND ${conds}` : `${withoutLimit} WHERE ${conds}`;
    return limitStr ? `${withWhere} ${limitStr}` : withWhere;
  };

  // Load availability and presets from default MG Graph storage
  useEffect(() => {
    (async () => {
      try {
        const s = await api.fetchStorageItems();
        const graphs = (s.storage_items || []).filter((x) => x.file_type === 'graph');
        setHasGraph(graphs.length > 0);
        // Pick default MG Graph if present; else first graph
        const def = graphs.find(x => x.file_name === 'MG Graph') || graphs[0];
        if (def) {
          const pr = await api.getStoragePresets(def.id);
          const saved = pr?.presets;
          if (Array.isArray(saved)) setCustomPresets(saved);
          // Remember selected storage id for saving presets later
          setSelectedStorageId(def.id);
        }
      } catch (e) {
        setHasGraph(false);
      }
    })();
  }, []);

  const [selectedStorageId, setSelectedStorageId] = useState(null);

  const allPresets = useMemo(() => {
    const sys = systemGraphPresets.map((p) => ({ key: p.key, label: p.label, query: p.query, mgql: p.mgql, filters: [], system: true }));
    const user = (customPresets || []).map((p) => ({ key: `user:${p.name}`, label: p.name, query: p.query || '', mgql: p.mgql || '', filters: Array.isArray(p.filters) ? p.filters : [] }));
    return [...sys, ...user];
  }, [presets, customPresets]);

  const savePreset = async () => {
    if (!newPresetName.trim()) return;
    const next = [...customPresets.filter(p => p.name !== newPresetName), { name: newPresetName, mgql, query, filters }];
    setCustomPresets(next);
    try {
      if (selectedStorageId) await api.updateStoragePresets(selectedStorageId, next);
      setNewPresetName('');
    } catch (e) {}
  };

  const runQuery = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.graphQuery({ query, params: {} });
      setGraphOverride(null);
      setRows(res.rows || []);
    } catch (e) {
      setError(e?.message || 'Query failed');
      if ((e?.message || '').toLowerCase().includes('connect') || (e?.message || '').toLowerCase().includes('neo4j')) {
        setHasGraph(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const runMGQL = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.graphMGQL({ mgql: computeMgqlWithFilters(mgql, filters) });
      setRows(res.rows || []);
      if (res.graph && Array.isArray(res.graph.nodes)) {
        setGraphOverride(res.graph);
      } else {
        setGraphOverride(null);
      }
      if (res.query) setQuery(res.query);
    } catch (e) {
      setError(e?.message || 'MGQL query failed');
    } finally {
      setLoading(false);
    }
  };

  // Convert rows to graph
  const graphData = useMemo(() => {
    // Prefer canonical graph payload from API
    if (graphOverride && Array.isArray(graphOverride.nodes)) {
      const links = Array.isArray(graphOverride.edges)
        ? graphOverride.edges.map(e => ({ source: e.source, target: e.target, type: e.type || 'REL' }))
        : (Array.isArray(graphOverride.links) ? graphOverride.links : []);
      return { nodes: graphOverride.nodes, links };
    }

    const nodeMap = new Map();
    const links = [];

    const ensureNode = (obj) => {
      if (!obj) return null;
      const id = obj.id || (obj.properties && obj.properties.id) || JSON.stringify(obj);
      if (!id) return null;
      if (!nodeMap.has(id)) {
        const label = obj.label || (obj.labels && obj.labels[0]) || (obj.email ? 'OktaUser' : (obj.name ? 'OktaGroup' : 'Node'));
        const props = obj.properties ? obj.properties : obj;
        nodeMap.set(id, { id, label, ...props });
      }
      return id;
    };

    (rows || []).forEach(row => {
      // Format 1: separate u/r/g fields or neo4j Node objects with labels/properties
      Object.values(row).forEach(val => {
        if (val && val.labels && val.properties) {
          ensureNode(val);
        }
      });
      const r = row.r;
      const u = row.u || row.source || row.start || row.from;
      const g = row.g || row.a || row.target || row.end || row.to;
      if (r && u && g) {
        const sid = ensureNode(u);
        const tid = ensureNode(g);
        if (sid && tid) links.push({ source: sid, target: tid, type: r.type || 'REL' });
      }

      // Format 2: { nodes: [...], rels: [[src, type, dst], ...] }
      if (Array.isArray(row.nodes)) {
        row.nodes.forEach(n => ensureNode(n));
      }
      if (Array.isArray(row.rels)) {
        row.rels.forEach(rel => {
          if (Array.isArray(rel) && rel.length >= 3) {
            const [src, type, dst] = rel;
            const sid = ensureNode(src);
            const tid = ensureNode(dst);
            if (sid && tid) links.push({ source: sid, target: tid, type: String(type || 'REL') });
          }
        });
      }
    });

    // Build base graph
    const baseNodes = Array.from(nodeMap.values());
    const baseLinks = links.slice();

    // Post-process: ensure a root role node for Okta groups ("Everyone")
    try {
      const hasOktaGroups = baseNodes.some(n => String(n.label) === 'OktaGroup');
      if (hasOktaGroups) {
        // Find an existing Everyone group if present (case-insensitive), else synthesize one
        let root = baseNodes.find(n => String(n.label) === 'OktaGroup' && String(n.name || n.title || '').toLowerCase() === 'everyone');
        if (!root) {
          root = { id: 'synthetic:okta:Everyone', label: 'OktaGroup', name: 'Everyone', synthetic: true };
          baseNodes.push(root);
        }
        const rootId = root.id;
        const groupIds = new Set(baseNodes.filter(n => String(n.label) === 'OktaGroup' && n.id !== rootId).map(n => n.id));
        // Add extends edges from Everyone -> each OktaGroup if not already connected
        const hasEdge = (s, t) => baseLinks.some(e => (e.source === s && e.target === t));
        groupIds.forEach(gid => {
          if (!hasEdge(rootId, gid)) baseLinks.push({ source: rootId, target: gid, type: 'extends' });
        });
      }
    } catch (_) {}

    return { nodes: baseNodes, links: baseLinks };
  }, [rows, graphOverride]);

  const sidebarWidth = sidebarCollapsed ? 52 : 360;

  const CytoscapeComponent = useMemo(() => dynamic(() => import('react-cytoscapejs'), { ssr: false }), []);
  const ForceGraph3D = useMemo(() => dynamic(() => import('react-force-graph-3d').then(mod => mod.default), { ssr: false }), []);
  const fg3dRef = useRef(null);

  useEffect(() => {
    const measure = () => {
      const el = graphWrapRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        setGraphSize({ w: Math.max(0, rect.width), h: Math.max(0, rect.height) });
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [sidebarCollapsed]);
  // Layout + fit when data changes (Cytoscape)
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || viewMode !== '2d') return;
    if (graphData.nodes && graphData.nodes.length > 0) {
      try {
        // Choose one layout strategy to avoid conflicting moves
        const hasOktaGroups = cy.nodes('.OktaGroup').length > 0;
        const usedRadial = hasOktaGroups; // if Okta groups exist, use deterministic radial placement

        if (!usedRadial) {
          // Generic graphs: use a single automatic layout
          let layout;
          try {
            layout = cy.layout({
              name: 'fcose',
              animate: true,
              animationDuration: 800,
              quality: 'proof',
              packComponents: true,
              randomize: true,
              nodeDimensionsIncludeLabels: true,
              nodeSeparation: 380,
              componentSpacing: 420,
              idealEdgeLength: () => 360,
              edgeElasticity: () => 0.05,
              nodeRepulsion: () => 220000,
              gravity: 0.06,
              padding: 220,
              fit: false
            });
          } catch (e) {
            layout = cy.layout({ name: 'cose', animate: true, nodeRepulsion: 6000000, idealEdgeLength: 360, edgeElasticity: 0.05, gravity: 0.4, numIter: 4500, padding: 220, fit: false });
          }
          layout.run();
        } else {
          // Radial for Okta: deterministic positions, no additional auto layout
          try {
            const groups = cy.nodes('.OktaGroup');
            if (groups && groups.length > 0) {
              // Detect root (Everyone) if available
              let root = groups.filter((n) => {
                const nm = String(n.data('name') || n.data('title') || '').toLowerCase();
                const nid = String(n.id() || '');
                return nm === 'everyone' || nid.includes('synthetic:okta:Everyone') || nm.includes('everyone');
              })[0];
              if (!root) root = groups[0];
              const center = root.position();
              const others = groups.filter((g) => g.id() !== root.id());
              const count = others.length;
              const canvasMin = Math.min(graphSize.w || 1600, graphSize.h || 900);
              const radius = Math.max(520, Math.min(1100, (canvasMin || 900) * 0.38));
              cy.batch(() => {
                others.forEach((g, idx) => {
                  // Stagger angles slightly to prevent collinear spokes
                  const angle = (2 * Math.PI * idx) / Math.max(1, count) + (idx % 2 === 0 ? 0.08 : -0.06);
                  const x = center.x + radius * Math.cos(angle);
                  const y = center.y + radius * Math.sin(angle);
                  g.position({ x, y });
                });
              });

              // Place users in rings around their group, rotated to avoid overlap with root->group edge
              const baseUserRadius = 200; // larger to avoid flat lines
              const ringGap = 120;
              const minUserSpacing = 72;
              cy.batch(() => {
                groups.forEach((g) => {
                  // shuffle users to avoid symmetric alignment
                  const users = g.connectedNodes('.OktaUser').sort(() => Math.random() - 0.5);
                  const total = users.length;
                  if (total === 0) return;
                  let r = baseUserRadius; let placed = 0; let ringIndex = 0;
                  while (placed < total) {
                    const capacity = Math.max(8, Math.floor((2 * Math.PI * r) / minUserSpacing));
                    for (let i = 0; i < capacity && placed < total; i++) {
                      const gp = g.position();
                      const edgeAngle = Math.atan2(gp.y - center.y, gp.x - center.x);
                      const baseAngle = edgeAngle + Math.PI / 2; // rotate 90° off the root edge
                      const angle = baseAngle + ((2 * Math.PI * i) / capacity) + (ringIndex * 0.17);
                      const c = g.position();
                      const x = c.x + r * Math.cos(angle);
                      const y = c.y + r * Math.sin(angle);
                      users[placed].position({ x, y });
                      try { users[placed].locked(true); } catch {}
                      placed++;
                    }
                    ringIndex++; r += ringGap; if (ringIndex > 40) break;
                  }
                });
              });
              // Re-run preset layout to apply new positions deterministically on first render
              try { cy.stop(); cy.layout({ name: 'preset', fit: false }).run(); } catch {}
              try { cy.fit(undefined, 80); } catch {}
            }
          } catch {}
        }

        // Overlap resolution (lightweight after radial; stronger after auto layout)
        const resolveCollisions = () => {
          try {
            const nodes = cy.nodes();
            if (!nodes || nodes.length === 0) return;
            const radiusFor = (n) => {
              const isGroup = n.hasClass('OktaGroup');
              const isUser = n.hasClass('OktaUser');
              const base = Math.max(6, (n.width() + n.height()) / 4);
              return base + (isGroup ? 22 : isUser ? 10 : 16);
            };
            const originalLocks = new Map();
            nodes.forEach(n => originalLocks.set(n.id(), n.locked()));

            const maxIters = usedRadial ? 8 : 36;
            for (let iter = 0; iter < maxIters; iter++) {
              let moved = false;
              for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                  const a = nodes[i];
                  const b = nodes[j];
                  const ax = a.position('x');
                  const ay = a.position('y');
                  const bx = b.position('x');
                  const by = b.position('y');
                  let dx = bx - ax;
                  let dy = by - ay;
                  let dist = Math.hypot(dx, dy);
                  if (dist === 0) { dist = 0.01; dx = 0.01; dy = 0; }
                  const minDist = radiusFor(a) + radiusFor(b) + 10;
                  if (dist < minDist) {
                    const push = (minDist - dist) / 2;
                    const ux = dx / dist;
                    const uy = dy / dist;
                    const aLocked = a.locked();
                    const bLocked = b.locked();
                    if (!aLocked) a.position({ x: ax - ux * push, y: ay - uy * push });
                    if (!bLocked) b.position({ x: bx + ux * push, y: by + uy * push });
                    if (!usedRadial && aLocked && bLocked) {
                      try { a.unlock(); b.unlock(); } catch {}
                      a.position({ x: ax - ux * push, y: ay - uy * push });
                      b.position({ x: bx + ux * push, y: by + uy * push });
                      try { a.lock(); b.lock(); } catch {}
                    }
                    moved = true;
                  }
                }
              }
              if (!moved) break;
            }
            // restore lock states
            nodes.forEach(n => { const shouldLock = originalLocks.get(n.id()); try { shouldLock ? n.lock() : n.unlock(); } catch {} });
            try { cy.fit(undefined, 70); } catch {}
          } catch {}
        };
        setTimeout(resolveCollisions, 30);
      } catch {}
    }
  }, [graphData, graphSize]);

  // Build Cytoscape elements from graph data with human-friendly titles
  const cyElements = useMemo(() => {
    // Compute deterministic initial positions to avoid flat line on first render
    const posMap = new Map();
    try {
      const nodesArr = graphData.nodes || [];
      const linksArr = graphData.links || [];
      const groups = nodesArr.filter(n => String(n.label) === 'OktaGroup');
      if (groups.length > 0) {
        // Root center
        const root = groups.find(n => String(n.name || n.title || '').toLowerCase() === 'everyone') || groups[0];
        const center = { x: 0, y: 0 };
        posMap.set(root.id, { x: center.x, y: center.y });
        const others = groups.filter(g => g.id !== root.id);
        const count = others.length;
        const w = graphSize.w || 1400;
        const h = graphSize.h || 800;
        const radius = Math.max(520, Math.min(1100, Math.min(w, h) * 0.38));
        others.forEach((g, idx) => {
          const angle = (2 * Math.PI * idx) / Math.max(1, count);
          posMap.set(g.id, { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) });
        });

        // Build membership map user -> primary group (first memberOf)
        const firstGroupForUser = new Map();
        linksArr.forEach(e => {
          if (String(e.type || '').toLowerCase() === 'memberof') {
            if (!firstGroupForUser.has(e.source) && nodesArr.find(n => n.id === e.source && n.label === 'OktaUser')) {
              firstGroupForUser.set(e.source, e.target);
            }
          }
        });

        // Place users around their primary group
        const byGroup = new Map();
        nodesArr.filter(n => String(n.label) === 'OktaUser').forEach(u => {
          const gid = firstGroupForUser.get(u.id);
          if (!gid) return;
          if (!byGroup.has(gid)) byGroup.set(gid, []);
          byGroup.get(gid).push(u);
        });
        const baseUserRadius = 200; const ringGap = 120; const minUserSpacing = 72;
        byGroup.forEach((users, gid) => {
          const centerPos = posMap.get(gid) || { x: 0, y: 0 };
          // deterministic ordering to avoid layout changing across runs
          users.sort((a, b) => String(a.email || a.id).localeCompare(String(b.email || b.id)));
          // rotate ring 90° off the root edge direction
          const edgeAngle = Math.atan2(centerPos.y - 0, centerPos.x - 0);
          const baseAngle = edgeAngle + Math.PI / 2;
          let r = baseUserRadius; let placed = 0; let ringIndex = 0;
          while (placed < users.length) {
            const capacity = Math.max(8, Math.floor((2 * Math.PI * r) / minUserSpacing));
            for (let i = 0; i < capacity && placed < users.length; i++) {
              const angle = baseAngle + ((2 * Math.PI * i) / capacity) + (ringIndex * 0.17);
              const x = centerPos.x + r * Math.cos(angle);
              const y = centerPos.y + r * Math.sin(angle);
              posMap.set(users[placed].id, { x, y });
              placed++;
            }
            ringIndex++; r += ringGap; if (ringIndex > 40) break;
          }
        });
      }
    } catch {}
    const pickTitle = (n) => {
      const type = n.label || '';
      if (type === 'OktaUser') return n.email || (n.id || '').replace('okta:', '');
      if (type === 'OktaGroup') return n.name || (n.id || '').replace('okta:', '');
      if (type === 'App') return n.name || (n.id || '').replace('app:', '');
      if (type === 'Employee' || type === 'Manager') return n.email || n.employeeId || n.id;
      return n.name || n.title || n.id;
    };
    const nodes = (graphData.nodes || []).map(n => ({ data: { id: n.id, label: n.label, title: pickTitle(n), ...n }, position: posMap.get(n.id) || undefined, classes: n.label ? String(n.label) : '' }));
    const edges = (graphData.links || []).map((e, idx) => ({ data: { id: e.id || `e-${idx}`, source: e.source, target: e.target, label: e.type || 'REL' }, classes: e.type ? String(e.type) : 'rel' }));
    return [...nodes, ...edges];
  }, [graphData]);

  // Helper: ordered keys for node (shared by 2D/3D tooltips)
  const orderedKeysForNode = useMemo(() => (node) => {
    const preferredKeysByLabel = {
      OktaUser: ['email', 'status', 'mfa', 'id'],
      OktaGroup: ['name', 'id'],
      App: ['name', 'provider', 'id']
    };
    const preferred = preferredKeysByLabel[node?.label] || [];
    const keys = Object.keys(node || {}).filter(k => !['id','label','title','color','classes','x','y','z','vx','vy','vz'].includes(k));
    return [...preferred, ...keys.filter(k => !preferred.includes(k))];
  }, []);

  const cyStylesheet = useMemo(() => ([
    { selector: 'node', style: {
      'background-color': '#64748b',
      'width': 18,
      'height': 18,
      'label': 'data(title)',
      'color': '#cfd3dc',
      'font-size': 6,
      'min-zoomed-font-size': 7,
      'text-wrap': 'wrap',
      'text-max-width': 70,
      'text-valign': 'top',
      'text-halign': 'center',
      'text-background-color': '#000',
      'text-background-opacity': 0.25,
      'text-background-shape': 'round-rectangle',
      'text-background-padding': 1,
      'border-width': 1,
      'border-color': '#2f2f2f'
    }},
    { selector: 'edge', style: {
      'width': 1.6,
      'curve-style': 'bezier',
      'target-arrow-shape': 'triangle',
      'arrow-scale': 0.8,
      'line-fill': 'linear-gradient',
      'line-gradient-stop-colors': '#a78bfa #8b5cf6 #6d28d9',
      'line-gradient-stop-positions': '0% 50% 100%',
      // Animated dash flow to mimic AttributeMappingLines motion
      'line-dash-pattern': [4, 6],
      'line-dash-offset': 0,
      'line-cap': 'round',
      'target-arrow-color': '#8b5cf6',
      'opacity': 0.85,
      'underlay-color': '#8b5cf6',
      'underlay-opacity': 0.12,
      'underlay-padding': 2
    }},
    // Node class colors
    // OktaUser nodes: very small with tiny labels
    { selector: '.OktaUser', style: { 'background-color': '#3b82f6', 'width': 8, 'height': 8, 'border-color': '#1e3a8a', 'font-size': 5, 'min-zoomed-font-size': 6, 'text-opacity': 0 }},
    // OktaGroup nodes: slightly larger to stand out as roles
    { selector: '.OktaGroup', style: { 'background-color': '#10b981', 'width': 22, 'height': 22, 'border-color': '#064e3b', 'font-size': 7, 'min-zoomed-font-size': 7 }},
    { selector: '.App', style: { 'background-color': '#f59e0b', 'width': 28, 'height': 28, 'border-color': '#7c2d12' }},
    { selector: '.Employee', style: { 'background-color': '#f59e0b' }},
    // Edge type colors
    { selector: '.memberOf', style: { 'line-gradient-stop-colors': '#a78bfa #8b5cf6 #6d28d9', 'target-arrow-color': '#8b5cf6', 'underlay-color': '#8b5cf6' }},
    { selector: '.uses', style: { 'line-gradient-stop-colors': '#86efac #10b981 #065f46', 'target-arrow-color': '#10b981', 'underlay-color': '#10b981' }},
    { selector: '.identifies', style: { 'line-gradient-stop-colors': '#7dd3fc #38bdf8 #0ea5e9', 'target-arrow-color': '#38bdf8', 'underlay-color': '#38bdf8' }},
    { selector: '.reportsTo', style: { 'line-gradient-stop-colors': '#fda769 #ea580c #c2410c', 'target-arrow-color': '#ea580c', 'underlay-color': '#ea580c' }},
    // Synthetic hierarchy edge for role trees
    { selector: '.extends', style: { 'line-gradient-stop-colors': '#94a3b8 #64748b #334155', 'target-arrow-color': '#94a3b8', 'underlay-color': '#64748b', 'line-dash-pattern': [2, 4] }},
    // Hover/Focus styles
    { selector: 'node.hovered', style: { 'border-width': 2, 'border-color': '#ffffff', 'z-index': 9999, 'text-opacity': 1 }},
    { selector: 'node.showLabel', style: { 'text-opacity': 1 }},
    { selector: 'edge.highlighted', style: { 'width': 5, 'opacity': 1, 'underlay-opacity': 0.3, 'arrow-scale': 1.3 }},
    { selector: 'node.highlighted', style: { 'z-index': 9999 }}
  ]), []);

  // Animate gradient flow along edges and move dashes for directional motion
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    let offset = 0;
    const id = setInterval(() => {
      offset = (offset + 2) % 100;
      const p1 = offset;
      const p2 = (offset + 50) % 100;
      const p3 = (offset + 100) % 100;
      const pos = `${p1}% ${p2}% ${p3}%`;
      try { cy.edges().style('line-gradient-stop-positions', pos); } catch {}
      // Dash offset animation (negative to indicate flow from source to target)
      try { const current = Number(cy.edges().style('line-dash-offset')) || 0; cy.edges().style('line-dash-offset', (current - 1.5)); } catch {}
    }, 60);
    return () => clearInterval(id);
  }, []);

  // Interaction wiring: hover highlights, zoom labels, and selection (rebind on mount/toggle)
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const handleOver = (e) => {
      const n = e.target;
      try {
        n.addClass('hovered');
        n.closedNeighborhood().addClass('highlighted');
        n.connectedEdges().addClass('highlighted');
        const d = n.data();
        setHoverNode(d);
        const rp = n.renderedPosition();
        setHoverPos({ x: rp?.x || 0, y: rp?.y || 0 });
      } catch {}
    };
    const handleOut = (e) => {
      const n = e.target;
      try {
        n.removeClass('hovered');
        n.closedNeighborhood().removeClass('highlighted');
        n.connectedEdges().removeClass('highlighted');
        setHoverNode(null);
      } catch {}
    };
    const handleMove = (e) => {
      try {
        if (!hoverNode) return;
        const rect = graphWrapRef.current?.getBoundingClientRect?.() || { left: 0, top: 0 };
        const cx = e.originalEvent?.clientX || 0;
        const cyv = e.originalEvent?.clientY || 0;
        setHoverPos({ x: cx - rect.left, y: cyv - rect.top });
      } catch {}
    };
    cy.on('mouseover', 'node', handleOver);
    cy.on('mouseout', 'node', handleOut);
    cy.on('mousemove', 'node', handleMove);

    const handleTap = (e) => {
      try {
        if (e.target === cy) {
          // click on background clears pin
          setHoverNode(null); setHoverExpanded(false); setSelectedNode(null);
        } else if (e.target?.data) {
          const d = e.target.data();
          setHoverNode(d); setSelectedNode(d); setHoverExpanded(false);
        }
      } catch {}
    };
    cy.on('tap', 'node', handleTap);
    cy.on('tap', handleTap);

    const updateLabels = () => {
      try {
        const show = cy.zoom() >= 1.2;
        const users = cy.nodes('.OktaUser');
        if (show) users.addClass('showLabel'); else users.removeClass('showLabel');
      } catch {}
    };
    cy.on('zoom', updateLabels);
    setTimeout(updateLabels, 0);

    return () => {
      cy.off('mouseover', 'node', handleOver);
      cy.off('mouseout', 'node', handleOut);
      cy.off('mousemove', 'node', handleMove);
      cy.off('tap', 'node', handleTap);
      cy.off('tap', handleTap);
      cy.off('zoom', updateLabels);
    };
  }, [viewMode, cyElements]);

  return (
    <Box sx={{
      position: 'fixed',
      top: 64,
      left: 0,
      right: 0,
      bottom: 0,
      height: 'calc(100vh - 64px)',
      width: '100vw',
      bgcolor: '#111111',
      color: 'white',
      display: 'flex',
      overflow: 'hidden'
    }}>
      <Box sx={{ display: 'flex', gap: 0, alignItems: 'stretch', height: '100%', width: '100%' }}>
        {/* Sidebar */}
        <Paper sx={{ width: sidebarWidth, transition: 'width 0.2s ease', bgcolor: '#1a1a1a', borderRight: '1px solid #333', borderRadius: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'space-between', p: 1, borderBottom: '1px solid #333' }}>
            {!sidebarCollapsed && (
              <Typography variant="subtitle2" sx={{ color: '#8b5cf6' }}>Graph Queries</Typography>
            )}
            <IconButton size="small" onClick={() => setSidebarCollapsed(c => !c)} sx={{ color: '#8b5cf6' }}>
              {sidebarCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </IconButton>
          </Box>
          {!sidebarCollapsed && (
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto' }}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#888' }}>Saved Query</InputLabel>
                <Select
                  value={preset}
                  label="Preset"
                  onChange={(e) => {
                    const key = e.target.value;
                    setPreset(key);
                    const sel = allPresets.find(p => p.key === key) || {};
                    if (sel.query) setQuery(sel.query);
                    if (sel.mgql) setMgql(sel.mgql);
                    if (Array.isArray(sel.filters)) setFilters(sel.filters);
                  }}
                  sx={{
                    bgcolor: '#0f0f0f',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#333' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#8b5cf6' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#8b5cf6' },
                    '& .MuiSelect-select': { color: 'white' }
                  }}
                >
                  {allPresets.map((p) => (
                    <MenuItem key={p.key} value={p.key}>{p.label}{p.system ? '' : ' (saved)'}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Filters Section */}
              <Box>
                <Typography variant="caption" sx={{ color: '#8b5cf6', mb: 1, display: 'block' }}>Filters</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                  {filters.map((f, idx) => (
                    <Chip key={idx} label={`${f.entity}.${f.attribute} ${f.operator} ${f.value}`} onDelete={() => removeFilter(idx)} sx={{ bgcolor: '#222', color: 'white', border: '1px solid #333' }} />
                  ))}
                  {filters.length === 0 && (
                    <Typography variant="body2" sx={{ color: '#666' }}>No filters</Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button onClick={() => setFilterOpen(true)} variant="outlined" size="small" sx={{ borderColor: '#8b5cf6', color: '#8b5cf6' }}>Add filter</Button>
                  {filters.length > 0 && (
                    <Button onClick={() => setFilters([])} variant="text" size="small" sx={{ color: '#888' }}>Clear</Button>
                  )}
                </Box>
              </Box>

              {/* Save preset moved to bottom */}

              <Box>
                <Typography variant="caption" sx={{ color: '#8b5cf6', mb: 1, display: 'block' }}>MG Query Language (MGQL)</Typography>
                <TextField
                  multiline
                  rows={3}
                  fullWidth
                  value={mgql}
                  onChange={(e) => setMgql(e.target.value)}
                  placeholder="PATH User -memberOf-> Group LIMIT 200"
                  sx={{
                    '& .MuiOutlinedInput-root': { bgcolor: '#0f0f0f', '& fieldset': { borderColor: '#333' }, '&:hover fieldset': { borderColor: '#8b5cf6' }, '&.Mui-focused fieldset': { borderColor: '#8b5cf6' } },
                    '& .MuiInputLabel-root': { color: '#888' }, '& .MuiInputBase-input': { color: 'white' }
                  }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                  <Button onClick={() => setShowAdvanced(s => !s)} variant="text" sx={{ color: '#888' }}>
                    {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
                  </Button>
                  <Button onClick={runMGQL} variant="outlined" disabled={loading} sx={{ borderColor: '#8b5cf6', color: '#8b5cf6' }}>
                    {loading ? 'Running...' : 'Run MGQL'}
                  </Button>
                </Box>
              </Box>

              {showAdvanced && (
                <Box>
                  <Typography variant="caption" sx={{ color: '#8b5cf6', mb: 1, display: 'block' }}>Cypher</Typography>
                  <TextField
                    multiline
                    rows={4}
                    fullWidth
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    label="Cypher Query"
                    sx={{
                      '& .MuiOutlinedInput-root': { bgcolor: '#0f0f0f', '& fieldset': { borderColor: '#333' }, '&:hover fieldset': { borderColor: '#8b5cf6' }, '&.Mui-focused fieldset': { borderColor: '#8b5cf6' } },
                      '& .MuiInputLabel-root': { color: '#888' }, '& .MuiInputBase-input': { color: 'white' }
                    }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                    <Button onClick={runQuery} variant="contained" disabled={loading} sx={{ bgcolor: '#8b5cf6', '&:hover': { bgcolor: '#7c3aed' } }}>
                      {loading ? 'Running...' : 'Run Query'}
                    </Button>
                  </Box>
                </Box>
              )}

              {(!hasGraph) && (
                <Paper sx={{ p: 2, bgcolor: '#2d1b1b', border: '1px solid #442222', color: '#ff6b6b' }}>
                  MG Graph is unavailable. Please check the Neo4j service and your default storage connection.
                </Paper>
              )}
              {error && hasGraph && (
                <Paper sx={{ p: 2, bgcolor: '#2d1b1b', border: '1px solid #442222', color: '#ff6b6b' }}>
                  {error}
                </Paper>
              )}

              {/* Bottom sticky save preset section */}
              <Box sx={{ position: 'sticky', bottom: 0, pt: 2, pb: 2, mt: 'auto', bgcolor: 'transparent', borderTop: '1px solid #333' }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField size="small" fullWidth label="Query name" value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': { bgcolor: '#0f0f0f', '& fieldset': { borderColor: '#333' }, '&:hover fieldset': { borderColor: '#10b981' } },
                      '& .MuiInputLabel-root': { color: '#888' }, '& .MuiInputBase-input': { color: 'white' }
                    }}
                  />
                  <Button onClick={savePreset} variant="contained" sx={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    px: 2.5,
                    '&:hover': { background: 'linear-gradient(135deg, #0ea37a 0%, #047857 100%)' }
                  }}>Save</Button>
                </Box>
              </Box>
              {/* Filter Dialog */}
              <Dialog open={filterOpen} onClose={() => setFilterOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ bgcolor: '#1a1a1a', color: 'white', borderBottom: '1px solid #333' }}>Add Filter</DialogTitle>
                <DialogContent sx={{ bgcolor: '#1a1a1a' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                    <FormControl fullWidth>
                      <InputLabel sx={{ color: '#888' }}>Entity</InputLabel>
                      <Select
                        value={filterDraft.entity}
                        label="Entity"
                        onChange={(e) => {
                          const ent = e.target.value;
                          const firstAttr = (entityAttributeMap[ent] || ['id'])[0];
                          setFilterDraft(d => ({ ...d, entity: ent, attribute: firstAttr }));
                        }}
                        sx={{ bgcolor: '#0f0f0f', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#333' }, '& .MuiSelect-select': { color: 'white' } }}
                      >
                        {Object.keys(entityAttributeMap).map(k => (
                          <MenuItem key={k} value={k}>{k}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl fullWidth>
                      <InputLabel sx={{ color: '#888' }}>Attribute</InputLabel>
                      <Select
                        value={filterDraft.attribute}
                        label="Attribute"
                        onChange={(e) => setFilterDraft(d => ({ ...d, attribute: e.target.value }))}
                        sx={{ bgcolor: '#0f0f0f', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#333' }, '& .MuiSelect-select': { color: 'white' } }}
                      >
                        {(entityAttributeMap[filterDraft.entity] || ['id']).map(a => (
                          <MenuItem key={a} value={a}>{a}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl fullWidth>
                      <InputLabel sx={{ color: '#888' }}>Operator</InputLabel>
                      <Select
                        value={filterDraft.operator}
                        label="Operator"
                        onChange={(e) => setFilterDraft(d => ({ ...d, operator: e.target.value }))}
                        sx={{ bgcolor: '#0f0f0f', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#333' }, '& .MuiSelect-select': { color: 'white' } }}
                      >
                        {operators.map(op => (
                          <MenuItem key={op} value={op}>{op}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <TextField
                      label="Value"
                      value={filterDraft.value}
                      onChange={(e) => setFilterDraft(d => ({ ...d, value: e.target.value }))}
                      sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#0f0f0f', '& fieldset': { borderColor: '#333' } }, '& .MuiInputLabel-root': { color: '#888' }, '& .MuiInputBase-input': { color: 'white' } }}
                    />
                  </Box>
                </DialogContent>
                <DialogActions sx={{ bgcolor: '#1a1a1a', borderTop: '1px solid #333' }}>
                  <Button onClick={() => setFilterOpen(false)} sx={{ color: '#888' }}>Cancel</Button>
                  <Button onClick={addFilter} variant="contained" sx={{ bgcolor: '#8b5cf6', '&:hover': { bgcolor: '#7c3aed' } }}>Add</Button>
                </DialogActions>
              </Dialog>
            </Box>
          )}
        </Paper>

        {/* Graph Canvas */}
        <Paper sx={{ flex: 1, p: 2, bgcolor: '#0f0f0f', borderLeft: '1px solid #333', borderRadius: 0, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle1" sx={{ color: '#8b5cf6' }}>Graph View (nodes: {graphData.nodes.length}, edges: {graphData.links.length})</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button size="small" variant={viewMode==='2d'?'contained':'outlined'} sx={{ bgcolor: viewMode==='2d'?'#8b5cf6':'transparent', borderColor: '#333', color: '#ddd' }} onClick={() => setViewMode('2d')}>2D</Button>
              <Button size="small" variant={viewMode==='3d'?'contained':'outlined'} sx={{ bgcolor: viewMode==='3d'?'#8b5cf6':'transparent', borderColor: '#333', color: '#ddd' }} onClick={() => setViewMode('3d')}>3D</Button>
              <Button size="small" variant="outlined" sx={{ borderColor: '#333', color: '#ddd', minWidth: 36, px: 1 }} onClick={() => { const cy = cyRef.current; if (cy) cy.zoom(cy.zoom() * 1.2); }}>+</Button>
              <Button size="small" variant="outlined" sx={{ borderColor: '#333', color: '#ddd', minWidth: 36, px: 1 }} onClick={() => { const cy = cyRef.current; if (cy) cy.zoom(cy.zoom() / 1.2); }}>-</Button>
              <Button size="small" variant="outlined" sx={{ borderColor: '#333', color: '#ddd' }} onClick={() => { const cy = cyRef.current; if (cy) cy.fit(undefined, 50); }}>Fit</Button>
              <Button size="small" variant="outlined" sx={{ borderColor: '#333', color: '#ddd' }} onClick={() => { const cy = cyRef.current; if (cy) cy.center(); }}>Center</Button>
            </Box>
          </Box>
          <Box ref={graphWrapRef} sx={{ position: 'relative', flex: 1, minHeight: 0, bgcolor: '#0a0a0a', border: '1px solid #222', overflow: 'hidden' }}>
            {viewMode === '2d' && CytoscapeComponent && (
              <CytoscapeComponent
                cy={(cy) => { cyRef.current = cy; try { cy.autoungrabify(true); cy.boxSelectionEnabled(false); cy.panningEnabled(true); cy.userPanningEnabled(true); cy.boxSelectionEnabled(false); cy.zoomingEnabled(true); } catch (_) {} }}
                elements={cyElements}
                style={{ width: (graphSize.w ? graphSize.w + 'px' : '100%'), height: (graphSize.h ? graphSize.h + 'px' : '100%') }}
                layout={{ name: 'preset' }}
                stylesheet={cyStylesheet}
              />
            )}
            {viewMode === '3d' && ForceGraph3D && (
              // ensure only one renderer is mounted
              <ForceGraph3D
                ref={fg3dRef}
                graphData={{
                  nodes: (graphData.nodes || []).map(n => ({ id: n.id, label: n.label, title: (n.name || n.email || n.id), color: n.label === 'OktaGroup' ? '#10b981' : (n.label === 'OktaUser' ? '#3b82f6' : '#999') })),
                  links: (graphData.links || []).map(e => ({ source: e.source, target: e.target }))
                }}
                width={graphSize.w || undefined}
                height={graphSize.h || undefined}
                nodeAutoColorBy={"label"}
                nodeLabel={() => ''}
                linkColor={() => '#8b5cf6'}
                linkOpacity={0.7}
                linkDirectionalArrowLength={2.5}
                linkDirectionalArrowRelPos={1}
                onNodeHover={(n) => {
                  setHover3DNode(n || null);
                }}
                onNodeClick={(n) => { setHover3DNode(n || null); setHover3DExpanded(false); }}
                backgroundColor={'#0a0a0a'}
                warmupTicks={60}
                cooldownTicks={0}
              />
            )}
            {/* Bind a mousemove tracker when 3D is active to place tooltip near pointer */}
            {/* pointer tracking overlay: use pointer events none to avoid stealing drag/rotate */}
            {viewMode === '3d' && (
              <Box
                onMouseMove={(e) => {
                  try {
                    const rect = graphWrapRef.current?.getBoundingClientRect?.() || { left: 0, top: 0 };
                    setHover3DPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                  } catch {}
                }}
                sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
              />
            )}
            {/* 3D Tooltip overlay */}
            {viewMode === '3d' && hover3DNode && (
              <Box sx={{ position: 'absolute', pointerEvents: 'auto', left: (hover3DPos.x ?? 0) + 14, top: (hover3DPos.y ?? 0) + 14, zIndex: 10, maxWidth: 280, backgroundColor: '#0b0b0b', border: '1px solid #333', borderRadius: 1, boxShadow: '0 4px 14px rgba(0,0,0,0.4)', p: 1 }}>
                <Typography variant="caption" sx={{ color: '#a78bfa', fontWeight: 600 }}>
                  {(hover3DNode.name || hover3DNode.email || hover3DNode.title || hover3DNode.id)}
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 0.5 }}>
                  {(hover3DNode.label || hover3DNode.group || 'Node')}
                </Typography>
                {(() => {
                  const keys = orderedKeysForNode(hover3DNode);
                  const limit = hover3DExpanded ? Math.min(keys.length, 20) : Math.min(keys.length, 6);
                  return keys.slice(0, limit).map((k) => (
                    <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                      <Typography variant="caption" sx={{ color: '#9aa3b2' }}>{k}</Typography>
                      <Typography variant="caption" sx={{ color: '#e5e7eb' }}>{String(hover3DNode[k])}</Typography>
                    </Box>
                  ));
                })()}
                {orderedKeysForNode(hover3DNode).length > 6 && (
                  <Button size="small" onClick={() => setHover3DExpanded(e => !e)} sx={{ mt: 0.5, color: '#a78bfa', textTransform: 'none', p: 0, minWidth: 0 }}>
                    {hover3DExpanded ? 'See less' : 'See more'}
                  </Button>
                )}
              </Box>
            )}
            {/* Tooltip overlay */}
            {hoverNode && (
              <Box sx={{ position: 'absolute', pointerEvents: 'auto', left: hoverPos.x + 14, top: hoverPos.y + 14, zIndex: 10, maxWidth: 280, backgroundColor: '#0b0b0b', border: '1px solid #333', borderRadius: 1, boxShadow: '0 4px 14px rgba(0,0,0,0.4)', p: 1 }}>
                <Typography variant="caption" sx={{ color: '#a78bfa', fontWeight: 600 }}>
                  {(hoverNode.name || hoverNode.email || hoverNode.title || hoverNode.id)}
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 0.5 }}>
                  {(hoverNode.label || hoverNode.group || 'Node')}
                </Typography>
                {(() => {
                  const keys = orderedKeysForNode(hoverNode);
                  const limit = hoverExpanded ? Math.min(keys.length, 20) : Math.min(keys.length, 6);
                  return keys.slice(0, limit).map((k) => (
                    <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                      <Typography variant="caption" sx={{ color: '#9aa3b2' }}>{k}</Typography>
                      <Typography variant="caption" sx={{ color: '#e5e7eb' }}>{String(hoverNode[k])}</Typography>
                    </Box>
                  ));
                })()}
                {orderedKeysForNode(hoverNode).length > 6 && (
                  <Button size="small" onClick={() => setHoverExpanded(e => !e)} sx={{ mt: 0.5, color: '#a78bfa', textTransform: 'none', p: 0, minWidth: 0 }}>
                    {hoverExpanded ? 'See less' : 'See more'}
                  </Button>
                )}
              </Box>
            )}
          </Box>
          {selectedNode && (
            <Box sx={{ mt: 1, p: 1, borderTop: '1px solid #222', color: '#ddd', display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: '#8b5cf6' }}>Selected:</Typography>
              <Typography variant="caption">{selectedNode.title || selectedNode.name || selectedNode.email || selectedNode.id}</Typography>
              <Typography variant="caption" sx={{ color: '#888' }}>({selectedNode.label || selectedNode.group || 'Node'})</Typography>
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
};

export default GraphPage;


