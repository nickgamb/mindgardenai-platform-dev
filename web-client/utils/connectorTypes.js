/**
 * Connector Types and Color System for Flow Designer
 * 
 * Defines the visual and functional specifications for all node connectors
 */

// Connector type definitions with colors and labels
export const CONNECTOR_TYPES = {
  // Data Connectors (Green)
  DATA: {
    color: '#10b981', // Green
    borderColor: '#ffffff',
    size: 12,
    label: 'Data',
    description: 'Structured data flow'
  },
  
  // Trigger Connectors (Yellow)
  TRIGGER: {
    color: '#f59e0b', // Yellow/Amber
    borderColor: '#ffffff', 
    size: 12,
    label: 'Trigger',
    description: 'Flow execution trigger'
  },
  
  // API Connectors (Red)
  API: {
    color: '#ef4444', // Red
    borderColor: '#ffffff',
    size: 12,
    label: 'API',
    description: 'API request/response'
  },
  
  // Visual Connectors (Purple)
  VISUAL: {
    color: '#8b5cf6', // Purple
    borderColor: '#ffffff',
    size: 12,
    label: 'Visual',
    description: 'Visual/image data'
  },
  
  // Storage Connectors (Cyan)
  STORAGE: {
    color: '#06b6d4', // Cyan
    borderColor: '#ffffff',
    size: 12,
    label: 'Storage',
    description: 'Storage operations'
  },
  
  // Analytics Connectors (Orange)
  ANALYTICS: {
    color: '#f97316', // Orange
    borderColor: '#ffffff',
    size: 12,
    label: 'Analytics',
    description: 'Analytics/reporting data'
  }
};

// Connector handle configurations for each node type
export const NODE_CONNECTORS = {
  file: {
    inputs: [
      {
        id: 'trigger_input',
        type: 'target',
        position: 'Left',
        connectorType: CONNECTOR_TYPES.TRIGGER,
        required: false
      }
    ],
    outputs: [
      {
        id: 'data_output',
        type: 'source',
        position: 'Right',
        connectorType: CONNECTOR_TYPES.DATA,
        required: true
      }
    ]
  },
  
  storage: {
    inputs: [
      {
        id: 'trigger_input',
        type: 'target',
        position: 'Top',
        connectorType: CONNECTOR_TYPES.TRIGGER,
        required: false
      },
      {
        id: 'data_input_1',
        type: 'target',
        position: 'Left',
        connectorType: CONNECTOR_TYPES.DATA,
        required: false
      },
      {
        id: 'data_input_2',
        type: 'target',
        position: 'Left',
        connectorType: CONNECTOR_TYPES.DATA,
        required: false
      }
    ],
    outputs: [
      {
        id: 'data_output_1',
        type: 'source',
        position: 'Right',
        connectorType: CONNECTOR_TYPES.DATA,
        required: false
      },
      {
        id: 'data_output_2',
        type: 'source',
        position: 'Right',
        connectorType: CONNECTOR_TYPES.DATA,
        required: false
      }
    ]
  },
  
  transform: {
    inputs: [
      {
        id: 'data_input',
        type: 'target',
        position: 'Left',
        connectorType: CONNECTOR_TYPES.DATA,
        required: true
      }
    ],
    outputs: [
      {
        id: 'data_output',
        type: 'source',
        position: 'Right',
        connectorType: CONNECTOR_TYPES.DATA,
        required: true
      }
    ]
  },
  
  api: {
    inputs: [
      {
        id: 'data_input',
        type: 'target',
        position: 'Left',
        connectorType: CONNECTOR_TYPES.DATA,
        required: false
      },
      {
        id: 'trigger_input',
        type: 'target',
        position: 'Left',
        connectorType: CONNECTOR_TYPES.TRIGGER,
        required: false
      }
    ],
    outputs: [
      {
        id: 'data_output',
        type: 'source',
        position: 'Right',
        connectorType: CONNECTOR_TYPES.DATA,
        required: true
      }
    ]
  },
  
  analytics: {
    inputs: [
      {
        id: 'data_input',
        type: 'target',
        position: 'Left',
        connectorType: CONNECTOR_TYPES.DATA,
        required: true
      }
    ],
    outputs: [
      {
        id: 'data_output',
        type: 'source',
        position: 'Right',
        connectorType: CONNECTOR_TYPES.DATA,
        required: true
      }
    ]
  },
  
  flow_trigger: {
    inputs: [],
    outputs: [
      {
        id: 'trigger_output',
        type: 'source',
        position: 'Right',
        connectorType: CONNECTOR_TYPES.TRIGGER,
        required: true
      }
    ]
  },
  
  ai_tools: {
    inputs: [
      {
        id: 'data_input',
        type: 'target',
        position: 'Left',
        connectorType: CONNECTOR_TYPES.DATA,
        required: false
      },
      {
        id: 'trigger_input',
        type: 'target',
        position: 'Left',
        connectorType: CONNECTOR_TYPES.TRIGGER,
        required: false
      }
    ],
    outputs: [
      {
        id: 'data_output',
        type: 'source',
        position: 'Right',
        connectorType: CONNECTOR_TYPES.DATA,
        required: false
      },
      {
        id: 'visual_output',
        type: 'source',
        position: 'Right',
        connectorType: CONNECTOR_TYPES.VISUAL,
        required: false
      }
    ]
  },
  
  visual_preview: {
    inputs: [
      {
        id: 'data_input',
        type: 'target',
        position: 'Left',
        connectorType: CONNECTOR_TYPES.DATA,
        required: false
      },
      {
        id: 'visual_input',
        type: 'target',
        position: 'Left',
        connectorType: CONNECTOR_TYPES.VISUAL,
        required: false
      }
    ],
    outputs: []
  },
  
  plugins: {
    inputs: [
      {
        id: 'data_input',
        type: 'target',
        position: 'Left',
        connectorType: CONNECTOR_TYPES.DATA,
        required: false
      },
      {
        id: 'trigger_input',
        type: 'target',
        position: 'Left',
        connectorType: CONNECTOR_TYPES.TRIGGER,
        required: false
      }
    ],
    outputs: [
      {
        id: 'data_output',
        type: 'source',
        position: 'Right',
        connectorType: CONNECTOR_TYPES.DATA,
        required: true
      }
    ]
  },

};

// Connection validation rules
export const CONNECTION_RULES = {
  // Data connectors can connect to data inputs
  'data_output': ['data_input', 'data_input_1', 'data_input_2'],
  
  // Trigger connectors can connect to trigger inputs
  'trigger_output': ['trigger_input'],
  
  // Visual connectors can connect to visual inputs
  'visual_output': ['visual_input'],
  
  // Storage data outputs can connect to data inputs
  'data_output_1': ['data_input', 'data_input_1', 'data_input_2'],
  'data_output_2': ['data_input', 'data_input_1', 'data_input_2']
};

// Helper function to get connector style
export const getConnectorStyle = (connectorType, position = {}) => {
  const baseStyle = {
    background: connectorType.color,
    borderRadius: '50%', // Ensure circular shape
    zIndex: 10, // Ensure handles are above other elements
    cursor: 'crosshair', // Better cursor for connection
  };

  // Merge with position styles (position takes priority)
  const finalStyle = {
    ...baseStyle,
    ...position
  };

  return finalStyle;
};

// Helper function to get all connectors for a node type
export const getNodeConnectors = (nodeType) => {
  return NODE_CONNECTORS[nodeType] || { inputs: [], outputs: [] };
};

// Helper function to validate connection
export const isValidConnection = (sourceHandle, targetHandle) => {
  const validTargets = CONNECTION_RULES[sourceHandle] || [];
  return validTargets.includes(targetHandle);
};

// Helper function to get connector tooltip
export const getConnectorTooltip = (connectorId, nodeType, isInput = true) => {
  const connectors = getNodeConnectors(nodeType);
  const connectorList = isInput ? connectors.inputs : connectors.outputs;
  const connector = connectorList.find(c => c.id === connectorId);
  
  if (!connector) return '';
  
  const direction = isInput ? 'Input' : 'Output';
  return `${connector.connectorType.label} ${direction}: ${connector.connectorType.description}`;
};

export default {
  CONNECTOR_TYPES,
  NODE_CONNECTORS,
  CONNECTION_RULES,
  getConnectorStyle,
  getNodeConnectors,
  isValidConnection,
  getConnectorTooltip
};