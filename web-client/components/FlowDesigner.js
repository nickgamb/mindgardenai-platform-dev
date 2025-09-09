import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, Typography, Box, Chip, Alert, TextField,
  FormControl, InputLabel, Select, MenuItem, IconButton, Paper,
  Accordion, AccordionSummary, AccordionDetails, Divider,
  List, ListItem, ListItemText, ListItemIcon, Grid,
  Card, CardContent, Tabs, Tab, Tooltip, CircularProgress
} from '@mui/material';
import ReactFlow, { 
  addEdge, useNodesState, useEdgesState, 
  Controls, Background, MiniMap, Panel, ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';
import FolderIcon from '@mui/icons-material/Folder';
import StorageIcon from '@mui/icons-material/Storage';
import FilterListIcon from '@mui/icons-material/FilterList';
import ApiIcon from '@mui/icons-material/Api';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ComputerIcon from '@mui/icons-material/Computer';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HttpIcon from '@mui/icons-material/Http';
import CodeIcon from '@mui/icons-material/Code';
import DataObjectIcon from '@mui/icons-material/DataObject';
import LinkIcon from '@mui/icons-material/Link';
import MapIcon from '@mui/icons-material/Map';
import DownloadIcon from '@mui/icons-material/Download';
import ExtensionIcon from '@mui/icons-material/Extension';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

// Import node components
import FileNode from './flow-nodes/FileNode';
import StorageNode from './flow-nodes/StorageNode';
import TransformNode from './flow-nodes/TransformNode';
import APINode from './flow-nodes/APINode';
import AnalyticsNode from './flow-nodes/AnalyticsNode';
import FlowTriggerNode from './flow-nodes/FlowTriggerNode';
import AIToolsNode from './flow-nodes/AIToolsNode';
import VisualPreviewNode from './flow-nodes/VisualPreviewNode';
import PluginsNode from './flow-nodes/PluginsNode';

// Import attribute mapping components
import AttributeMapper from './AttributeMapper';
import APIBodyMapper from './APIBodyMapper';
import StorageMapper from './StorageMapper';
import APIParameterMapper from './APIParameterMapper';
import TransformParameterMapper from './TransformParameterMapper';
import AnalyticsMapper from './AnalyticsMapper';
import VisualPreviewMapper from './VisualPreviewMapper';
import PluginsParameterMapper from './PluginsParameterMapper';
import { edgeTypes } from './FlowConnectorSystem';

// Import API
import AICOREApiClient from '../lib/ai-core-api';
import api from '../lib/api';

// Import schema utilities
import { 
  propagateSchemas, 
  getDefaultOutputSchema, 
  inferSchemaFromData,
  validateMappings, 
  generateAPIInputSchema,
  getAPIEndpointInfo,
  extractTransformScriptParameters,
  generateTransformOutputSchema
} from '../utils/schemaUtils';

const nodeTypes = {
  file: FileNode,
  storage: StorageNode,
  transform: TransformNode,
  api: APINode,
  analytics: AnalyticsNode,
  flow_trigger: FlowTriggerNode,
  ai_tools: AIToolsNode,
  visual_preview: VisualPreviewNode,
  plugins: PluginsNode,
};

const initialNodes = [
  {
    id: 'welcome',
    type: 'default',
    position: { x: 300, y: 200 },
    data: { 
      label: (
        <Box sx={{ textAlign: 'center', p: 2 }}>
          <Typography variant="h6" sx={{ color: '#8b5cf6', mb: 1 }}>
            🚀 MG Flow Designer
          </Typography>
          <Typography variant="body2" sx={{ color: '#888' }}>
            Drag nodes from the sidebar to design your mgflow
          </Typography>
        </Box>
      )
    },
    style: {
      background: '#1a1a1a',
      border: '2px dashed #8b5cf6',
      borderRadius: 12,
      width: 300,
      height: 120,
    },
  },
];

const FlowDesigner = ({ open, onClose, onSave, mgflowData = null }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configData, setConfigData] = useState({});
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [executionStatus, setExecutionStatus] = useState({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState({ completed: 0, total: 0 });
  const [executionResults, setExecutionResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState(null);

  // Schema tracking state
  const [schemaMap, setSchemaMap] = useState({});
  const [attributeMappingDialogOpen, setAttributeMappingDialogOpen] = useState(false);

  // User resources state
  const [userResources, setUserResources] = useState({
    files: [], // was devices
    storage: [],
    transforms: [], // was filters
    apis: [], // was experiments
    analytics: [],
    loading: false,
    error: null
  });

  // Fetch models from ai-core
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setModelsLoading(true);
        setModelsError(null);
        const res = await AICOREApiClient.fetchAICOREModels?.();
        
        if (res && Array.isArray(res.data)) {
          if (res.data.length > 0) {
            setModels(res.data);
            console.log('✅ Loaded models from ai-core:', res.data.length);
          } else {
            setModels([]);
            setModelsError('No models found in ai-core');
            console.warn('⚠️ No models returned from ai-core');
          }
        } else if (res && Array.isArray(res)) {
          // Handle case where response is directly an array
          if (res.length > 0) {
            setModels(res);
            console.log('✅ Loaded models from ai-core (direct array):', res.length);
          } else {
            setModels([]);
            setModelsError('No models found in ai-core');
            console.warn('⚠️ No models returned from ai-core');
          }
        } else {
          setModels([]);
          setModelsError(null); // Don't show error, just use empty dropdown
          console.warn('⚠️ Invalid models response format - AI Tools dropdown will be empty:', res);
        }
      } catch (err) {
        console.warn('⚠️ Error fetching models from ai-core:', err?.message || err);
        
        // Gracefully handle server unavailability - just set empty models
        if (err?.message === 'GNOSISGPT_SERVER_UNAVAILABLE') {
          setModelsError(null); // Don't show error, just use empty dropdown
          console.warn('⚠️ AI-core server unavailable - AI Tools dropdown will be empty');
        } else if (err?.message?.includes('Network Error')) {
          setModelsError(null); // Don't show error, just use empty dropdown
          console.warn('⚠️ Network error connecting to ai-core - AI Tools dropdown will be empty');
        } else if (err?.response?.status === 404) {
          setModelsError(null); // Don't show error, just use empty dropdown
          console.warn('⚠️ Models endpoint not found - AI Tools dropdown will be empty');
        } else if (err?.response?.status === 401) {
          setModelsError(null); // Don't show error, just use empty dropdown
          console.warn('⚠️ Authentication required - AI Tools dropdown will be empty');
        } else {
          setModelsError(null); // Don't show error, just use empty dropdown
          console.warn('⚠️ Failed to load models - AI Tools dropdown will be empty:', err?.message || 'Unknown error');
        }
        
        setModels([]); // Always set empty array instead of crashing
      } finally {
        setModelsLoading(false);
      }
    };

    if (open) {
      fetchModels();
    }
  }, [open]);

  // Fetch user resources when component opens
  useEffect(() => {
    const fetchUserResources = async () => {
      if (!open) return;
      
      try {
        setUserResources(prev => ({ ...prev, loading: true, error: null }));
        
        const [filesRes, storageRes, transformsRes, apisRes, analyticsRes] = await Promise.all([
          api.fetchFiles(),
          api.fetchStorageItems(),
          api.fetchTransforms(),
          api.fetchAPIConnections(),
          api.fetchAnalytics()
        ]);

        setUserResources({
          files: filesRes.files || [],
          storage: storageRes.storage_items || [],
          transforms: transformsRes.transforms || [],
          apis: apisRes.api_connections || [],
          analytics: analyticsRes.analytics || [],
          loading: false,
          error: null
        });
        
        console.log('📚 Loaded user resources:', {
          files: filesRes.files?.length || 0,
          storage: storageRes.storage_items?.length || 0,
          transforms: transformsRes.transforms?.length || 0,
          apis: apisRes.api_connections?.length || 0,
          analytics: analyticsRes.analytics?.length || 0,
        });
      } catch (error) {
        console.error('❌ Error fetching user resources:', error);
        setUserResources(prev => ({ 
          ...prev, 
          loading: false, 
          error: 'Failed to load resources' 
        }));
      }
    };

    fetchUserResources();
  }, [open]);

  // WebSocket listeners for flow execution status
  useEffect(() => {
    if (!open) return;

    // Import socket.io-client dynamically
    import('socket.io-client').then((socketModule) => {
      const io = socketModule.default;
      const socket = io(process.env.NEXT_PUBLIC_API_SERVER_URL, {
        withCredentials: true
      });

      // Join per-user room so we receive user-scoped node/flow status events
      socket.emit('join_user_room');

      // Listen for node execution status
      socket.on('node_status', (data) => {
        console.log('📡 Node status update:', data);
        setExecutionStatus(prev => {
          const newStatus = {
            ...prev,
            [data.node_id]: {
              status: data.status,
              message: data.message,
              timestamp: data.timestamp
            }
          };
          
          // Update progress counter
          const completedNodes = Object.values(newStatus).filter(
            status => status.status === 'success' || status.status === 'error'
          ).length;
          
          // Preserve the original total and startTime; only update completed count
          setExecutionProgress(prev => ({
            ...prev,
            completed: completedNodes
          }));
          
          return newStatus;
        });
      });

      // Listen for overall flow status
      socket.on('flow_status', (data) => {
        console.log('📡 Flow status update:', data);
        if (data.status === 'success' || data.status === 'error') {
          setIsExecuting(false);
          
          // Collect execution results
          const results = {
            status: data.status,
            message: data.message,
            timestamp: data.timestamp,
            nodeResults: { ...executionStatus },
            executionTime: Date.now() - (executionProgress.startTime || Date.now())
          };
          
          setExecutionResults(results);
          setShowResults(true);
        }
      });

      return () => {
        socket.disconnect();
      };
    });
  }, [open]);

  // Load existing mgflow flow
  useEffect(() => {
    if (mgflowData && mgflowData.mgflow_flow) {
      try {
        const flowData = JSON.parse(mgflowData.mgflow_flow);
        if (flowData.nodes && flowData.edges) {
          setNodes(flowData.nodes);
          setEdges(flowData.edges);
        }
      } catch (error) {
        console.error('Error parsing mgflow flow:', error);
      }
    }
  }, [mgflowData, setNodes, setEdges]);

  // Update nodes with execution status
  useEffect(() => {
    setNodes(nds => nds.map(node => ({
      ...node,
      data: {
        ...node.data,
        executionStatus: executionStatus[node.id] || null
      }
    })));
  }, [executionStatus, setNodes]);

  // Connection validation based on handle types
  const isValidConnection = useCallback((connection) => {
    const sourceNode = nodes.find(node => node.id === connection.source);
    const targetNode = nodes.find(node => node.id === connection.target);
    
    if (!sourceNode || !targetNode) return false;
    
    const sourceHandleId = connection.sourceHandle;
    const targetHandleId = connection.targetHandle;
    
    // Import connection rules from connector types
    const { CONNECTION_RULES } = require('../utils/connectorTypes');
    const connectionRules = CONNECTION_RULES;
    
    const validTargets = connectionRules[sourceHandleId] || [];
    return validTargets.includes(targetHandleId);
  }, [nodes]);

  // Update schemas when flow structure changes
  const updateSchemas = useCallback(() => {
    const newSchemaMap = propagateSchemas(nodes, edges);
    setSchemaMap(newSchemaMap);
  }, [nodes, edges]);

  // Update schemas when nodes or edges change
  useEffect(() => {
    updateSchemas();
  }, [nodes, edges]);

  const onConnect = useCallback(
    (params) => {
      setEdges((eds) => addEdge({ 
        ...params, 
        animated: true,
        data: {
          sourceHandle: params.sourceHandle,
          targetHandle: params.targetHandle
        }
      }, eds));
    },
    [setEdges]
  );

  // Handle node selection
  const onSelectionChange = useCallback(({ nodes: selectedNodesList }) => {
    setSelectedNodes(selectedNodesList || []);
  }, []);

  // Handle node click for configuration
  const onNodeClick = useCallback((event, node) => {
    if (node.id === 'welcome') return;
    
    // Check if node is already selected
    const isSelected = selectedNodes.some(selectedNode => selectedNode.id === node.id);
    
    if (isSelected) {
      // If already selected, open config dialog
      console.log('🔧 Opening config for node:', { id: node.id, type: node.type, label: node.data.label });
      setConfigData({
        id: node.id,
        type: node.type,
        label: node.data.label,
        config: node.data.config || {}
      });
      setConfigDialogOpen(true);
    }
    // If not selected, just let the selection happen naturally
  }, [selectedNodes]);

  // Handle keyboard events
  const onKeyDown = useCallback((event) => {
    if (event.key === 'Delete' && selectedNodes.length > 0) {
      // Delete selected nodes (except welcome node)
      const nodesToDelete = selectedNodes.filter(node => node.id !== 'welcome');
      const nodeIds = nodesToDelete.map(node => node.id);
      
      setNodes(nds => nds.filter(node => !nodeIds.includes(node.id)));
      setEdges(eds => eds.filter(edge => 
        !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target)
      ));
      setSelectedNodes([]);
    }
  }, [selectedNodes, setNodes, setEdges]);

  // Add keyboard event listener
  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', onKeyDown);
      return () => document.removeEventListener('keydown', onKeyDown);
    }
  }, [open, onKeyDown]);

  // Helper function to convert node types to proper display names
  const getNodeDisplayName = (nodeType) => {
    if (!nodeType) return 'Unknown';
    
    const names = {
      'file': 'File',
      'transform': 'Transform',
      'api': 'API',
      'storage': 'Storage',
      'analytics': 'Analytics',
      'ai_tools': 'AI Tools',
      'flow_trigger': 'Flow Trigger',
      'visual_preview': 'Visual Preview',
      'plugins': 'Plugins'
    };
    return names[nodeType] || nodeType;
  };

  // Get input and output schemas for a node
  const getNodeSchemas = (nodeId) => {
    if (!nodeId) return { input: [], output: [] };
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { input: [], output: [] };
    
    const nodeData = node.data;
    const nodeType = nodeData?.type;
    
    // For API nodes, use OpenAPI-generated schema if available
    if (nodeType === 'api' && nodeData?.config?.input_schema) {
      return {
        input: nodeData.config.input_schema, // Request body parameters for mapping
        output: getDefaultOutputSchema('api', [], nodeData) // HTTP response data for output
      };
    }
    
    // For transform nodes, use propagated input schema and generate output from script
    if (nodeType === 'transform') {
      const schemas = schemaMap[nodeId] || { input: [], output: [] };
      
      // If a transform script is selected, generate output schema from script
      if (nodeData?.config?.transform_id) {
        const selectedTransform = userResources.transforms.find(t => t.id === nodeData.config.transform_id);
        if (selectedTransform) {
          const scriptOutputSchema = generateTransformOutputSchema(selectedTransform.parameters);
          return {
            input: schemas.input || [], // Use propagated input schema
            output: scriptOutputSchema
          };
        }
      }
      
      // If no script selected, use propagated schemas
      return schemas;
    }
    
    // For analytics nodes, use propagated input schema and script-generated output
    if (nodeType === 'analytics') {
      const schemas = schemaMap[nodeId] || { input: [], output: [] };
      
      // Analytics nodes always output script execution results
      return {
        input: schemas.input || [], // Use propagated input schema
        output: getDefaultOutputSchema('analytics', [], nodeData) // Script execution results
      };
    }
    
    // For visual preview nodes, use propagated input schema and visual content output
    if (nodeType === 'visual_preview') {
      const schemas = schemaMap[nodeId] || { input: [], output: [] };
      
      // Visual preview nodes output visual content
      return {
        input: schemas.input || [], // Use propagated input schema
        output: getDefaultOutputSchema('visual_preview', [], nodeData) // Visual content output
      };
    }
    
    // For AI tools nodes, use propagated input schema and AI output
    if (nodeType === 'ai_tools') {
      const schemas = schemaMap[nodeId] || { input: [], output: [] };
      
      // AI tools nodes output AI processing results
      return {
        input: schemas.input || [], // Use propagated input schema
        output: getDefaultOutputSchema('ai_tools', [], nodeData) // AI processing output
      };
    }
    
    // For plugins nodes, generate dynamic output schema based on selected function
    if (nodeType === 'plugins') {
      const schemas = schemaMap.get(nodeId) || { input: [], output: [] };
      const functionName = nodeData?.config?.function_name;
      
      // Generate output schema based on OAA SDK function
      let outputSchema = [];
      if (functionName === 'create_provider') {
        outputSchema = [
          { name: 'provider_id', type: 'string', description: 'ID of the created provider' },
          { name: 'name', type: 'string', description: 'Name of the provider' },
          { name: 'template', type: 'string', description: 'Provider template' },
          { name: 'status', type: 'string', description: 'Provider status' }
        ];
      } else if (functionName === 'create_data_source') {
        outputSchema = [
          { name: 'data_source_id', type: 'string', description: 'ID of the created data source' },
          { name: 'name', type: 'string', description: 'Name of the data source' },
          { name: 'provider_id', type: 'string', description: 'Associated provider ID' },
          { name: 'status', type: 'string', description: 'Data source status' }
        ];
      } else if (functionName === 'get_provider') {
        outputSchema = [
          { name: 'provider_id', type: 'string', description: 'Provider ID' },
          { name: 'name', type: 'string', description: 'Provider name' },
          { name: 'template', type: 'string', description: 'Provider template' },
          { name: 'icon', type: 'string', description: 'Provider icon' },
          { name: 'created_time', type: 'string', description: 'Creation timestamp' }
        ];
      } else if (functionName === 'datasource_push' || functionName === 'push_metadata') {
        outputSchema = [
          { name: 'push_id', type: 'string', description: 'ID of the push operation' },
          { name: 'status', type: 'string', description: 'Push status' },
          { name: 'records_processed', type: 'number', description: 'Number of records processed' },
          { name: 'message', type: 'string', description: 'Push result message' }
        ];
      } else {
        // Generic plugin output schema
        outputSchema = [
          { name: 'result', type: 'object', description: 'Function execution result' },
          { name: 'status', type: 'string', description: 'Execution status' }
        ];
      }
      
      return {
        input: schemas.input || [],
        output: outputSchema
      };
    }
    
    // For other nodes, use schema map
    const schemas = schemaMap[nodeId] || { input: [], output: [] };
    return schemas;
  };

  // Check if a node type supports attribute mapping
  const nodeSupportsMapping = (nodeType) => {
    if (!nodeType) return false;
    return ['transform', 'api', 'analytics', 'storage', 'ai_tools', 'visual_preview', 'plugins'].includes(nodeType);
  };

  // Get available input sources from connected nodes (for additional context)
  const getInputSources = () => {
    const sources = [];
    
    // Add file node outputs
    if (userResources.files && userResources.files.length > 0) {
      userResources.files.forEach(file => {
        sources.push({
          nodeType: 'file',
          nodeName: file.filename,
          fieldName: 'file_data',
          dataType: 'object',
          path: `file.${file.id}.data`
        });
      });
    }
    
    // Add transform node outputs  
    if (userResources.transforms && userResources.transforms.length > 0) {
      userResources.transforms.forEach(transform => {
        sources.push({
          nodeType: 'transform',
          nodeName: transform.name,
          fieldName: 'transformed_data',
          dataType: 'object',
          path: `transform.${transform.id}.output`
        });
      });
    }
    
    // Add static values
    sources.push({
      nodeType: 'static',
      nodeName: 'Static Value',
      fieldName: 'custom_value',
      dataType: 'string',
      path: 'static.value'
    });
    
    return sources;
  };

  // Helper function to get static function parameters
  const getStaticFunctionParameters = (functionName) => {
    const staticParams = {
      'create_provider': [
        { name: 'name', type: 'string', required: true, description: 'Provider name' },
        { name: 'custom_template', type: 'string', required: true, description: 'Template type (application or identity_provider)' },
        { name: 'base64_icon', type: 'string', required: false, description: 'Base64 encoded icon' },
        { name: 'options', type: 'object', required: false, description: 'Additional options' }
      ],
      'get_provider': [
        { name: 'name', type: 'string', required: true, description: 'Provider name to search for' }
      ],
      'create_data_source': [
        { name: 'name', type: 'string', required: true, description: 'Data source name' },
        { name: 'provider_id', type: 'string', required: true, description: 'Provider ID' },
        { name: 'options', type: 'object', required: false, description: 'Additional options' }
      ],
      'push_metadata': [
        { name: 'provider_name', type: 'string', required: true, description: 'Provider name' },
        { name: 'data_source_name', type: 'string', required: true, description: 'Data source name' },
        { name: 'metadata', type: 'object', required: true, description: 'OAA payload dictionary' },
        { name: 'save_json', type: 'boolean', required: false, description: 'Save JSON to file' },
        { name: 'options', type: 'object', required: false, description: 'Additional options' }
      ],
      'push_application': [
        { name: 'provider_name', type: 'string', required: true, description: 'Provider name' },
        { name: 'data_source_name', type: 'string', required: true, description: 'Data source name' },
        { name: 'application_object', type: 'object', required: true, description: 'OAA application object' },
        { name: 'save_json', type: 'boolean', required: false, description: 'Save JSON to file' },
        { name: 'create_provider', type: 'boolean', required: false, description: 'Create provider if not exists' },
        { name: 'options', type: 'object', required: false, description: 'Additional options' }
      ]
    };
    
    return staticParams[functionName] || [];
  };

  const addNode = useCallback((nodeType) => {
    const newNode = {
      id: `${nodeType}_${Date.now()}`,
      type: nodeType,
      position: { 
        x: Math.random() * 300 + 300, // Center nodes better (300-600 range)
        y: Math.random() * 200 + 200   // Center vertically (200-400 range)
      },
      data: { 
        label: `${getNodeDisplayName(nodeType)} Node`,
        config: {}
      },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [setNodes]);

  const handleSave = () => {
    const filteredNodes = nodes.filter(node => node.id !== 'welcome');
    
    // Generate webhook URLs for webhook trigger nodes
    const processedNodes = filteredNodes.map(node => {
      if (node.type === 'flow_trigger' && 
          node.data?.config?.trigger_type === 'webhook' && 
          !node.data.config.webhook_url) {
        
        // Generate webhook URL using mgflow ID or node ID
        const mgflowId = mgflowData?.id || 'temp-' + Date.now();
        const webhookUrl = `${process.env.NEXT_PUBLIC_API_SERVER_URL}/api/webhooks/trigger/${mgflowId}/${node.id}`;
        
        return {
          ...node,
          data: {
            ...node.data,
            config: {
              ...node.data.config,
              webhook_url: webhookUrl
            }
          }
        };
      }
      return node;
    });
    
    const flowData = {
      nodes: processedNodes,
      edges,
    };
    onSave(JSON.stringify(flowData));
  };

  // Handle flow export
  const handleExport = () => {
    const filteredNodes = nodes.filter(node => node.id !== 'welcome');
    
    // Generate webhook URLs for webhook trigger nodes
    const processedNodes = filteredNodes.map(node => {
      if (node.type === 'flow_trigger' && 
          node.data?.config?.trigger_type === 'webhook' && 
          !node.data.config.webhook_url) {
        
        // Generate webhook URL using mgflow ID or node ID
        const mgflowId = mgflowData?.id || 'temp-' + Date.now();
        const webhookUrl = `${process.env.NEXT_PUBLIC_API_SERVER_URL}/api/webhooks/trigger/${mgflowId}/${node.id}`;
        
        return {
          ...node,
          data: {
            ...node.data,
            config: {
              ...node.data.config,
              webhook_url: webhookUrl
            }
          }
        };
      }
      return node;
    });
    
    const flowData = {
      nodes: processedNodes,
      edges,
    };

    // Create the export data structure (same as what gets saved to database)
    const exportData = {
      mgflow_name: mgflowData?.name || 'Exported Flow',
      description: mgflowData?.description || 'Exported mgflow flow',
      version: '1.0.0',
      created_by: 'MindGarden Platform',
      flow: flowData,
      exported_at: new Date().toISOString(),
      mgflow_id: mgflowData?.id || null
    };

    // Create and download the file
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${mgflowData?.name || 'mgflow-flow'}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle flow execution
  const handleRunFlow = async () => {
    if (isExecuting) return;
    
    setIsExecuting(true);
    
    // Reset execution state
    setExecutionStatus({});
    setExecutionResults(null);
    setShowResults(false);
    const executableNodes = nodes.filter(node => node.id !== 'welcome');
    setExecutionProgress({ 
      completed: 0, 
      total: executableNodes.length,
      startTime: Date.now()
    });
    
    try {
      const flowData = {
        nodes: executableNodes,
        edges,
      };
      
      console.log('🚀 Starting mgflow flow execution...', flowData);
      
      // Call backend API to execute flow
      const response = await api.executeFlow(flowData);
      
      console.log('✅ MGFlow flow execution completed:', response);
      
    } catch (error) {
      console.error('❌ MGFlow flow execution failed:', error);
      setIsExecuting(false);
      
      // Show error in results
      setExecutionResults({
        status: 'error',
        message: `Failed to start flow execution: ${error.message}`,
        timestamp: Date.now(),
        nodeResults: {},
        executionTime: 0
      });
      setShowResults(true);
    }
  };

  // Handle configuration save
  const handleConfigSave = () => {
    setNodes(nds => nds.map(node => 
      node.id === configData.id 
        ? { 
            ...node, 
            data: { 
              ...node.data, 
              label: configData.label,
              config: configData.config 
            }
          }
        : node
    ));
    setConfigDialogOpen(false);
  };

  // Handle configuration close
  const handleConfigClose = () => {
    setConfigDialogOpen(false);
    setConfigData({});
  };

  // Pre-built mgflow templates
  const mgflowTemplates = [
    {
      id: 'oaa-basic',
      name: 'API Data Push',
      description: 'Basic workflow: File → Transform → API Push',
      category: 'OAA',
      nodes: [
        { id: 'trigger', type: 'flow_trigger', position: { x: 100, y: 200 }, data: { label: 'Schedule Trigger', config: { trigger_type: 'schedule' } } },
        { id: 'file', type: 'file', position: { x: 300, y: 200 }, data: { label: 'Source File', config: { file_type: 'csv' } } },
        { id: 'transform', type: 'transform', position: { x: 500, y: 200 }, data: { label: 'Data Transform', config: { transform_type: 'etl' } } },
        { id: 'api', type: 'api', position: { x: 700, y: 200 }, data: { label: 'API Data Push', config: { api_type: 'veza', method: 'POST', endpoint: '/api/v1/oaa/push' } } },
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'file', sourceHandle: 'trigger_output', targetHandle: 'trigger_input' },
        { id: 'e2', source: 'file', target: 'transform', sourceHandle: 'file_output', targetHandle: 'data_input' },
        { id: 'e3', source: 'transform', target: 'api', sourceHandle: 'data_output', targetHandle: 'data_input' },
      ]
    },
    {
      id: 'lcm-onboarding',
      name: 'LCM User Onboarding',
      description: 'Automated user provisioning with LCM policies',
      category: 'LCM',
      nodes: [
        { id: 'trigger', type: 'flow_trigger', position: { x: 100, y: 150 }, data: { label: 'Webhook Trigger', config: { trigger_type: 'webhook' } } },
        { id: 'transform1', type: 'transform', position: { x: 300, y: 150 }, data: { label: 'Validate Data', config: { transform_type: 'validate' } } },
        { id: 'api1', type: 'api', position: { x: 500, y: 100 }, data: { label: 'Create User', config: { api_type: 'veza', method: 'POST' } } },
        { id: 'api2', type: 'api', position: { x: 500, y: 200 }, data: { label: 'Assign Groups', config: { api_type: 'veza', method: 'PUT' } } },
        { id: 'analytics', type: 'analytics', position: { x: 700, y: 150 }, data: { label: 'Onboarding Report', config: { analysis_type: 'provisioning' } } },
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'transform1', sourceHandle: 'trigger_output', targetHandle: 'data_input' },
        { id: 'e2', source: 'transform1', target: 'api1', sourceHandle: 'data_output', targetHandle: 'data_input' },
        { id: 'e3', source: 'transform1', target: 'api2', sourceHandle: 'data_output', targetHandle: 'data_input' },
        { id: 'e4', source: 'api1', target: 'analytics', sourceHandle: 'api_data', targetHandle: 'data_input' },
        { id: 'e5', source: 'api2', target: 'analytics', sourceHandle: 'api_data', targetHandle: 'data_input' },
      ]
    },
    {
      id: 'sandbox-to-prod',
      name: 'Sandbox to Production',
      description: 'Migrate configurations from sandbox to production',
      category: 'Migration',
      nodes: [
        { id: 'trigger', type: 'flow_trigger', position: { x: 100, y: 200 }, data: { label: 'Manual Trigger', config: { trigger_type: 'manual' } } },
        { id: 'api1', type: 'api', position: { x: 300, y: 200 }, data: { label: 'Sandbox Export', config: { api_type: 'veza', method: 'GET' } } },
        { id: 'transform', type: 'transform', position: { x: 500, y: 200 }, data: { label: 'Config Mapping', config: { transform_type: 'map' } } },
        { id: 'storage', type: 'storage', position: { x: 500, y: 300 }, data: { label: 'Backup Config', config: { storage_type: 'blob' } } },
        { id: 'api2', type: 'api', position: { x: 700, y: 200 }, data: { label: 'Production Deploy', config: { api_type: 'veza', method: 'POST' } } },
        { id: 'ai', type: 'ai_tools', position: { x: 700, y: 100 }, data: { label: 'Validate Changes', config: { tool_type: 'validation' } } },
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'api1', sourceHandle: 'trigger_output', targetHandle: 'trigger_input' },
        { id: 'e2', source: 'api1', target: 'transform', sourceHandle: 'api_data', targetHandle: 'data_input' },
        { id: 'e3', source: 'transform', target: 'storage', sourceHandle: 'data_output', targetHandle: 'data_input' },
        { id: 'e4', source: 'transform', target: 'api2', sourceHandle: 'data_output', targetHandle: 'data_input' },
        { id: 'e5', source: 'transform', target: 'ai', sourceHandle: 'data_output', targetHandle: 'data_input' },
      ]
    },
    {
      id: 'bulk-data-migration',
      name: 'Bulk Data Migration',
      description: 'Large-scale data migration with validation and monitoring',
      category: 'Migration',
      nodes: [
        { id: 'trigger', type: 'flow_trigger', position: { x: 100, y: 250 }, data: { label: 'Batch Trigger', config: { trigger_type: 'schedule' } } },
        { id: 'file1', type: 'file', position: { x: 300, y: 200 }, data: { label: 'Source Data 1', config: { file_type: 'csv' } } },
        { id: 'file2', type: 'file', position: { x: 300, y: 300 }, data: { label: 'Source Data 2', config: { file_type: 'csv' } } },
        { id: 'transform1', type: 'transform', position: { x: 500, y: 200 }, data: { label: 'Merge & Clean', config: { transform_type: 'aggregate' } } },
        { id: 'transform2', type: 'transform', position: { x: 500, y: 300 }, data: { label: 'Validate Schema', config: { transform_type: 'validate' } } },
        { id: 'storage', type: 'storage', position: { x: 700, y: 350 }, data: { label: 'Error Logs', config: { storage_type: 'blob' } } },
        { id: 'api', type: 'api', position: { x: 700, y: 200 }, data: { label: 'Bulk Import', config: { api_type: 'veza', method: 'POST' } } },
        { id: 'analytics', type: 'analytics', position: { x: 900, y: 250 }, data: { label: 'Migration Report', config: { analysis_type: 'migration' } } },
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'file1', sourceHandle: 'trigger_output', targetHandle: 'trigger_input' },
        { id: 'e2', source: 'trigger', target: 'file2', sourceHandle: 'trigger_output', targetHandle: 'trigger_input' },
        { id: 'e3', source: 'file1', target: 'transform1', sourceHandle: 'file_output', targetHandle: 'data_input' },
        { id: 'e4', source: 'file2', target: 'transform1', sourceHandle: 'file_output', targetHandle: 'data_input_2' },
        { id: 'e5', source: 'transform1', target: 'transform2', sourceHandle: 'data_output', targetHandle: 'data_input' },
        { id: 'e6', source: 'transform2', target: 'api', sourceHandle: 'data_output', targetHandle: 'data_input' },
        { id: 'e7', source: 'transform2', target: 'storage', sourceHandle: 'error_output', targetHandle: 'data_input' },
        { id: 'e8', source: 'api', target: 'analytics', sourceHandle: 'api_data', targetHandle: 'data_input' },
      ]
    },
    {
      id: 'pagerduty-users-to-oaa',
      name: 'PagerDuty Users → OAA',
      description: 'Manual → PagerDuty Users API → Transform (PagerDuty→OAA) → Veza OAA push',
      category: 'OAA',
      nodes: [
        { id: 'trigger', type: 'flow_trigger', position: { x: 100, y: 200 }, data: { label: 'Manual Trigger', config: { trigger_type: 'manual' } } },
        { id: 'api_pd', type: 'api', position: { x: 320, y: 200 }, data: { label: 'PagerDuty: Get Users', config: { api_type: 'custom', api_name: 'PagerDuty', method: 'GET', endpoint: '/users', parameters: {} } } },
        { id: 'transform_pd', type: 'transform', position: { x: 540, y: 200 }, data: { label: 'Transform: PagerDuty → OAA', config: { transform_type: 'etl', notes: 'Use pagerDutyUsersToOaa; map API data to pdResponse' } } },
        { id: 'plugins_oaa', type: 'plugins', position: { x: 780, y: 200 }, data: { label: 'Veza OAA: push_application', config: { plugin_name: 'oaa_sdk', function_name: 'push_application' } } }
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'api_pd', sourceHandle: 'trigger_output', targetHandle: 'trigger_input' },
        { id: 'e2', source: 'api_pd', target: 'transform_pd', sourceHandle: 'api_data', targetHandle: 'data_input' },
        { id: 'e3', source: 'transform_pd', target: 'plugins_oaa', sourceHandle: 'data_output', targetHandle: 'data_input' }
      ]
    }
  ];

  // Handle template selection
  const handleTemplateSelect = (template) => {
    // Clear existing nodes and edges (except welcome node)
    const welcomeNode = nodes.find(n => n.id === 'welcome');
    const newNodes = welcomeNode ? [welcomeNode, ...template.nodes] : template.nodes;
    
    setNodes(newNodes);
    setEdges(template.edges);
    setTemplateDialogOpen(false);
  };

  const nodeCategories = [
    {
      type: 'file',
      label: 'File',
      icon: <FolderIcon />,
      color: '#10b981',
      description: 'CSV files and data sources'
    },
    {
      type: 'storage',
      label: 'Storage',
      icon: <StorageIcon />,
      color: '#3b82f6',
      description: 'Data storage and retrieval'
    },
    {
      type: 'transform',
      label: 'Transform',
      icon: <FilterListIcon />,
      color: '#f59e0b',
      description: 'Data transformations and ETL'
    },
    {
      type: 'api',
      label: 'API',
      icon: <ApiIcon />,
      color: '#ef4444',
      description: 'API calls and integrations'
    },
    {
      type: 'analytics',
      label: 'Analytics',
      icon: <AnalyticsIcon />,
      color: '#8b5cf6',
      description: 'Data analysis and reporting'
    },
    {
      type: 'flow_trigger',
      label: 'Flow Trigger',
      icon: <PlayArrowIcon />,
      color: '#16a34a',
      description: 'Trigger flow execution'
    },
    {
      type: 'ai_tools',
      label: 'AI Tools',
      icon: <SmartToyIcon />,
      color: '#06b6d4',
      description: 'AI-powered analysis and processing'
    },
    {
      type: 'visual_preview',
      label: 'Visual Preview',
      icon: <VisibilityIcon />,
      color: '#d946ef',
      description: 'Preview plots, charts, and visualizations'
    },
    {
      type: 'plugins',
      label: 'Plugins',
      icon: <ExtensionIcon />,
      color: '#8b5cf6',
      description: 'SDK and library integrations'
    },

  ];

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth={false}
      fullWidth
      PaperProps={{
        sx: {
          width: '95vw',
          height: '90vh',
          maxWidth: 'none',
          bgcolor: '#0f0f0f',
          border: '1px solid #333',
        }
      }}
    >
      <DialogTitle sx={{ 
        color: 'white', 
        borderBottom: '1px solid #333', 
        pb: 2, 
        bgcolor: '#1a1a1a' 
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            🚀 MG Flow Designer
            {mgflowData && (
              <Chip 
                label={mgflowData.name} 
                size="small" 
                sx={{ bgcolor: '#8b5cf6', color: 'white' }}
              />
            )}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              startIcon={<SaveIcon />}
              onClick={handleSave}
              variant="contained"
              sx={{
                bgcolor: '#10b981',
                '&:hover': { bgcolor: '#059669' },
              }}
            >
              Save Flow
            </Button>
            <Button
              startIcon={<DescriptionIcon />}
              onClick={handleExport}
              variant="outlined"
              sx={{
                borderColor: '#8b5cf6',
                color: '#8b5cf6',
                '&:hover': { 
                  borderColor: '#7c3aed',
                  color: '#7c3aed',
                  bgcolor: 'rgba(139, 92, 246, 0.1)'
                },
                minWidth: 'auto',
                px: 2
              }}
            >
              Export Flow
            </Button>
            <IconButton onClick={onClose} sx={{ color: '#888' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ 
        p: 0, 
        bgcolor: '#0f0f0f',
        display: 'flex',
        height: 'calc(90vh - 120px)'
      }}>
        {/* Custom CSS for React Flow Controls */}
        <style>{`
          .dark-controls .react-flow__controls-button {
            background-color: #1a1a1a !important;
            border: 1px solid #333 !important;
            color: white !important;
            transition: all 0.2s ease !important;
          }
          .dark-controls .react-flow__controls-button:hover {
            background-color: #2a2a2a !important;
            border-color: #8b5cf6 !important;
            transform: scale(1.05) !important;
          }
          .dark-controls .react-flow__controls-button svg {
            fill: white !important;
          }
          .dark-controls .react-flow__controls-button:hover svg {
            fill: #8b5cf6 !important;
          }
        `}</style>
        
        {/* Sidebar */}
        <Paper sx={{ 
          width: 280, 
          bgcolor: '#1a1a1a', 
          borderRadius: 0,
          borderRight: '1px solid #333',
          p: 2,
          overflow: 'auto'
        }}>
          <Typography variant="h6" sx={{ color: '#8b5cf6', mb: 2 }}>
            Node Library
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {nodeCategories.map((category) => (
              <Paper
                key={category.type}
                onClick={() => addNode(category.type)}
                sx={{
                  p: 2,
                  bgcolor: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: 2,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: '#333',
                    borderColor: category.color,
                    transform: 'translateY(-2px)',
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Box sx={{ color: category.color }}>
                    {category.icon}
                  </Box>
                  <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 600 }}>
                    {category.label}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: '#888' }}>
                  {category.description}
                </Typography>
              </Paper>
            ))}
          </Box>

          <Box sx={{ mt: 4, p: 2, bgcolor: '#2a2a2a', borderRadius: 2 }}>
            <Typography variant="body2" sx={{ color: '#8b5cf6', fontWeight: 600, mb: 1 }}>
              💡 Quick Tips
            </Typography>
            <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 1 }}>
              • Drag nodes from here to the canvas
            </Typography>
            <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 1 }}>
              • Connect nodes by dragging from connection points
            </Typography>
            <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 1 }}>
              • Click nodes to configure settings
            </Typography>
            <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 1 }}>
              • Select nodes and press <span style={{color: '#8b5cf6', fontWeight: 'bold'}}>Del</span> to remove
            </Typography>
            <Typography variant="caption" sx={{ color: '#888', display: 'block' }}>
              • Save your flow to persist changes
            </Typography>
          </Box>
        </Paper>

        {/* Flow Canvas */}
        <Box sx={{ 
          flex: 1, 
          position: 'relative'
        }}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelectionChange={onSelectionChange}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              connectionMode="loose"
              isValidConnection={isValidConnection}
              fitView
              proOptions={{ hideAttribution: true }}
              style={{
                backgroundColor: '#0f0f0f',
              }}
              defaultEdgeOptions={{
                type: 'animated',
                animated: true
              }}
            >
              <Controls 
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                }}
                className="dark-controls"
              />
              <MiniMap 
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333'
                }}
                nodeColor="#8b5cf6"
                maskColor="rgba(255, 255, 255, 0.1)"
              />
              <Background color="#333" gap={20} />
              
              <Panel position="top-right">
                <Box sx={{ 
                  display: 'flex', 
                  gap: 1, 
                  alignItems: 'center',
                  bgcolor: 'rgba(26, 26, 26, 0.9)',
                  p: 1,
                  borderRadius: 1,
                  border: '1px solid #333'
                }}>
                  <Chip 
                    label={`${nodes.length - 1} nodes`} 
                    size="small" 
                    sx={{ bgcolor: '#333', color: 'white' }}
                  />
                  <Chip 
                    label={`${edges.length} connections`} 
                    size="small" 
                    sx={{ bgcolor: '#333', color: 'white' }}
                  />
                  {nodes.length > 1 && ( // Show Run button if there are nodes (excluding welcome)
                    <Button
                      startIcon={<PlayArrowIcon />}
                      size="small"
                      variant="contained"
                      onClick={handleRunFlow}
                      disabled={isExecuting}
                      sx={{
                        bgcolor: isExecuting ? '#666' : '#10b981',
                        '&:hover': { bgcolor: isExecuting ? '#666' : '#059669' },
                        minWidth: 'auto',
                        px: 2,
                        mr: 1
                      }}
                    >
                      {isExecuting ? 'Running...' : 'Run Flow'}
                    </Button>
                  )}
                  <Button
                    startIcon={<DescriptionIcon />}
                    size="small"
                    variant="outlined"
                    onClick={() => setTemplateDialogOpen(true)}
                    sx={{
                      borderColor: '#8b5cf6',
                      color: '#8b5cf6',
                      '&:hover': { 
                        borderColor: '#7c3aed',
                        color: '#7c3aed',
                        bgcolor: 'rgba(139, 92, 246, 0.1)'
                      },
                      minWidth: 'auto',
                      px: 2
                    }}
                  >
                    Templates
                  </Button>
                  {selectedNodes.length > 0 && (
                    <Button
                      startIcon={<DeleteIcon />}
                      size="small"
                      variant="contained"
                      onClick={() => {
                        const nodesToDelete = selectedNodes.filter(node => node.id !== 'welcome');
                        const nodeIds = nodesToDelete.map(node => node.id);
                        
                        setNodes(nds => nds.filter(node => !nodeIds.includes(node.id)));
                        setEdges(eds => eds.filter(edge => 
                          !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target)
                        ));
                        setSelectedNodes([]);
                      }}
                      sx={{
                        bgcolor: '#ef4444',
                        '&:hover': { bgcolor: '#dc2626' },
                        minWidth: 'auto',
                        px: 1
                      }}
                    >
                      Delete ({selectedNodes.length})
                    </Button>
                  )}
                </Box>
              </Panel>
              

            </ReactFlow>
          </ReactFlowProvider>
        </Box>
      </DialogContent>

      {/* Node Configuration Dialog */}
      <Dialog
        open={configDialogOpen}
        onClose={handleConfigClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1a1a1a',
            border: '1px solid #333',
          }
        }}
      >
        <DialogTitle sx={{ 
          color: 'white', 
          borderBottom: '1px solid #333', 
          bgcolor: '#1a1a1a' 
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SettingsIcon sx={{ color: '#8b5cf6' }} />
            <Typography variant="h6">
              Configure {configData.type?.charAt(0).toUpperCase() + configData.type?.slice(1)} Node
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ bgcolor: '#1a1a1a', color: 'white', pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="Node Label"
              value={configData.label || ''}
              onChange={(e) => setConfigData(prev => ({ ...prev, label: e.target.value }))}
              fullWidth
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#2a2a2a',
                  '& fieldset': { borderColor: '#444' },
                  '&:hover fieldset': { borderColor: '#8b5cf6' },
                  '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
                },
                '& .MuiInputLabel-root': { color: '#888' },
                '& .MuiInputBase-input': { color: 'white' },
              }}
            />

            {/* Node-specific configuration options */}
            {configData.type === 'file' && (
              <>
                <FormControl fullWidth variant="outlined" sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#2a2a2a',
                    '& fieldset': { borderColor: '#444' },
                    '&:hover fieldset': { borderColor: '#10b981' },
                    '&.Mui-focused fieldset': { borderColor: '#10b981' },
                  },
                  '& .MuiInputLabel-root': { color: '#888' },
                  '& .MuiInputBase-input': { color: 'white' },
                }}>
                  <InputLabel>Select File</InputLabel>
                  <Select
                    value={configData.config?.file_name || ''}
                    onChange={async (e) => {
                      const selectedFile = userResources.files.find(f => f.file_name === e.target.value);
                      
                      // Update basic config first
                      setConfigData(prev => ({ 
                        ...prev, 
                        config: { 
                          ...prev.config, 
                          file_name: e.target.value,
                          file_type: selectedFile?.file_type || 'csv',
                          file_id: selectedFile?.id
                        }
                      }));

                      // Detect and store file schema
                      if (selectedFile?.id) {
                        try {
                          const schemaResult = await api.detectSchema({
                            file_id: selectedFile.id,
                            source_type: 'file'
                          });
                          
                          if (schemaResult.schema) {
                            setConfigData(prev => ({ 
                              ...prev, 
                              config: { 
                                ...prev.config, 
                                file_schema: schemaResult.schema
                              }
                            }));
                            
                            // Refresh schema propagation to update connected nodes
                            const newSchemaMap = propagateSchemas(nodes, edges);
                            setSchemaMap(newSchemaMap);
                          }
                        } catch (error) {
                          console.error('Error detecting file schema:', error);
                        }
                      }
                    }}
                    label="Select File"
                  >
                    {userResources.files.map((file) => (
                      <MenuItem key={file.id} value={file.file_name}>
                        {file.file_name} ({file.file_type.toUpperCase()})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </>
            )}

            {configData.type === 'api' && (() => {
              // Get selected API connection details
              const selectedAPI = userResources.apis.find(api => api.id === configData.config?.api_connection_id);
              const availableEndpoints = selectedAPI?.endpoints_available || [];
              const selectedEndpoint = availableEndpoints.find(ep => 
                ep.path === configData.config?.endpoint && ep.method === configData.config?.method
              );
              
              // Debug logging for endpoints
              console.log('🔍 Selected API:', selectedAPI?.name);
              console.log('🔍 Available endpoints count:', availableEndpoints.length);
              console.log('🔍 First few endpoints:', availableEndpoints.slice(0, 3));
              console.log('🔍 Current endpoint:', configData.config?.endpoint);
              console.log('🔍 Current method:', configData.config?.method);
              console.log('🔍 Selected endpoint:', selectedEndpoint);
              console.log('🔍 Selected endpoint parameters:', selectedEndpoint?.parameters);
              
              // Check if we have parameters from OpenAPI spec
              const hasOpenAPIParameters = selectedEndpoint?.parameters && selectedEndpoint.parameters.length > 0;
              console.log('🔍 Has OpenAPI parameters:', hasOpenAPIParameters);
              
              // Generate parameters from endpoint path if none found in OpenAPI
              const generatePathParameters = (endpointPath) => {
                const pathParams = [];
                const matches = endpointPath.match(/\{([^}]+)\}/g);
                if (matches) {
                  matches.forEach(match => {
                    const paramName = match.slice(1, -1); // Remove { and }
                    pathParams.push({
                      name: paramName,
                      in: 'path',
                      required: true,
                      type: 'string',
                      description: `Path parameter: ${paramName}`
                    });
                  });
                }
                return pathParams;
              };
              
              // Get parameters from OpenAPI or generate from path
              const endpointParameters = hasOpenAPIParameters 
                ? selectedEndpoint.parameters 
                : generatePathParameters(configData.config?.endpoint || '');
              
              console.log('🔍 Final endpoint parameters:', endpointParameters);
              
              // Parse expression to find referenced fields
              const parseExpressionFields = (expression) => {
                if (!expression) return [];
                
                const fieldPattern = /(?:row|source\d+)\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
                const matches = [...expression.matchAll(fieldPattern)];
                return matches.map(match => match[1]);
              };
              
              // Generate input schema from OpenAPI specification
              const generateInputSchemaFromOpenAPI = () => {
                if (!selectedAPI?.openapi_spec || !configData.config?.endpoint || !configData.config?.method) {
                  return [];
                }
                
                return generateAPIInputSchema(
                  selectedAPI.openapi_spec,
                  configData.config.endpoint,
                  configData.config.method
                );
              };
              
              // Get current input schema (either from OpenAPI or connected nodes)
              const openAPISchema = generateInputSchemaFromOpenAPI();
              
              // Get input schema from connected nodes
              // Get the actual input schema from connected nodes using the schema map
              const connectedNodeSchema = getNodeSchemas(configData.id).input || [];
              
              // Prioritize connected node schema over OpenAPI schema when there are connected nodes
              // This ensures transform output data is used instead of default OpenAPI schema
              const currentInputSchema = connectedNodeSchema.length > 0 ? connectedNodeSchema : [...openAPISchema, ...connectedNodeSchema];
              
              const inputSources = getInputSources();
              
              return (
                <>
                  {/* API Connection Selection */}
                  <Card sx={{ mb: 2, bgcolor: '#2a2a2a', border: '1px solid #444' }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ color: '#ef4444', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinkIcon sx={{ fontSize: 20 }} />
                        API Connection
                      </Typography>
                      
                      <FormControl fullWidth variant="outlined" sx={{
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: '#1a1a1a',
                          '& fieldset': { borderColor: '#555' },
                          '&:hover fieldset': { borderColor: '#ef4444' },
                          '&.Mui-focused fieldset': { borderColor: '#ef4444' },
                        },
                        '& .MuiInputLabel-root': { color: '#888' },
                        '& .MuiInputBase-input': { color: 'white' },
                      }}>
                        <InputLabel>Select API Connection</InputLabel>
                        <Select
                          value={configData.config?.api_connection_id || ''}
                          onChange={(e) => {
                            const selectedAPI = userResources.apis.find(api => api.id === e.target.value);
                            setConfigData(prev => ({ 
                              ...prev, 
                              config: { 
                                ...prev.config, 
                                api_connection_id: e.target.value,
                                api_name: selectedAPI?.name || '',
                                api_type: selectedAPI?.api_type || 'custom',
                                // Reset endpoint selection when API changes
                                endpoint: '',
                                method: 'POST',
                                parameters: {}
                              }
                            }))
                          }}
                          label="Select API Connection"
                        >
                          {userResources.apis.map((api) => (
                            <MenuItem key={api.id} value={api.id}>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {api.name}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#888' }}>
                                  {api.api_type.toUpperCase()} • {api.endpoints_available?.length || 0} endpoints
                                </Typography>
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      
                      {selectedAPI && (
                        <Box sx={{ mt: 2, p: 2, bgcolor: '#1a1a1a', borderRadius: 1, border: '1px solid #555' }}>
                          <Typography variant="body2" sx={{ color: '#10b981', fontWeight: 500 }}>
                            ✓ Connected to {selectedAPI.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#888' }}>
                            Base URL: {selectedAPI.base_url || 'Configured automatically'}
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>

                  {/* Endpoint Selection */}
                  {selectedAPI && availableEndpoints.length > 0 && (
                    <Card sx={{ mb: 2, bgcolor: '#2a2a2a', border: '1px solid #444' }}>
                      <CardContent>
                        <Typography variant="h6" sx={{ color: '#ef4444', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <HttpIcon sx={{ fontSize: 20 }} />
                          API Endpoint
                        </Typography>
                        
                        <FormControl fullWidth variant="outlined" sx={{
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: '#1a1a1a',
                            '& fieldset': { borderColor: '#555' },
                            '&:hover fieldset': { borderColor: '#ef4444' },
                            '&.Mui-focused fieldset': { borderColor: '#ef4444' },
                          },
                          '& .MuiInputLabel-root': { color: '#888' },
                          '& .MuiInputBase-input': { color: 'white' },
                        }}>
                          <InputLabel>Select Endpoint</InputLabel>
                          <Select
                            value={`${configData.config?.endpoint || ''}|${configData.config?.method || 'GET'}`}
                            onChange={(e) => {
                              const [endpointPath, selectedMethod] = e.target.value.split('|');
                              console.log('🔍 Selected endpoint path:', endpointPath);
                              console.log('🔍 Selected method:', selectedMethod);
                              console.log('🔍 Available endpoints:', availableEndpoints);
                              
                              // Find the exact endpoint info with both path and method
                              let endpointInfo = availableEndpoints.find(ep => 
                                ep.path === endpointPath && ep.method === selectedMethod
                              );
                              
                              console.log('🔍 Found endpoint info:', endpointInfo);
                              
                              if (!endpointInfo) {
                                console.warn('⚠️ No endpoint info found for path:', endpointPath, 'method:', selectedMethod);
                                console.warn('⚠️ Available endpoints with this path:', 
                                  availableEndpoints.filter(ep => ep.path === endpointPath).map(ep => `${ep.method} ${ep.path}`)
                                );
                                
                                // Try to find any endpoint with this path
                                const pathEndpoints = availableEndpoints.filter(ep => ep.path === endpointPath);
                                if (pathEndpoints.length > 0) {
                                  // Use the first one found
                                  endpointInfo = pathEndpoints[0];
                                  console.log('🔍 Using first available endpoint for this path:', endpointInfo);
                                }
                              }
                              
                              // Ensure we have a valid method
                              const finalMethod = endpointInfo?.method || selectedMethod || 'GET';
                              console.log('🔍 Final method to use:', finalMethod);
                              
                              // Generate new input schema for the selected endpoint
                              const newInputSchema = generateAPIInputSchema(
                                selectedAPI?.openapi_spec,
                                endpointPath,
                                finalMethod
                              );
                              
                              console.log('🔍 Using method:', finalMethod);
                              
                              // Clear mappings that are no longer valid with the new schema
                              const currentMappings = configData.config?.attribute_mappings || {};
                              const validMappings = {};
                              
                              Object.entries(currentMappings).forEach(([fieldName, mapping]) => {
                                // Keep mapping if the source field still exists in new schema
                                if (mapping.type === 'direct' && mapping.sourceField) {
                                  const fieldExists = newInputSchema.some(field => field.name === mapping.sourceField);
                                  if (fieldExists) {
                                    validMappings[fieldName] = mapping;
                                  }
                                } else if (mapping.type === 'expression') {
                                  // For expressions, check if referenced fields still exist
                                  const referencedFields = parseExpressionFields(mapping.expression || '');
                                  const allFieldsExist = referencedFields.every(field => 
                                    newInputSchema.some(schemaField => schemaField.name === field)
                                  );
                                  if (allFieldsExist) {
                                    validMappings[fieldName] = mapping;
                                  }
                                } else {
                                  // Keep non-field-dependent mappings (constant, etc.)
                                  validMappings[fieldName] = mapping;
                                }
                              });
                              
                              setConfigData(prev => ({ 
                                ...prev, 
                                config: { 
                                  ...prev.config, 
                                  endpoint: endpointPath,
                                  method: finalMethod,
                                  // Update input schema
                                  input_schema: newInputSchema,
                                  // Clear invalid mappings
                                  attribute_mappings: validMappings,
                                  // Clear parameter mappings when endpoint changes
                                  parameters: {}
                                }
                              }));
                            }}
                            label="Select Endpoint"
                          >
                            {availableEndpoints.map((endpoint, index) => (
                              <MenuItem key={index} value={`${endpoint.path}|${endpoint.method}`}>
                                <Box sx={{ width: '100%' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                    <Chip 
                                      label={endpoint.method} 
                                      size="small" 
                                      sx={{ 
                                        bgcolor: endpoint.method === 'GET' ? '#2563eb' : 
                                                endpoint.method === 'POST' ? '#16a34a' :
                                                endpoint.method === 'PUT' ? '#ea580c' :
                                                endpoint.method === 'DELETE' ? '#dc2626' : '#6b7280',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        minWidth: '60px'
                                      }} 
                                    />
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                      {endpoint.path}
                                    </Typography>
                                  </Box>
                                  {endpoint.summary && (
                                    <Typography variant="caption" sx={{ color: '#888', display: 'block' }}>
                                      {endpoint.summary}
                                    </Typography>
                                  )}
                                </Box>
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        
                        {selectedEndpoint && (
                          <Box sx={{ mt: 2, p: 2, bgcolor: '#1a1a1a', borderRadius: 1, border: '1px solid #555' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <Chip 
                                label={selectedEndpoint.method} 
                                size="small" 
                                sx={{ 
                                  bgcolor: selectedEndpoint.method === 'GET' ? '#2563eb' : 
                                          selectedEndpoint.method === 'POST' ? '#16a34a' :
                                          selectedEndpoint.method === 'PUT' ? '#ea580c' :
                                          selectedEndpoint.method === 'DELETE' ? '#dc2626' : '#6b7280',
                                  color: 'white',
                                  fontWeight: 'bold'
                                }} 
                              />
                              <Typography variant="body2" sx={{ color: 'white', fontWeight: 500 }}>
                                {selectedEndpoint.path}
                              </Typography>
                            </Box>
                            {selectedEndpoint.description && (
                              <Typography variant="caption" sx={{ color: '#888' }}>
                                {selectedEndpoint.description}
                              </Typography>
                            )}
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Manual Endpoint Entry (fallback) */}
                  {selectedAPI && availableEndpoints.length === 0 && (
                    <Card sx={{ mb: 2, bgcolor: '#2a2a2a', border: '1px solid #444' }}>
                      <CardContent>
                        <Typography variant="h6" sx={{ color: '#ef4444', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CodeIcon sx={{ fontSize: 20 }} />
                          Manual Endpoint Configuration
                        </Typography>
                        
                        <Alert severity="info" sx={{ mb: 2, bgcolor: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa' }}>
                          No endpoints discovered from OpenAPI spec. Configure manually below.
                        </Alert>
                        
                        <Grid container spacing={2}>
                          <Grid item xs={4}>
                            <FormControl fullWidth variant="outlined" sx={{
                              '& .MuiOutlinedInput-root': {
                                backgroundColor: '#1a1a1a',
                                '& fieldset': { borderColor: '#555' },
                                '&:hover fieldset': { borderColor: '#ef4444' },
                                '&.Mui-focused fieldset': { borderColor: '#ef4444' },
                              },
                              '& .MuiInputLabel-root': { color: '#888' },
                              '& .MuiInputBase-input': { color: 'white' },
                            }}>
                              <InputLabel>Method</InputLabel>
                              <Select
                                value={configData.config?.method || 'POST'}
                                onChange={(e) => {
                                  const newMethod = e.target.value;
                                  // Regenerate input schema with new method
                                  const newInputSchema = generateAPIInputSchema(
                                    selectedAPI?.openapi_spec,
                                    configData.config?.endpoint || '',
                                    newMethod
                                  );
                                  
                                  setConfigData(prev => ({ 
                                    ...prev, 
                                    config: { 
                                      ...prev.config, 
                                      method: newMethod,
                                      input_schema: newInputSchema,
                                      // Clear parameter mappings when method changes
                                      parameters: {}
                                    }
                                  }));
                                }}
                                label="Method"
                              >
                                <MenuItem value="GET">GET</MenuItem>
                                <MenuItem value="POST">POST</MenuItem>
                                <MenuItem value="PUT">PUT</MenuItem>
                                <MenuItem value="DELETE">DELETE</MenuItem>
                                <MenuItem value="PATCH">PATCH</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={8}>
                            <TextField
                              label="Endpoint Path"
                              value={configData.config?.endpoint || ''}
                              onChange={(e) => setConfigData(prev => ({ 
                                ...prev, 
                                config: { ...prev.config, endpoint: e.target.value }
                              }))}
                              fullWidth
                              variant="outlined"
                              placeholder="/api/v1/endpoint"
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  backgroundColor: '#1a1a1a',
                                  '& fieldset': { borderColor: '#555' },
                                  '&:hover fieldset': { borderColor: '#ef4444' },
                                  '&.Mui-focused fieldset': { borderColor: '#ef4444' },
                                },
                                '& .MuiInputLabel-root': { color: '#888' },
                                '& .MuiInputBase-input': { color: 'white' },
                              }}
                            />
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  )}

                  {/* API Parameter Mapping */}
                  {(endpointParameters?.length > 0 || configData.config?.endpoint) && (
                    <APIParameterMapper
                      configData={configData}
                      setConfigData={setConfigData}
                      inputSources={inputSources}
                      endpointParameters={endpointParameters}
                      selectedAPI={selectedAPI}
                      inputSchema={currentInputSchema}
                    />
                  )}

                  {/* API Body Mapping */}
                  {configData.config?.endpoint &&                   (() => {
                    console.log('🔍 API Body Mapping: Saved body_parameters', configData.config?.body_parameters);
                    console.log('🔍 API Body Mapping: Saved body_mappings', configData.config?.body_mappings);
                    return (
                      <Box sx={{ mt: 3 }}>
                        <Divider sx={{ bgcolor: '#444', mb: 3 }} />
                        <APIBodyMapper
                          inputSchema={currentInputSchema}
                          bodyParameters={configData.config?.body_parameters || []}
                          mappings={configData.config?.body_mappings || {}}
                          onMappingsChange={(newMappings, newOutputSchema) => {
                            setConfigData(prev => ({
                              ...prev,
                              config: {
                                ...prev.config,
                                body_mappings: newMappings,
                                body_parameters: newOutputSchema || prev.config?.body_parameters || []
                              }
                            }));
                          }}
                          onRefreshSchema={() => {
                            // Refresh schemas by re-running propagation
                            const newSchemaMap = propagateSchemas(nodes, edges);
                            setSchemaMap(newSchemaMap);
                          }}
                        />
                      </Box>
                    );
                  })()}

                  {/* (Info panel removed per request) */}

                  {/* Data Flow Preview */}
                  {configData.config?.endpoint && (
                    <Card sx={{ bgcolor: '#2a2a2a', border: '1px solid #444' }}>
                      <CardContent>
                        <Typography variant="h6" sx={{ color: '#ef4444', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <DataObjectIcon sx={{ fontSize: 20 }} />
                          Request Preview
                        </Typography>
                        
                        <Box sx={{ p: 2, bgcolor: '#0a0a0a', borderRadius: 1, border: '1px solid #555' }}>
                          <Typography variant="body2" sx={{ color: '#10b981', fontFamily: 'monospace', mb: 1 }}>
                            {(() => {
                              const method = (configData.config?.method || 'POST');
                              const base = (selectedAPI?.base_url || '');
                              const path = (configData.config?.endpoint || '');
                              const params = configData.config?.parameters || {};
                              const entries = Object.entries(params).filter(([k, v]) => v && (v.value !== undefined && v.value !== ''));
                              const qs = entries.length > 0
                                ? ('?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v.value))}`).join('&'))
                                : '';
                              return `${method} ${base}${path}${qs}`;
                            })()}
                          </Typography>
                          
                          {selectedEndpoint?.parameters && Object.keys(configData.config?.parameters || {}).length > 0 && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 1 }}>
                                Mapped Parameters:
                              </Typography>
                              {Object.entries(configData.config?.parameters || {}).map(([paramName, paramConfig]) => (
                                paramConfig.source && (
                                  <Typography key={paramName} variant="caption" sx={{ color: '#60a5fa', fontFamily: 'monospace', display: 'block' }}>
                                    {paramName}: {paramConfig.source === 'static.value' ? `"${paramConfig.value}"` : `{{${paramConfig.source}}}`}
                                  </Typography>
                                )
                              ))}
                            </Box>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  )}
                </>
              );
            })()}

            {configData.type === 'transform' && (
              <>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                  <FormControl fullWidth variant="outlined" sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#2a2a2a',
                      '& fieldset': { borderColor: '#444' },
                      '&:hover fieldset': { borderColor: '#f59e0b' },
                      '&.Mui-focused fieldset': { borderColor: '#f59e0b' },
                    },
                    '& .MuiInputLabel-root': { color: '#888' },
                    '& .MuiInputBase-input': { color: 'white' },
                  }}>
                    <InputLabel>Transform Script</InputLabel>
                    <Select
                      value={configData.config?.transform_id || ''}
                      onChange={(e) => {
                        const selectedTransform = userResources.transforms.find(t => t.id === e.target.value);
                        
                        // Generate script output schema if transform is selected
                        const scriptOutputSchema = selectedTransform ? 
                          generateTransformOutputSchema(selectedTransform.parameters) : [];
                        
                        // Update config with transform selection and output schema
                        setConfigData(prev => ({ 
                          ...prev, 
                          config: { 
                            ...prev.config, 
                            transform_id: e.target.value,
                            transform_name: selectedTransform?.name || '',
                            transform_type: selectedTransform?.transform_type || 'etl',
                            output_schema: scriptOutputSchema  // Store for getDefaultOutputSchema
                          }
                        }));
                        
                        // Update schema map for this node, preserving the input schema
                        if (selectedTransform) {
                          setSchemaMap(prev => {
                            const currentSchemas = prev[configData.id] || { input: [], output: [] };
                            return {
                              ...prev,
                              [configData.id]: {
                                input: currentSchemas.input || [], // Preserve propagated input schema
                                output: scriptOutputSchema
                              }
                            };
                          });
                          
                          // Trigger schema propagation to update downstream nodes
                          setTimeout(() => {
                            const newSchemaMap = propagateSchemas(nodes, edges);
                            setSchemaMap(newSchemaMap);
                          }, 0);
                        }
                      }}
                      label="Transform Script"
                    >
                      {userResources.transforms.map((transform) => (
                        <MenuItem key={transform.id} value={transform.id}>
                          {transform.name} ({transform.transform_type.toUpperCase()})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  
                  {configData.config?.transform_id && (
                    <Tooltip title="Remove script">
                      <IconButton
                        onClick={() => {
                          setConfigData(prev => ({ 
                            ...prev, 
                            config: { 
                              ...prev.config, 
                              transform_id: '',
                              transform_name: '',
                              transform_type: ''
                            }
                          }));
                          
                          // Reset to default input-to-output mapping
                          setSchemaMap(prev => {
                            const currentSchemas = prev[configData.id] || { input: [], output: [] };
                            return {
                              ...prev,
                              [configData.id]: {
                                input: currentSchemas.input || [],
                                output: currentSchemas.input || [] // Default to input schema for output
                              }
                            };
                          });
                          
                          // Trigger schema propagation to update downstream nodes
                          setTimeout(() => {
                            const newSchemaMap = propagateSchemas(nodes, edges);
                            setSchemaMap(newSchemaMap);
                          }, 0);
                        }}
                        sx={{ 
                          color: '#f59e0b', 
                          '&:hover': { bgcolor: 'rgba(245, 158, 11, 0.1)' },
                          mb: 1
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </>
            )}

            {/* Storage selection (place before mapping UI) */}
            {configData.type === 'storage' && (
              <FormControl fullWidth variant="outlined" sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#2a2a2a',
                  '& fieldset': { borderColor: '#444' },
                  '&:hover fieldset': { borderColor: '#06b6d4' },
                  '&.Mui-focused fieldset': { borderColor: '#06b6d4' },
                },
                '& .MuiInputLabel-root': { color: '#888' },
                '& .MuiInputBase-input': { color: 'white' },
                mb: 2
              }}>
                <InputLabel>Storage Item</InputLabel>
                <Select
                  value={configData.config?.storage_id || ''}
                  onChange={(e) => {
                    const selectedStorage = userResources.storage.find(s => s.id === e.target.value);
                    setConfigData(prev => ({ 
                      ...prev, 
                      config: { 
                        ...prev.config, 
                        storage_id: e.target.value,
                        storage_name: selectedStorage?.file_name || '',
                        storage_type: selectedStorage?.file_type || 'data'
                      }
                    }))
                  }}
                  label="Storage Item"
                >
                  {userResources.storage.map((storage) => (
                    <MenuItem key={storage.id} value={storage.id}>
                      {storage.file_name} ({storage.file_type})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Attribute Mapping Section */}
            {nodeSupportsMapping(configData?.type) && configData && (
              <Box sx={{ mt: 3 }}>
                <Divider sx={{ bgcolor: '#444', mb: 3 }} />
                {/* Graph-specific options when selected storage is graph */}
                {configData.type === 'storage' && (configData.config?.storage_type === 'graph' || configData.config?.storage_type === 'neo4j' || configData.config?.storage_type === 'graph_connection') && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="h6" sx={{ color: '#8b5cf6', mb: 2 }}>Graph Mapping</Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setConfigData(prev => ({
                          ...prev,
                          config: {
                            ...prev.config,
                            graph_node_label: 'User',
                            graph_id_field: 'id',
                            database_schema: [
                              { name: 'id', type: 'string' },
                              { name: 'email', type: 'string' },
                              { name: 'source', type: 'string' }
                            ]
                          }
                        }))}
                        sx={{ borderColor: '#8b5cf6', color: '#8b5cf6' }}
                      >User preset</Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setConfigData(prev => ({
                          ...prev,
                          config: {
                            ...prev.config,
                            graph_node_label: 'Group',
                            graph_id_field: 'id',
                            database_schema: [
                              { name: 'id', type: 'string' },
                              { name: 'name', type: 'string' },
                              { name: 'source', type: 'string' }
                            ]
                          }
                        }))}
                        sx={{ borderColor: '#10b981', color: '#10b981' }}
                      >Group preset</Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setConfigData(prev => ({
                          ...prev,
                          config: {
                            ...prev.config,
                            graph_node_label: 'App',
                            graph_id_field: 'id',
                            database_schema: [
                              { name: 'id', type: 'string' },
                              { name: 'name', type: 'string' },
                              { name: 'provider', type: 'string' }
                            ]
                          }
                        }))}
                        sx={{ borderColor: '#3b82f6', color: '#3b82f6' }}
                      >App preset</Button>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <TextField
                        label="Node Label"
                        value={configData.config?.graph_node_label || 'Record'}
                        onChange={(e) => setConfigData(prev => ({
                          ...prev,
                          config: { ...prev.config, graph_node_label: e.target.value }
                        }))}
                        sx={{
                          '& .MuiOutlinedInput-root': { bgcolor: '#2a2a2a', '& fieldset': { borderColor: '#444' }, '&:hover fieldset': { borderColor: '#8b5cf6' }, '&.Mui-focused fieldset': { borderColor: '#8b5cf6' } },
                          '& .MuiInputLabel-root': { color: '#888' },
                          '& .MuiInputBase-input': { color: 'white' },
                          minWidth: 220
                        }}
                      />
                      <TextField
                        label="ID Field"
                        value={configData.config?.graph_id_field || 'id'}
                        onChange={(e) => setConfigData(prev => ({
                          ...prev,
                          config: { ...prev.config, graph_id_field: e.target.value }
                        }))}
                        sx={{
                          '& .MuiOutlinedInput-root': { bgcolor: '#2a2a2a', '& fieldset': { borderColor: '#444' }, '&:hover fieldset': { borderColor: '#8b5cf6' }, '&.Mui-focused fieldset': { borderColor: '#8b5cf6' } },
                          '& .MuiInputLabel-root': { color: '#888' },
                          '& .MuiInputBase-input': { color: 'white' },
                          minWidth: 220
                        }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
                      <TextField
                        label="Relationship Type"
                        value={configData.config?.graph_relationship?.type || ''}
                        onChange={(e) => setConfigData(prev => ({
                          ...prev,
                          config: { ...prev.config, graph_relationship: { ...(prev.config?.graph_relationship || {}), type: e.target.value } }
                        }))}
                        sx={{
                          '& .MuiOutlinedInput-root': { bgcolor: '#2a2a2a', '& fieldset': { borderColor: '#444' }, '&:hover fieldset': { borderColor: '#8b5cf6' }, '&.Mui-focused fieldset': { borderColor: '#8b5cf6' } },
                          '& .MuiInputLabel-root': { color: '#888' },
                          '& .MuiInputBase-input': { color: 'white' },
                          minWidth: 220
                        }}
                      />
                      <TextField
                        label="From Label"
                        value={configData.config?.graph_relationship?.from?.label || ''}
                        onChange={(e) => setConfigData(prev => ({
                          ...prev,
                          config: { ...prev.config, graph_relationship: { ...(prev.config?.graph_relationship || {}), from: { ...(prev.config?.graph_relationship?.from || {}), label: e.target.value } } }
                        }))}
                        sx={{
                          '& .MuiOutlinedInput-root': { bgcolor: '#2a2a2a', '& fieldset': { borderColor: '#444' }, '&:hover fieldset': { borderColor: '#8b5cf6' }, '&.Mui-focused fieldset': { borderColor: '#8b5cf6' } },
                          '& .MuiInputLabel-root': { color: '#888' },
                          '& .MuiInputBase-input': { color: 'white' },
                          minWidth: 200
                        }}
                      />
                      <TextField
                        label="From ID Field"
                        value={configData.config?.graph_relationship?.from?.idField || ''}
                        onChange={(e) => setConfigData(prev => ({
                          ...prev,
                          config: { ...prev.config, graph_relationship: { ...(prev.config?.graph_relationship || {}), from: { ...(prev.config?.graph_relationship?.from || {}), idField: e.target.value } } }
                        }))}
                        sx={{
                          '& .MuiOutlinedInput-root': { bgcolor: '#2a2a2a', '& fieldset': { borderColor: '#444' }, '&:hover fieldset': { borderColor: '#8b5cf6' }, '&.Mui-focused fieldset': { borderColor: '#8b5cf6' } },
                          '& .MuiInputLabel-root': { color: '#888' },
                          '& .MuiInputBase-input': { color: 'white' },
                          minWidth: 200
                        }}
                      />
                      <TextField
                        label="To Label"
                        value={configData.config?.graph_relationship?.to?.label || ''}
                        onChange={(e) => setConfigData(prev => ({
                          ...prev,
                          config: { ...prev.config, graph_relationship: { ...(prev.config?.graph_relationship || {}), to: { ...(prev.config?.graph_relationship?.to || {}), label: e.target.value } } }
                        }))}
                        sx={{
                          '& .MuiOutlinedInput-root': { bgcolor: '#2a2a2a', '& fieldset': { borderColor: '#444' }, '&:hover fieldset': { borderColor: '#8b5cf6' }, '&.Mui-focused fieldset': { borderColor: '#8b5cf6' } },
                          '& .MuiInputLabel-root': { color: '#888' },
                          '& .MuiInputBase-input': { color: 'white' },
                          minWidth: 200
                        }}
                      />
                      <TextField
                        label="To ID Field"
                        value={configData.config?.graph_relationship?.to?.idField || ''}
                        onChange={(e) => setConfigData(prev => ({
                          ...prev,
                          config: { ...prev.config, graph_relationship: { ...(prev.config?.graph_relationship || {}), to: { ...(prev.config?.graph_relationship?.to || {}), idField: e.target.value } } }
                        }))}
                        sx={{
                          '& .MuiOutlinedInput-root': { bgcolor: '#2a2a2a', '& fieldset': { borderColor: '#444' }, '&:hover fieldset': { borderColor: '#8b5cf6' }, '&.Mui-focused fieldset': { borderColor: '#8b5cf6' } },
                          '& .MuiInputLabel-root': { color: '#888' },
                          '& .MuiInputBase-input': { color: 'white' },
                          minWidth: 200
                        }}
                      />
                    </Box>
                  </Box>
                )}
                
                {/* Use TransformParameterMapper for transform nodes */}
                {configData.type === 'transform' ? (
                  (() => {
                    const selectedTransform = userResources.transforms.find(t => t.id === configData.config?.transform_id);
                    const scriptParameters = selectedTransform ? extractTransformScriptParameters(selectedTransform.parameters) : [];
                    const currentInputSchema = getNodeSchemas(configData.id).input;
                    const currentOutputSchema = getNodeSchemas(configData.id).output;
                    
                    return (
                      <TransformParameterMapper
                        configData={configData}
                        setConfigData={setConfigData}
                        scriptParameters={scriptParameters}
                        selectedTransform={selectedTransform}
                        inputSchema={currentInputSchema}
                        onRefreshSchema={() => {
                          // For transform nodes, refresh schemas by re-running propagation
                          const newSchemaMap = propagateSchemas(nodes, edges);
                          setSchemaMap(newSchemaMap);
                        }}
                      />
                    );
                  })()
                ) : configData.type === 'storage' ? (
                  (() => {
                    console.log('🔍 Storage Mapper: Saved database_schema', configData.config?.database_schema);
                    console.log('🔍 Storage Mapper: Saved storage_mappings', configData.config?.storage_mappings);
                    return (
                      <StorageMapper
                        inputSchema={getNodeSchemas(configData.id).input}
                        databaseSchema={configData.config?.database_schema || []}
                        mappings={configData.config?.storage_mappings || {}}
                        onMappingsChange={(newMappings, newDatabaseSchema) => {
                          setConfigData(prev => ({
                            ...prev,
                            config: {
                              ...prev.config,
                              storage_mappings: newMappings,
                              database_schema: newDatabaseSchema || prev.config?.database_schema || []
                            }
                          }));
                        }}
                        onRefreshSchema={() => {
                          // Refresh schemas by re-running propagation
                          const newSchemaMap = propagateSchemas(nodes, edges);
                          setSchemaMap(newSchemaMap);
                        }}
                      />
                    );
                  })()
                ) : configData.type === 'plugins' ? (
                  <Box>
                    <Typography variant="h6" sx={{ color: '#8b5cf6', mb: 2 }}>
                      Plugin Configuration
                    </Typography>
                    
                    {/* Plugin Selection */}
                    <FormControl fullWidth sx={{ mb: 3 }}>
                      <InputLabel>Plugin</InputLabel>
                      <Select
                        value={configData.config?.plugin_name || ''}
                        onChange={(e) => {
                          setConfigData(prev => ({
                            ...prev,
                            config: {
                              ...prev.config,
                              plugin_name: e.target.value,
                              function_name: '', // Reset function when plugin changes
                              parameter_mappings: {},
                              api_connection_id: '' // Reset connection when plugin changes
                            }
                          }));
                        }}
                        label="Plugin"
                      >
                        <MenuItem value="oaa_sdk">Veza OAA SDK</MenuItem>
                        <MenuItem value="okta_sdk">Okta SDK</MenuItem>
                      </Select>
                    </FormControl>

                    {/* API Connection Selection for OAA SDK */}
                    {(configData.config?.plugin_name === 'oaa_sdk' || configData.config?.plugin_name === 'okta_sdk') && (
                      <FormControl fullWidth sx={{ mb: 3 }}>
                        <InputLabel>{configData.config?.plugin_name === 'okta_sdk' ? 'Okta API Connection' : 'Veza API Connection'}</InputLabel>
                        <Select
                          value={configData.config?.api_connection_id || ''}
                          onChange={(e) => {
                            setConfigData(prev => ({
                              ...prev,
                              config: {
                                ...prev.config,
                                api_connection_id: e.target.value
                              }
                            }));
                          }}
                          label={configData.config?.plugin_name === 'okta_sdk' ? 'Okta API Connection' : 'Veza API Connection'}
                        >
                          {userResources.apis
                            .filter(api => (configData.config?.plugin_name === 'okta_sdk' ? (api.api_type === 'okta' || api.api_type === 'custom') : (api.api_type === 'veza' || api.api_type === 'rest')))
                            .map((api) => (
                            <MenuItem key={api.id} value={api.id}>
                              {api.name} ({api.base_url})
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}

                    {/* Function Selection */}
                    {configData.config?.plugin_name && configData.config?.api_connection_id && (
                      <FormControl fullWidth sx={{ mb: 3 }}>
                        <InputLabel>Function</InputLabel>
                        <Select
                          value={configData.config?.function_name || ''}
                          onChange={(e) => {
                            setConfigData(prev => ({
                              ...prev,
                              config: {
                                ...prev.config,
                                function_name: e.target.value,
                                parameter_mappings: {} // Reset mappings when function changes
                              }
                            }));
                            
                            // Trigger schema propagation since function change affects output schema
                            setTimeout(() => {
                              const newSchemaMap = propagateSchemas(nodes, edges);
                              setSchemaMap(newSchemaMap);
                            }, 0);
                          }}
                          label="Function"
                        >
                          <MenuItem value="create_provider">Create Provider</MenuItem>
                          <MenuItem value="get_provider">Get Provider</MenuItem>
                          <MenuItem value="create_data_source">Create Data Source</MenuItem>
                          <MenuItem value="push_metadata">Push Metadata</MenuItem>
                          <MenuItem value="push_application">Push Application</MenuItem>
                        </Select>
                      </FormControl>
                    )}

                    {/* Parameter Mapping */}
                    {configData.config?.plugin_name && configData.config?.function_name && configData.config?.api_connection_id && (
                      <Box sx={{ mt: 3 }}>
                        <Typography variant="h6" sx={{ color: '#8b5cf6', mb: 2 }}>
                          Plugin Parameter Mapping
                        </Typography>
                        <PluginsParameterMapper
                          inputSchema={getNodeSchemas(configData.id).input}
                          selectedPlugin={{ name: configData.config.plugin_name }}
                          selectedFunction={{ name: configData.config.function_name }}
                          functionParameters={getStaticFunctionParameters(configData.config.function_name)}
                          configData={configData}
                          setConfigData={setConfigData}
                          onRefreshSchema={() => {
                            const newSchemaMap = propagateSchemas(nodes, edges);
                            setSchemaMap(newSchemaMap);
                          }}
                        />
                      </Box>
                    )}
                  </Box>
                ) : configData.type !== 'api' && configData.type !== 'visual_preview' && configData.type !== 'analytics' && configData.type !== 'transform' && configData.type !== 'storage' && configData.type !== 'plugins' ? (
                  <AttributeMapper
                    inputSchema={getNodeSchemas(configData.id).input}
                    outputSchema={getNodeSchemas(configData.id).output}
                    mappings={configData.config?.attribute_mappings || configData.config?.mappings || {}}
                    onMappingsChange={(newMappings, newOutputSchema) => {
                      setConfigData(prev => ({
                        ...prev,
                        config: {
                          ...prev.config,
                          attribute_mappings: newMappings,
                          mappings: newMappings, // Keep both for compatibility
                          output_schema: newOutputSchema || prev.config?.output_schema
                        }
                      }));
                    }}
                    onRefreshSchema={() => {
                      // For other nodes, refresh schemas by re-running propagation
                      const newSchemaMap = propagateSchemas(nodes, edges);
                      setSchemaMap(newSchemaMap);
                    }}
                    allowSchemaEditing={configData.type === 'transform'}
                    nodeType={configData.type}
                    title={`${getNodeDisplayName(configData.type)} Attribute Mapping`}
                  />
                ) : null}
              </Box>
            )}

            {configData.type === 'analytics' && (
              <>
                <FormControl fullWidth variant="outlined" sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#2a2a2a',
                    '& fieldset': { borderColor: '#444' },
                    '&:hover fieldset': { borderColor: '#8b5cf6' },
                    '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
                  },
                  '& .MuiInputLabel-root': { color: '#888' },
                  '& .MuiInputBase-input': { color: 'white' },
                }}>
                  <InputLabel>Analytics Report</InputLabel>
                  <Select
                    value={configData.config?.analytics_id || ''}
                    onChange={(e) => {
                      const selectedAnalytics = userResources.analytics.find(a => a.id === e.target.value);
                      setConfigData(prev => ({ 
                        ...prev, 
                        config: { 
                          ...prev.config, 
                          analytics_id: e.target.value,
                          analytics_name: selectedAnalytics?.name || '',
                          analysis_type: selectedAnalytics?.analysis_type || 'report'
                        }
                      }))
                    }}
                    label="Analytics Report"
                  >
                    {userResources.analytics.map((analytics) => (
                      <MenuItem key={analytics.id} value={analytics.id}>
                        {analytics.name} ({analytics.analysis_type})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                {/* Analytics Parameter Mapping */}
                {configData.config?.analytics_id && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="h6" sx={{ color: '#8b5cf6', mb: 2 }}>
                      Analytics Parameter Mapping
                    </Typography>
                    <AnalyticsMapper
                      inputSchema={getNodeSchemas(configData.id).input}
                      selectedAnalytics={userResources.analytics.find(a => a.id === configData.config.analytics_id)}
                      configData={configData}
                      onMappingsChange={(newConfig) => {
                        setConfigData(prev => ({
                          ...prev,
                          config: {
                            ...prev.config,
                            ...newConfig
                          }
                        }));
                      }}
                      onRefreshSchema={() => {
                        const newSchemaMap = propagateSchemas(nodes, edges);
                        setSchemaMap(newSchemaMap);
                      }}
                    />
                  </Box>
                )}
              </>
            )}

            {configData.type === 'flow_trigger' && (
              <Box>
                <Typography variant="h6" sx={{ color: '#16a34a', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PlayArrowIcon sx={{ fontSize: 20 }} />
                  Flow Trigger Configuration
                </Typography>

                {/* Trigger Type Selection */}
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel sx={{ color: '#888' }}>Trigger Type</InputLabel>
                  <Select
                    value={configData.config?.trigger_type || 'manual'}
                    onChange={(e) => setConfigData(prev => ({ 
                      ...prev, 
                      config: { 
                        ...prev.config, 
                        trigger_type: e.target.value,
                        // Clear type-specific configs when changing types
                        schedule_date: undefined,
                        schedule_time: undefined,
                        webhook_url: undefined
                      }
                    }))}
                    label="Trigger Type"
                    sx={{
                      bgcolor: '#1a1a1a',
                      '& fieldset': { borderColor: '#333' },
                      '&:hover fieldset': { borderColor: '#16a34a' },
                      '&.Mui-focused fieldset': { borderColor: '#16a34a' },
                      '& .MuiSelect-select': { color: 'white' }
                    }}
                  >
                    <MenuItem value="manual">
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          Manual Trigger
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#888' }}>
                          Execute flow manually using the play button
                        </Typography>
                      </Box>
                    </MenuItem>
                    <MenuItem value="scheduled">
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          Scheduled Trigger
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#888' }}>
                          Execute flow automatically at a specific time
                        </Typography>
                      </Box>
                    </MenuItem>
                    <MenuItem value="webhook">
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          Webhook Trigger
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#888' }}>
                          Execute flow via HTTP webhook URL
                        </Typography>
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>

                {/* Trigger Name */}
                <TextField
                  label="Trigger Name"
                  value={configData.config?.trigger_name || ''}
                  onChange={(e) => setConfigData(prev => ({ 
                    ...prev, 
                    config: { ...prev.config, trigger_name: e.target.value }
                  }))}
                  fullWidth
                  sx={{ 
                    mb: 3,
                    '& .MuiOutlinedInput-root': { 
                      bgcolor: '#1a1a1a', 
                      '& fieldset': { borderColor: '#333' },
                      '&:hover fieldset': { borderColor: '#16a34a' },
                      '&.Mui-focused fieldset': { borderColor: '#16a34a' }
                    },
                    '& .MuiInputLabel-root': { color: '#888' },
                    '& .MuiInputBase-input': { color: 'white' }
                  }}
                  placeholder="Enter a descriptive name for this trigger"
                />

                {/* Scheduled Trigger Configuration */}
                {configData.config?.trigger_type === 'scheduled' && (
                  <Box sx={{ p: 2, bgcolor: '#0f1419', borderRadius: 1, border: '1px solid #333', mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ color: '#16a34a', mb: 2 }}>
                      Schedule Configuration
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <TextField
                          label="Schedule Date"
                          type="date"
                          value={configData.config?.schedule_date || ''}
                          onChange={(e) => setConfigData(prev => ({ 
                            ...prev, 
                            config: { ...prev.config, schedule_date: e.target.value }
                          }))}
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                          sx={{
                            '& .MuiOutlinedInput-root': { 
                              bgcolor: '#1a1a1a', 
                              '& fieldset': { borderColor: '#333' },
                              '&:hover fieldset': { borderColor: '#16a34a' },
                              '&.Mui-focused fieldset': { borderColor: '#16a34a' }
                            },
                            '& .MuiInputLabel-root': { color: '#888' },
                            '& .MuiInputBase-input': { color: 'white' }
                          }}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          label="Schedule Time"
                          type="time"
                          value={configData.config?.schedule_time || ''}
                          onChange={(e) => setConfigData(prev => ({ 
                            ...prev, 
                            config: { ...prev.config, schedule_time: e.target.value }
                          }))}
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                          sx={{
                            '& .MuiOutlinedInput-root': { 
                              bgcolor: '#1a1a1a', 
                              '& fieldset': { borderColor: '#333' },
                              '&:hover fieldset': { borderColor: '#16a34a' },
                              '&.Mui-focused fieldset': { borderColor: '#16a34a' }
                            },
                            '& .MuiInputLabel-root': { color: '#888' },
                            '& .MuiInputBase-input': { color: 'white' }
                          }}
                        />
                      </Grid>
                    </Grid>
                    <Typography variant="caption" sx={{ color: '#888', display: 'block', mt: 1 }}>
                      Flow will be scheduled to run automatically at the specified date and time.
                    </Typography>
                  </Box>
                )}

                {/* Webhook Trigger Configuration */}
                {configData.config?.trigger_type === 'webhook' && (
                  <Box sx={{ p: 2, bgcolor: '#0f1419', borderRadius: 1, border: '1px solid #333', mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ color: '#16a34a', mb: 2 }}>
                      Webhook Configuration
                    </Typography>
                    <Alert severity="info" sx={{ 
                      bgcolor: 'rgba(59, 130, 246, 0.1)', 
                      color: '#60a5fa',
                      mb: 2,
                      '& .MuiAlert-icon': { color: '#60a5fa' }
                    }}>
                      Webhook URL will be generated after saving the flow.
                    </Alert>
                    {configData.config?.webhook_url && (
                      <Box sx={{ p: 2, bgcolor: '#1a1a1a', borderRadius: 1, border: '1px solid #16a34a' }}>
                        <Typography variant="body2" sx={{ color: '#16a34a', mb: 1, fontWeight: 500 }}>
                          Webhook URL:
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TextField
                            value={configData.config.webhook_url}
                            fullWidth
                            InputProps={{ readOnly: true }}
                            sx={{
                              '& .MuiOutlinedInput-root': { 
                                bgcolor: '#0f0f0f', 
                                '& fieldset': { borderColor: '#333' }
                              },
                              '& .MuiInputBase-input': { color: 'white', fontFamily: 'monospace', fontSize: '0.875rem' }
                            }}
                          />
                          <Button
                            onClick={() => navigator.clipboard.writeText(configData.config.webhook_url)}
                            variant="outlined"
                            sx={{ 
                              color: '#16a34a', 
                              borderColor: '#16a34a',
                              '&:hover': { borderColor: '#16a34a', bgcolor: 'rgba(22, 163, 74, 0.1)' }
                            }}
                          >
                            Copy
                          </Button>
                        </Box>
                        <Typography variant="caption" sx={{ color: '#888', display: 'block', mt: 1 }}>
                          Send a POST request to this URL to trigger the flow execution.
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}
                <Box sx={{ p: 2, bgcolor: '#0f0f0f', border: '1px solid #333', borderRadius: 1, mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ color: '#8b5cf6', mb: 1 }}>Graph monitor (MGQL)</Typography>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Graph Storage</InputLabel>
                    <Select
                      value={configData.config?.graph_storage_id || ''}
                      label="Graph Storage"
                      onChange={(e) => setConfigData(prev => ({ ...prev, config: { ...prev.config, graph_storage_id: e.target.value } }))}
                    >
                      {userResources.storage.filter(s => s.file_type === 'graph').map(s => (
                        <MenuItem key={s.id} value={s.id}>{s.file_name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth sx={{ mb: 1 }}>
                    <InputLabel>Graph Query</InputLabel>
                    <Select
                      value={configData.config?.mgql_preset || ''}
                      label="Graph Query"
                      onChange={(e) => {
                        const key = e.target.value;
                        setConfigData(prev => ({ ...prev, config: { ...prev.config, mgql_preset: key } }));
                      }}
                    >
                      {Object.entries(presets || {}).map(([k, v]) => (
                        <MenuItem key={k} value={k}>{v.label || k}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    label="MGQL"
                    value={configData.config?.mgql || ''}
                    onChange={(e) => setConfigData(prev => ({ ...prev, config: { ...prev.config, mgql: e.target.value } }))}
                    fullWidth
                    multiline
                    rows={3}
                    sx={{
                      '& .MuiOutlinedInput-root': { bgcolor: '#1a1a1a', '& fieldset': { borderColor: '#333' } },
                      '& .MuiInputLabel-root': { color: '#888' },
                      '& .MuiInputBase-input': { color: 'white' }
                    }}
                  />
                  <Box sx={{ display: 'flex', gap: 2, mt: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <TextField
                      label="Poll interval (sec)"
                      type="number"
                      value={configData.config?.monitor_interval || 60}
                      onChange={(e) => setConfigData(prev => ({ ...prev, config: { ...prev.config, monitor_interval: parseInt(e.target.value || '60') } }))}
                      sx={{
                        '& .MuiOutlinedInput-root': { bgcolor: '#1a1a1a', '& fieldset': { borderColor: '#333' } },
                        '& .MuiInputLabel-root': { color: '#888' },
                        '& .MuiInputBase-input': { color: 'white' }
                      }}
                    />
                    <TextField
                      label="Condition (count > N)"
                      value={configData.config?.monitor_condition || 'count > 0'}
                      onChange={(e) => setConfigData(prev => ({ ...prev, config: { ...prev.config, monitor_condition: e.target.value } }))}
                      sx={{
                        '& .MuiOutlinedInput-root': { bgcolor: '#1a1a1a', '& fieldset': { borderColor: '#333' } },
                        '& .MuiInputLabel-root': { color: '#888' },
                        '& .MuiInputBase-input': { color: 'white' }
                      }}
                    />
                    <Button
                      variant="contained"
                      onClick={async () => {
                        try {
                          const monitorPayload = {
                            flow: exportFlowToJSON(),
                            trigger_node_id: configData.id,
                            monitor: {
                              storage_id: configData.config?.graph_storage_id || null,
                              mgql: configData.config?.mgql || '',
                              interval_seconds: configData.config?.monitor_interval || 60
                            }
                          };
                          const res = await api.createFlowMonitor(monitorPayload);
                          setConfigData(prev => ({ ...prev, config: { ...prev.config, monitor_id: res.monitor_id } }));
                        } catch (e) {
                          console.error('Failed to start monitor', e);
                        }
                      }}
                      sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}
                    >Start monitor</Button>
                    <Button
                      variant="outlined"
                      onClick={async () => {
                        try {
                          if (configData.config?.monitor_id) {
                            await api.deleteFlowMonitor(configData.config.monitor_id);
                            setConfigData(prev => ({ ...prev, config: { ...prev.config, monitor_id: '' } }));
                          }
                        } catch (e) {
                          console.error('Failed to stop monitor', e);
                        }
                      }}
                      sx={{ borderColor: '#ef4444', color: '#ef4444' }}
                    >Stop monitor</Button>
                  </Box>
                </Box>
              </Box>
            )}

            {configData.type === 'visual_preview' && (
              <VisualPreviewMapper
                inputSchema={getNodeSchemas(configData.id).input}
                outputSchema={getNodeSchemas(configData.id).output}
                mappings={configData.config?.mappings || {}}
                onMappingsChange={(newMappings, newOutputSchema) => {
                  setConfigData(prev => ({
                    ...prev,
                    config: {
                      ...prev.config,
                      mappings: newMappings
                    }
                  }));
                  
                  if (newOutputSchema) {
                    setSchemaMap(prev => ({
                      ...prev,
                      [configData.id]: {
                        ...prev[configData.id],
                        output: newOutputSchema
                      }
                    }));
                  }
                }}
                onRefreshSchema={() => {
                  // Trigger schema refresh if needed
                  propagateSchemas();
                }}
                nodeType="visual_preview"
              />
            )}

            {configData.type === 'ai_tools' && (
              <Box>
                <Typography variant="h6" sx={{ color: '#8b5cf6', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SmartToyIcon sx={{ fontSize: 20 }} />
                  AI Tools Configuration
                </Typography>
                
                {/* Model Selection */}
                <FormControl fullWidth variant="outlined" sx={{ mb: 3, 
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#2a2a2a',
                    '& fieldset': { borderColor: '#444' },
                    '&:hover fieldset': { borderColor: '#8b5cf6' },
                    '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
                  },
                  '& .MuiInputLabel-root': { color: '#888' },
                  '& .MuiInputBase-input': { color: 'white' },
                }}>
                  <InputLabel>AI Model</InputLabel>
                  <Select
                    value={configData.config?.model_id || ''}
                    onChange={(e) => {
                      const selectedModel = userResources?.models?.find(m => m.id === e.target.value);
                      setConfigData(prev => ({ 
                        ...prev, 
                        config: { 
                          ...prev.config, 
                          model_id: e.target.value,
                          model_name: selectedModel?.name || '',
                          model_type: selectedModel?.model_type || 'llm'
                        }
                      }))
                    }}
                    label="AI Model"
                  >
                    <MenuItem value="">
                      <em>Select a model (optional)</em>
                    </MenuItem>
                    {models?.length > 0 ? (
                      models.map((model) => (
                        <MenuItem key={model.id} value={model.id}>
                          {model.name} ({model.model_type})
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem value="" disabled>
                        <em>No models available</em>
                      </MenuItem>
                    )}
                  </Select>
                </FormControl>
                
                {/* Prompt Configuration */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ color: 'white', mb: 2 }}>
                    Prompt Configuration
                  </Typography>
                  
                  <TextField
                    fullWidth
                    multiline
                    rows={6}
                    label="AI Prompt"
                    value={configData.config?.prompt || ''}
                    onChange={(e) => setConfigData(prev => ({ 
                      ...prev, 
                      config: { 
                        ...prev.config, 
                        prompt: e.target.value
                      }
                    }))}
                                            placeholder="Enter your AI prompt here. You can use input fields as variables like {'{{fieldName}}'}"
                    variant="outlined"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#2a2a2a',
                        '& fieldset': { borderColor: '#444' },
                        '&:hover fieldset': { borderColor: '#8b5cf6' },
                        '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
                      },
                      '& .MuiInputLabel-root': { color: '#888' },
                      '& .MuiInputBase-input': { color: 'white' },
                    }}
                  />
                  
                  {/* Available Input Fields */}
                  {getNodeSchemas(configData.id).input.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" sx={{ color: '#888', mb: 1 }}>
                        Available input fields (use as {'{{fieldName}}'} in prompt):
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {getNodeSchemas(configData.id).input
                          .filter(field => field && field.name) // Filter out invalid fields
                          .map((field) => (
                          <Chip
                            key={field.name}
                            label={`{{${field.name}}}`}
                            size="small"
                            sx={{ 
                              bgcolor: '#8b5cf6', 
                              color: 'white',
                              fontSize: '0.7rem',
                              cursor: 'pointer',
                              '&:hover': { bgcolor: '#7c3aed' }
                            }}
                            onClick={() => {
                              const currentPrompt = configData.config?.prompt || '';
                              const newPrompt = currentPrompt + `{{${field.name}}}`;
                              setConfigData(prev => ({ 
                                ...prev, 
                                config: { 
                                  ...prev.config, 
                                  prompt: newPrompt
                                }
                              }));
                            }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ bgcolor: '#1a1a1a', borderTop: '1px solid #333' }}>
          <Button onClick={handleConfigClose} sx={{ color: '#888' }}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfigSave}
            variant="contained"
            sx={{
              bgcolor: '#8b5cf6',
              '&:hover': { bgcolor: '#7c3aed' },
            }}
          >
            Save Configuration
          </Button>
        </DialogActions>
      </Dialog>

      {/* Template Selection Dialog */}
      <Dialog 
        open={templateDialogOpen} 
        onClose={() => setTemplateDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { 
            bgcolor: '#1a1a1a', 
            color: 'white',
            border: '1px solid #333'
          }
        }}
      >
        <DialogTitle sx={{ color: '#8b5cf6', fontWeight: 600 }}>
          Choose MGFlow Template
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#888', mb: 3 }}>
            Start with a pre-built template for common mgflow scenarios
          </Typography>
          
          {['OAA', 'LCM', 'Migration'].map(category => {
            const categoryTemplates = mgflowTemplates.filter(t => t.category === category);
            return (
              <Box key={category} sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ color: '#8b5cf6', mb: 2 }}>
                  {category} Templates
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
                  {categoryTemplates.map(template => (
                    <Paper
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      sx={{
                        p: 2,
                        bgcolor: '#2a2a2a',
                        border: '1px solid #444',
                        borderRadius: 2,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: '#333',
                          borderColor: '#8b5cf6',
                          transform: 'translateY(-2px)',
                        }
                      }}
                    >
                      <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 600, mb: 1 }}>
                        {template.name}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#888', mb: 2 }}>
                        {template.description}
                      </Typography>
                      <Chip 
                        label={`${template.nodes.length} nodes`} 
                        size="small" 
                        sx={{ 
                          bgcolor: '#8b5cf6', 
                          color: 'white',
                          fontSize: '0.7rem'
                        }} 
                      />
                    </Paper>
                  ))}
                </Box>
              </Box>
            );
          })}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button 
            onClick={() => setTemplateDialogOpen(false)}
            sx={{ color: '#888' }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Flow Execution Progress Overlay */}
      {isExecuting && (
        <Box sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <Paper sx={{
            p: 4,
            bgcolor: '#1a1a1a',
            border: '1px solid #8b5cf6',
            borderRadius: 2,
            minWidth: 400,
            textAlign: 'center',
            position: 'relative'
          }}>
            {/* Close/Dismiss execution overlay */}
            <IconButton
              onClick={() => setIsExecuting(false)}
              sx={{ position: 'absolute', top: 8, right: 8, color: '#888' }}
              aria-label="Close execution status"
            >
              <CloseIcon />
            </IconButton>
            <Typography variant="h6" sx={{ color: '#8b5cf6', mb: 2 }}>
              🚀 Executing Flow
            </Typography>
            <Typography variant="body2" sx={{ color: '#888', mb: 3 }}>
              {executionProgress.completed} of {executionProgress.total} nodes completed
            </Typography>
            
            {/* Progress Bar */}
            <Box sx={{ width: '100%', mb: 3 }}>
              <Box sx={{
                height: 8,
                bgcolor: '#333',
                borderRadius: 4,
                overflow: 'hidden'
              }}>
                <Box sx={{
                  height: '100%',
                  bgcolor: '#8b5cf6',
                  width: `${(executionProgress.completed / Math.max(executionProgress.total, 1)) * 100}%`,
                  transition: 'width 0.3s ease'
                }} />
              </Box>
            </Box>

            {/* Current Node Status */}
            <Box sx={{ textAlign: 'left' }}>
              {Object.entries(executionStatus).map(([nodeId, status]) => {
                const node = nodes.find(n => n.id === nodeId);
                const nodeName = node?.data?.label || nodeId;
                
                return (
                  <Box key={nodeId} sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1, 
                    mb: 1,
                    p: 1,
                    bgcolor: status.status === 'error' ? '#2d1b1b' : 
                             status.status === 'success' ? '#1b2d1b' : 
                             status.status === 'running' ? '#1b1b2d' : '#1a1a1a',
                    borderRadius: 1,
                    border: `1px solid ${
                      status.status === 'error' ? '#ef4444' : 
                      status.status === 'success' ? '#22c55e' : 
                      status.status === 'running' ? '#8b5cf6' : '#333'
                    }`
                  }}>
                    {status.status === 'running' && (
                      <CircularProgress size={16} sx={{ color: '#8b5cf6' }} />
                    )}
                    {status.status === 'success' && (
                      <CheckCircleIcon sx={{ fontSize: 16, color: '#22c55e' }} />
                    )}
                    {status.status === 'error' && (
                      <ErrorIcon sx={{ fontSize: 16, color: '#ef4444' }} />
                    )}
                    <Typography variant="body2" sx={{ 
                      color: status.status === 'error' ? '#ff6b6b' : 
                             status.status === 'success' ? '#4ade80' : 
                             '#ffffff',
                      fontSize: '0.85rem'
                    }}>
                      {nodeName}: {status.message || status.status}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Paper>
        </Box>
      )}

      {/* Flow Execution Results Dialog */}
      <Dialog
        open={showResults}
        onClose={() => setShowResults(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1a1a1a',
            color: '#ffffff',
            border: '1px solid #333'
          }
        }}
      >
        <DialogTitle sx={{ 
          color: executionResults?.status === 'error' ? '#ef4444' : '#22c55e',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          {executionResults?.status === 'error' ? (
            <ErrorIcon sx={{ fontSize: 24 }} />
          ) : (
            <CheckCircleIcon sx={{ fontSize: 24 }} />
          )}
          Flow Execution {executionResults?.status === 'error' ? 'Failed' : 'Completed'}
        </DialogTitle>
        
        <DialogContent>
          {executionResults && (
            <Box>
              <Typography variant="body1" sx={{ mb: 3 }}>
                {executionResults.message}
              </Typography>
              
              <Typography variant="subtitle2" sx={{ color: '#8b5cf6', mb: 2 }}>
                Execution Summary
              </Typography>
              
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, bgcolor: '#2a2a2a' }}>
                    <Typography variant="caption" sx={{ color: '#888' }}>
                      Total Nodes
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#ffffff' }}>
                      {executionProgress.total}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, bgcolor: '#2a2a2a' }}>
                    <Typography variant="caption" sx={{ color: '#888' }}>
                      Execution Time
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#ffffff' }}>
                      {Math.round(executionResults.executionTime / 1000)}s
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Typography variant="subtitle2" sx={{ color: '#8b5cf6', mb: 2 }}>
                Node Results
              </Typography>
              
              <List>
                {Object.entries(executionResults.nodeResults || {}).map(([nodeId, status]) => {
                  const node = nodes.find(n => n.id === nodeId);
                  const nodeName = node?.data?.label || nodeId;
                  
                  return (
                    <ListItem key={nodeId} sx={{
                      bgcolor: status.status === 'error' ? '#2d1b1b' : '#1b2d1b',
                      border: `1px solid ${status.status === 'error' ? '#ef4444' : '#22c55e'}`,
                      borderRadius: 1,
                      mb: 1
                    }}>
                      <ListItemIcon>
                        {status.status === 'error' ? (
                          <ErrorIcon sx={{ color: '#ef4444' }} />
                        ) : (
                          <CheckCircleIcon sx={{ color: '#22c55e' }} />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={nodeName}
                        secondary={status.message}
                        sx={{
                          '& .MuiListItemText-primary': {
                            color: '#ffffff'
                          },
                          '& .MuiListItemText-secondary': {
                            color: status.status === 'error' ? '#ff6b6b' : '#4ade80'
                          }
                        }}
                      />
                    </ListItem>
                  );
                })}
              </List>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button 
            onClick={() => setShowResults(false)}
            variant="contained"
            sx={{ 
              bgcolor: '#8b5cf6',
              '&:hover': { bgcolor: '#7c3aed' }
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default FlowDesigner;