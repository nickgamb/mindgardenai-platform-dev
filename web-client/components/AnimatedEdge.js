import React from 'react';
import { getBezierPath } from 'reactflow';

/**
 * Custom animated edge component for ReactFlow
 * 
 * Provides animated connections with gradient effects and moving indicators
 * based on connection types (data, trigger, api, visual, analytics)
 */
const AnimatedEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Get connection type based on handle IDs
  const getConnectionType = () => {
    const sourceHandle = data?.sourceHandle;
    const targetHandle = data?.targetHandle;
    
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

  const connectionType = getConnectionType();

  // Get gradient ID based on connection type
  const getGradientId = () => {
    const uniqueId = id.replace(/[^a-zA-Z0-9]/g, '');
    switch (connectionType.type) {
      case 'data': return `dataFlowGradient-${uniqueId}`;
      case 'trigger': return `triggerFlowGradient-${uniqueId}`;
      case 'api': return `apiFlowGradient-${uniqueId}`;
      case 'visual': return `visualFlowGradient-${uniqueId}`;
      case 'analytics': return `analyticsFlowGradient-${uniqueId}`;
      default: return `genericFlowGradient-${uniqueId}`;
    }
  };

  const gradientId = getGradientId();
  const filterId = `flowGlow-${id.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <>
      {/* CSS to ensure our custom edge styling takes precedence */}
      <style>{`
        .react-flow__edge-path[stroke*="url(#"] {
          stroke-width: ${connectionType.strokeWidth + 2}px !important;
          stroke-dasharray: ${connectionType.dashArray} !important;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)) !important;
        }
      `}</style>
      
      {/* Define gradients for this edge */}
      <defs>
        {/* Data flow gradient */}
        <linearGradient id={`dataFlowGradient-${id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
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
        <linearGradient id={`triggerFlowGradient-${id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
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
        <linearGradient id={`apiFlowGradient-${id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
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
        <linearGradient id={`visualFlowGradient-${id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
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
        <linearGradient id={`analyticsFlowGradient-${id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
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
        <linearGradient id={`genericFlowGradient-${id.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
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
        <filter id={filterId}>
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
          <feMerge> 
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Primary solid colored line - main visual */}
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        stroke={connectionType.color}
        strokeWidth={connectionType.strokeWidth + 2}
        strokeDasharray={connectionType.dashArray}
        fill="none"
        opacity="1"
        filter={`url(#${filterId})`}
        style={{
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
          ...style
        }}
      />
      
      {/* Secondary gradient line for enhanced effect */}
      <path
        d={edgePath}
        stroke={`url(#${gradientId})`}
        strokeWidth={connectionType.strokeWidth}
        strokeDasharray={connectionType.dashArray}
        fill="none"
        opacity="0.6"
        style={{
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))',
          ...style
        }}
      />
      
      {/* Multiple moving dot indicators along the path - consistent sizing */}
      <g>
        <circle
          r="2"
          fill={connectionType.color}
          opacity="0.8"
          filter={`url(#${filterId})`}
        >
          <animateMotion
            dur="2s"
            repeatCount="indefinite"
            path={edgePath}
          />
        </circle>
        
        <circle
          r="2"
          fill={connectionType.color}
          opacity="0.8"
        >
          <animateMotion
            dur="2s"
            repeatCount="indefinite"
            path={edgePath}
            begin="0.7s"
          />
        </circle>
        
        <circle
          r="2"
          fill={connectionType.color}
          opacity="0.8"
        >
          <animateMotion
            dur="2s"
            repeatCount="indefinite"
            path={edgePath}
            begin="1.4s"
          />
        </circle>
      </g>
    </>
  );
};

export default AnimatedEdge; 