import React from 'react';
import { Handle, Position } from 'reactflow';
import { getNodeConnectors } from '../utils/connectorTypes';
import AnimatedEdge from './AnimatedEdge';

/**
 * Simple Connector System for Flow Designer
 * 
 * Minimal implementation that lets React Flow handle positioning
 */

// Individual connector with proper positioning
const FlowConnector = ({ connector, isConnectable = true, index = 0, totalCount = 1 }) => {
  const { id, type, position, connectorType } = connector;
  
  // Calculate position for multiple handles on same side
  const getPositionStyle = () => {
    const baseStyle = {
      background: connectorType.color,
      border: '2px solid #ffffff',
      width: '12px',
      height: '12px',
      borderRadius: '50%',
    };

    // For multiple handles on same side, position them to match labels
    if (totalCount > 1) {
      // Calculate percentage position to match labels
      const percentage = (100 / (totalCount + 1)) * (index + 1);
      
      switch (position.toLowerCase()) {
        case 'left':
        case 'right':
          return {
            ...baseStyle,
            top: `${percentage}%`,
            transform: 'translateY(-50%)'
          };
        case 'top':
        case 'bottom':
          return {
            ...baseStyle,
            left: `${percentage}%`,
            transform: 'translateX(-50%)'
          };
        default:
          return baseStyle;
      }
    }

    return baseStyle;
  };
  
  return (
    <Handle
      type={type}
      position={position.toLowerCase() === 'left' ? Position.Left :
                position.toLowerCase() === 'right' ? Position.Right :
                position.toLowerCase() === 'top' ? Position.Top :
                position.toLowerCase() === 'bottom' ? Position.Bottom :
                Position.Top}
      id={id}
      isConnectable={isConnectable}
      style={getPositionStyle()}
    />
  );
};

// Main connector system for nodes
export const FlowConnectors = ({ 
  nodeType, 
  isConnectable = true,
  showTooltips = true,
  showLabels = true
}) => {
  const connectors = getNodeConnectors(nodeType);
  
  if (!connectors) {
    return null;
  }

  // Group connectors by position for proper distribution
  const groupByPosition = (connectorList) => {
    return connectorList.reduce((groups, connector) => {
      const pos = connector.position.toLowerCase();
      if (!groups[pos]) groups[pos] = [];
      groups[pos].push(connector);
      return groups;
    }, {});
  };

  const inputGroups = groupByPosition(connectors.inputs || []);
  const outputGroups = groupByPosition(connectors.outputs || []);

  // Helper function to get label position
  const getLabelPosition = (connector, index, totalCount) => {
    const { position } = connector;
    const percentage = totalCount > 1 ? (100 / (totalCount + 1)) * (index + 1) : 50;
    
    const baseStyle = {
      position: 'absolute',
      fontSize: '0.65rem',
      fontWeight: 500,
      color: connector.connectorType.color,
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      zIndex: 10
    };

    switch (position.toLowerCase()) {
      case 'left':
        return {
          ...baseStyle,
          left: '-8px',
          top: `${percentage}%`,
          transform: 'translate(-100%, -50%)'
        };
      case 'right':
        return {
          ...baseStyle,
          right: '-8px',
          top: `${percentage}%`,
          transform: 'translate(100%, -50%)'
        };
      case 'top':
        return {
          ...baseStyle,
          top: '-24px',
          left: `${percentage}%`,
          transform: 'translate(-50%, 0)'
        };
      case 'bottom':
        return {
          ...baseStyle,
          bottom: '-24px',
          left: `${percentage}%`,
          transform: 'translate(-50%, 0)'
        };
      default:
        return baseStyle;
    }
  };
  
  return (
    <>
      {/* Input Connectors - grouped by position */}
      {Object.entries(inputGroups).map(([position, positionConnectors]) =>
        positionConnectors.map((connector, index) => (
          <FlowConnector
            key={connector.id}
            connector={connector}
            isConnectable={isConnectable}
            index={index}
            totalCount={positionConnectors.length}
          />
        ))
      )}
      
      {/* Output Connectors - grouped by position */}
      {Object.entries(outputGroups).map(([position, positionConnectors]) =>
        positionConnectors.map((connector, index) => (
          <FlowConnector
            key={connector.id}
            connector={connector}
            isConnectable={isConnectable}
            index={index}
            totalCount={positionConnectors.length}
          />
        ))
      )}

      {/* Labels positioned next to handles */}
      {showLabels && (
        <>
          {/* Input Labels */}
          {Object.entries(inputGroups).map(([position, positionConnectors]) =>
            positionConnectors.map((connector, index) => (
              <div
                key={`label-${connector.id}`}
                style={getLabelPosition(connector, index, positionConnectors.length)}
              >
                {connector.connectorType.label}
              </div>
            ))
          )}
          
          {/* Output Labels */}
          {Object.entries(outputGroups).map(([position, positionConnectors]) =>
            positionConnectors.map((connector, index) => (
              <div
                key={`label-${connector.id}`}
                style={getLabelPosition(connector, index, positionConnectors.length)}
              >
                {connector.connectorType.label}
              </div>
            ))
          )}
        </>
      )}
    </>
  );
};

// Enhanced connection lines that find exact handle positions
export const FlowConnectionLines = ({ nodes, edges }) => {
  const [viewportKey, setViewportKey] = React.useState(0);

  // Force recalculation when viewport changes
  React.useEffect(() => {
    const handleViewportChange = () => {
      setViewportKey(prev => prev + 1);
    };

    // Listen for viewport changes (zoom, pan, etc.)
    const flowElement = document.querySelector('.react-flow');
    if (flowElement) {
      // Use ResizeObserver to detect viewport changes
      const resizeObserver = new ResizeObserver(handleViewportChange);
      resizeObserver.observe(flowElement);

      // Also listen for scroll events on the flow container
      const handleScroll = () => {
        // Immediate update for scroll
        handleViewportChange();
      };
      
      flowElement.addEventListener('scroll', handleScroll);

      // Watch for React Flow's viewport style changes (zoom/pan transformations)
      const reactFlowViewport = document.querySelector('.react-flow__viewport');
      if (reactFlowViewport) {
        const mutationObserver = new MutationObserver(() => {
          // Immediate update for style changes
          requestAnimationFrame(handleViewportChange);
        });
        mutationObserver.observe(reactFlowViewport, {
          attributes: true,
          attributeFilter: ['style']
        });

        // Listen for mouse events that might indicate zoom/pan
        const handleMouseMove = () => {
          // Debounced mouse move detection
          clearTimeout(handleMouseMove.timeout);
          handleMouseMove.timeout = setTimeout(handleViewportChange, 10);
        };
        
        flowElement.addEventListener('mousemove', handleMouseMove);
        flowElement.addEventListener('wheel', () => {
          // Immediate update for wheel events (zoom)
          requestAnimationFrame(handleViewportChange);
        });

        // Very frequent interval for smooth updates (60fps)
        const zoomInterval = setInterval(handleViewportChange, 16);

        return () => {
          resizeObserver.disconnect();
          flowElement.removeEventListener('scroll', handleScroll);
          flowElement.removeEventListener('mousemove', handleMouseMove);
          clearTimeout(handleMouseMove.timeout);
          mutationObserver.disconnect();
          clearInterval(zoomInterval);
        };
      }

      // Add a more frequent interval specifically for zoom operations
      const zoomInterval = setInterval(handleViewportChange, 100);

      return () => {
        resizeObserver.disconnect();
        flowElement.removeEventListener('scroll', handleScroll);
        clearTimeout(handleScroll.timeout);
        clearInterval(zoomInterval);
      };
    }
  }, []);

  if (!nodes || !edges || edges.length === 0) return null;

  const getHandlePosition = (nodeId, handleId) => {
    try {
      // Find the node element
      const nodeElement = document.querySelector(`[data-id="${nodeId}"]`);
      if (!nodeElement) return null;

      // Find the specific handle
      const handleElement = nodeElement.querySelector(`[data-handleid="${handleId}"]`);
      if (!handleElement) return null;

      // Get viewport positions
      const nodeRect = nodeElement.getBoundingClientRect();
      const handleRect = handleElement.getBoundingClientRect();
      const flowElement = document.querySelector('.react-flow');
      const flowRect = flowElement?.getBoundingClientRect() || { left: 0, top: 0 };

      return {
        x: handleRect.left + handleRect.width / 2 - flowRect.left,
        y: handleRect.top + handleRect.height / 2 - flowRect.top
      };
    } catch (error) {
      console.warn('Could not find handle position:', nodeId, handleId);
      return null;
    }
  };

  const getConnectionType = (edge) => {
    const sourceHandle = edge.sourceHandle;
    const targetHandle = edge.targetHandle;
    
    if (sourceHandle?.includes('data') && targetHandle?.includes('data')) {
      return { type: 'data', color: '#10b981', strokeWidth: 2, dashArray: 'none' };
    } else if (sourceHandle?.includes('trigger') || targetHandle?.includes('trigger')) {
      return { type: 'trigger', color: '#f59e0b', strokeWidth: 2, dashArray: '8,4' };
    } else if (sourceHandle?.includes('api') || targetHandle?.includes('api')) {
      return { type: 'api', color: '#ef4444', strokeWidth: 2, dashArray: '4,2' };
    } else if (sourceHandle?.includes('visual') || targetHandle?.includes('visual')) {
      return { type: 'visual', color: '#8b5cf6', strokeWidth: 2, dashArray: '6,3' };
    } else if (sourceHandle?.includes('analytics') || targetHandle?.includes('analytics')) {
      return { type: 'analytics', color: '#f97316', strokeWidth: 2, dashArray: '5,5' };
    }
    
    return { type: 'generic', color: '#6b7280', strokeWidth: 1, dashArray: 'none' };
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      <style>{`
        svg {
          animation-play-state: running !important;
        }
        svg * {
          animation-play-state: running !important;
        }
        .react-flow__edge {
          animation-play-state: running !important;
        }
        .react-flow__edge-path {
          animation-play-state: running !important;
        }
      `}</style>
      <svg
        key={viewportKey}
        width="100%"
        height="100%"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {/* Define animated gradients for flow effects */}
        <defs>
          {/* Data flow gradient */}
          <linearGradient id="dataFlowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4">
              <animate attributeName="offset" values="0;1;0" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor="#34d399" stopOpacity="0.9">
              <animate attributeName="offset" values="0.5;1.5;0.5" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.4">
              <animate attributeName="offset" values="1;2;1" dur="2s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          
          {/* Trigger flow gradient */}
          <linearGradient id="triggerFlowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4">
              <animate attributeName="offset" values="0;1;0" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.9">
              <animate attributeName="offset" values="0.5;1.5;0.5" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.4">
              <animate attributeName="offset" values="1;2;1" dur="2s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          
          {/* API flow gradient */}
          <linearGradient id="apiFlowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4">
              <animate attributeName="offset" values="0;1;0" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor="#f87171" stopOpacity="0.9">
              <animate attributeName="offset" values="0.5;1.5;0.5" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.4">
              <animate attributeName="offset" values="1;2;1" dur="2s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          
          {/* Visual flow gradient */}
          <linearGradient id="visualFlowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4">
              <animate attributeName="offset" values="0;1;0" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor="#a855f7" stopOpacity="0.9">
              <animate attributeName="offset" values="0.5;1.5;0.5" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.4">
              <animate attributeName="offset" values="1;2;1" dur="2s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          
          {/* Analytics flow gradient */}
          <linearGradient id="analyticsFlowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.4">
              <animate attributeName="offset" values="0;1;0" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor="#fb923c" stopOpacity="0.9">
              <animate attributeName="offset" values="0.5;1.5;0.5" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.4">
              <animate attributeName="offset" values="1;2;1" dur="2s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          
          {/* Generic flow gradient */}
          <linearGradient id="genericFlowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6b7280" stopOpacity="0.4">
              <animate attributeName="offset" values="0;1;0" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor="#9ca3af" stopOpacity="0.9">
              <animate attributeName="offset" values="0.5;1.5;0.5" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#6b7280" stopOpacity="0.4">
              <animate attributeName="offset" values="1;2;1" dur="2s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          
          {/* Glow filter for enhanced visibility */}
          <filter id="flowGlow">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {edges.map((edge) => {
          const sourcePos = getHandlePosition(edge.source, edge.sourceHandle);
          const targetPos = getHandlePosition(edge.target, edge.targetHandle);
          
          if (!sourcePos || !targetPos) return null;
          
          const connectionType = getConnectionType(edge);
          
          // Create smooth bezier curve
          const dx = targetPos.x - sourcePos.x;
          const dy = targetPos.y - sourcePos.y;
          const curve = Math.abs(dx) * 0.4;
          
          // Create the curved path for both line display and animation
          const path = `M ${sourcePos.x} ${sourcePos.y} C ${sourcePos.x + curve} ${sourcePos.y}, ${targetPos.x - curve} ${targetPos.y}, ${targetPos.x} ${targetPos.y}`;
          
          // Get the appropriate gradient based on connection type
          const getGradientId = () => {
            switch (connectionType.type) {
              case 'data': return 'dataFlowGradient';
              case 'trigger': return 'triggerFlowGradient';
              case 'api': return 'apiFlowGradient';
              case 'visual': return 'visualFlowGradient';
              case 'analytics': return 'analyticsFlowGradient';
              default: return 'genericFlowGradient';
            }
          };
          
          return (
            <g key={edge.id}>
              {/* Animated flow line with gradient */}
              <path
                d={path}
                stroke={`url(#${getGradientId()})`}
                strokeWidth={connectionType.strokeWidth + 2}
                strokeDasharray={connectionType.dashArray}
                fill="none"
                opacity="1"
                filter="url(#flowGlow)"
                style={{
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                }}
              />
              
              {/* Multiple moving dot indicators along the path */}
              <g>
                <circle
                  r="3"
                  fill={connectionType.color}
                  opacity="0.9"
                  filter="url(#flowGlow)"
                >
                  <animateMotion
                    dur="2s"
                    repeatCount="indefinite"
                    path={path}
                  />
                </circle>
                
                <circle
                  r="2"
                  fill={connectionType.color}
                  opacity="0.6"
                >
                  <animateMotion
                    dur="2s"
                    repeatCount="indefinite"
                    path={path}
                    begin="0.7s"
                  />
                </circle>
                
                <circle
                  r="1.5"
                  fill={connectionType.color}
                  opacity="0.3"
                >
                  <animateMotion
                    dur="2s"
                    repeatCount="indefinite"
                    path={path}
                    begin="1.4s"
                  />
                </circle>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// Edge types for ReactFlow
export const edgeTypes = {
  animated: AnimatedEdge,
};

export default FlowConnectors;