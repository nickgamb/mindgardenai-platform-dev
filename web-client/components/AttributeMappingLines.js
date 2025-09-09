import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';

/**
 * AttributeMappingLines Component
 * 
 * Draws visual connection lines between input fields and output fields
 * in the attribute mapping interface to show field relationships
 */
const AttributeMappingLines = ({ mappings, inputSchema, outputSchema, containerRef }) => {
  // Early return check before hooks
  if (!mappings || !inputSchema || !outputSchema || !containerRef?.current) return null;

  const [lines, setLines] = useState([]);
  const [viewportKey, setViewportKey] = useState(0);

  // Create a connection line between source and output fields
  const createConnectionLine = (sourceField, outputField, mappingType) => {
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    
    // Find the connection handles instead of the list items
    const inputHandle = container.querySelector(`[data-connection-handle="input-${sourceField}"]`);
    const outputHandle = container.querySelector(`[data-connection-handle="output-${outputField}"]`);

    if (inputHandle && outputHandle) {
      const inputRect = inputHandle.getBoundingClientRect();
      const outputRect = outputHandle.getBoundingClientRect();

      // Check if handles are visible in the container
      const inputVisible = inputRect.top < containerRect.bottom && inputRect.bottom > containerRect.top;
      const outputVisible = outputRect.top < containerRect.bottom && outputRect.bottom > containerRect.top;

      // If both handles are off-screen, don't draw the line
      if (!inputVisible && !outputVisible) {
        return null;
      }

      // Calculate relative positions within the container
      let startX = inputRect.left + inputRect.width / 2 - containerRect.left;
      let startY = inputRect.top + inputRect.height / 2 - containerRect.top;
      let endX = outputRect.left + outputRect.width / 2 - containerRect.left;
      let endY = outputRect.top + outputRect.height / 2 - containerRect.top;

      // Clip coordinates to container bounds for better visual appearance
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;

      // If input handle is off-screen, clip to container edge
      if (!inputVisible) {
        if (startY < 0) startY = 0;
        if (startY > containerHeight) startY = containerHeight;
        if (startX < 0) startX = 0;
        if (startX > containerWidth) startX = containerWidth;
      }

      // If output handle is off-screen, clip to container edge
      if (!outputVisible) {
        if (endY < 0) endY = 0;
        if (endY > containerHeight) endY = containerHeight;
        if (endX < 0) endX = 0;
        if (endX > containerWidth) endX = containerWidth;
      }

      return {
        id: `mapping-${outputField}-${sourceField}`,
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
        mapping: { type: mappingType },
        outputField,
        sourceField,
        inputVisible,
        outputVisible
      };
    }
    
    return null;
  };

  const getConnectionLines = () => {
    const lines = [];
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();

    Object.entries(mappings).forEach(([outputField, mapping]) => {
      if (!mapping || mapping.type === 'unmapped') return;

      let sourceFields = [];

      // Handle different mapping types
      if (mapping.type === 'direct' && mapping.sourceField) {
        sourceFields = [mapping.sourceField];
      } else if (mapping.type === 'direct' && mapping.sourceFields && Array.isArray(mapping.sourceFields)) {
        // Multi-select direct mapping
        sourceFields = mapping.sourceFields;
      } else if (mapping.type === 'expression' && mapping.expression) {
        // Parse expression to find referenced fields
        const fieldPattern = /(?:row|source\d+)\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
        const matches = [...mapping.expression.matchAll(fieldPattern)];
        sourceFields = matches.map(match => match[1]);
      } else if (mapping.type === 'concatenate') {
        // Concatenate uses two source fields
        if (mapping.sourceField1) sourceFields.push(mapping.sourceField1);
        if (mapping.sourceField2) sourceFields.push(mapping.sourceField2);
      } else if (mapping.type === 'split' && mapping.sourceField) {
        // Split uses one source field
        sourceFields = [mapping.sourceField];
      } else if (mapping.type === 'aggregate' && mapping.sourceField) {
        sourceFields = [mapping.sourceField];
      }

      // Create lines for each source field
      sourceFields.forEach(sourceField => {
        const line = createConnectionLine(sourceField, outputField, mapping.type);
        if (line) lines.push(line);
      });
    });

    return lines;
  };

  // Update lines when mappings, viewport, or container changes
  useEffect(() => {
    const updateLines = () => {
      const newLines = getConnectionLines();
      setLines(newLines);
    };

    // Initial update
    updateLines();

    // Set up event listeners for scroll and resize
    const container = containerRef.current;
    if (container) {
      const handleScroll = () => {
        // Debounce scroll events
        clearTimeout(handleScroll.timeout);
        handleScroll.timeout = setTimeout(updateLines, 16); // 60fps
      };

      const handleResize = () => {
        updateLines();
      };

      // Listen for scroll events on the container and its parents
      container.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('resize', handleResize, { passive: true });

      // Use ResizeObserver to detect container size changes
      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);

      // Use MutationObserver to detect DOM changes that might affect positioning
      const mutationObserver = new MutationObserver(() => {
        updateLines();
      });
      mutationObserver.observe(container, { 
        childList: true, 
        subtree: true, 
        attributes: true,
        attributeFilter: ['style', 'class']
      });

      return () => {
        container.removeEventListener('scroll', handleScroll);
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleResize);
        resizeObserver.disconnect();
        mutationObserver.disconnect();
        clearTimeout(handleScroll.timeout);
      };
    }
  }, [mappings, inputSchema, outputSchema, viewportKey]);

  // Force update when viewport changes (for zoom, pan, etc.)
  useEffect(() => {
    const interval = setInterval(() => {
      setViewportKey(prev => prev + 1);
    }, 100); // Check every 100ms for viewport changes

    return () => clearInterval(interval);
  }, []);

  const getMappingTypeInfo = (mapping) => {
    switch (mapping.type) {
      case 'direct':
        return { color: '#10b981', icon: '→', label: 'Direct' };
      case 'expression':
        return { color: '#8b5cf6', icon: 'ƒ', label: 'Expression' };
      case 'transform':
        return { color: '#f59e0b', icon: '⚡', label: 'Transform' };
      case 'aggregate':
        return { color: '#ef4444', icon: '∑', label: 'Aggregate' };
      case 'concatenate':
        return { color: '#06b6d4', icon: '+', label: 'Concat' };
      case 'split':
        return { color: '#f97316', icon: '✂', label: 'Split' };
      default:
        return { color: '#6b7280', icon: '?', label: 'Unknown' };
    }
  };

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1, // Above the background but below interactive elements
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {/* Define gradients and filters for animated effects */}
        <defs>
          {/* Animated gradient for flow direction */}
          <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.3">
              <animate attributeName="offset" values="0;1;0" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor="currentColor" stopOpacity="0.8">
              <animate attributeName="offset" values="0.5;1.5;0.5" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.3">
              <animate attributeName="offset" values="1;2;1" dur="2s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          
          {/* Type-specific gradients */}
          <linearGradient id="directGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.3">
              <animate attributeName="offset" values="0;1;0" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor="#34d399" stopOpacity="0.8">
              <animate attributeName="offset" values="0.5;1.5;0.5" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.3">
              <animate attributeName="offset" values="1;2;1" dur="2s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          
          <linearGradient id="expressionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3">
              <animate attributeName="offset" values="0;1;0" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor="#a855f7" stopOpacity="0.8">
              <animate attributeName="offset" values="0.5;1.5;0.5" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.3">
              <animate attributeName="offset" values="1;2;1" dur="2s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          
          <linearGradient id="concatenateGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3">
              <animate attributeName="offset" values="0;1;0" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.8">
              <animate attributeName="offset" values="0.5;1.5;0.5" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.3">
              <animate attributeName="offset" values="1;2;1" dur="2s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          
          <linearGradient id="splitGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.3">
              <animate attributeName="offset" values="0;1;0" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor="#fb923c" stopOpacity="0.8">
              <animate attributeName="offset" values="0.5;1.5;0.5" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.3">
              <animate attributeName="offset" values="1;2;1" dur="2s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          
          <linearGradient id="aggregateGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3">
              <animate attributeName="offset" values="0;1;0" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor="#f87171" stopOpacity="0.8">
              <animate attributeName="offset" values="0.5;1.5;0.5" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.3">
              <animate attributeName="offset" values="1;2;1" dur="2s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          
          {/* Glow filter for enhanced visibility */}
          <filter id="lineGlow">
            <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {lines.map((line) => {
          const typeInfo = getMappingTypeInfo(line.mapping);
          
          // Calculate smooth curve control points
          const dx = line.end.x - line.start.x;
          const curve = Math.abs(dx) * 0.3;
          
          const path = `M ${line.start.x} ${line.start.y} C ${line.start.x + curve} ${line.start.y}, ${line.end.x - curve} ${line.end.y}, ${line.end.x} ${line.end.y}`;
          
          // Determine line style based on visibility
          const isFullyVisible = line.inputVisible && line.outputVisible;
          const isPartiallyVisible = line.inputVisible || line.outputVisible;
          
          let opacity = 0.7;
          
          // Adjust opacity for off-screen handles
          if (!isFullyVisible) {
            if (!isPartiallyVisible) {
              return null; // Don't render if both handles are off-screen
            }
            // For partially visible lines, make them more subtle
            opacity = 0.4;
          }
          
          return (
            <g key={line.id}>
              {/* Animated flow line with gradient */}
              <path
                d={path}
                stroke={`url(#${line.mapping.type}Gradient)`}
                strokeWidth="3"
                fill="none"
                strokeDasharray={line.mapping.type === 'direct' ? 'none' : '4,2'}
                opacity={opacity}
                filter="url(#lineGlow)"
                style={{
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
              />
              
              {/* Multiple moving chevron indicators along the path */}
              {isFullyVisible && (
                <g>
                  <path
                    d="M 0,0 L -3,2.5 L -3,-2.5 Z"
                    fill={typeInfo.color}
                    opacity="0.9"
                    filter="url(#lineGlow)"
                  >
                    <animateMotion
                      dur="2s"
                      repeatCount="indefinite"
                      path={path}
                      rotate="auto"
                    />
                  </path>
                  
                  <path
                    d="M 0,0 L -3,2.5 L -3,-2.5 Z"
                    fill={typeInfo.color}
                    opacity="0.6"
                  >
                    <animateMotion
                      dur="2s"
                      repeatCount="indefinite"
                      path={path}
                      rotate="auto"
                      begin="0.7s"
                    />
                  </path>
                  
                  <path
                    d="M 0,0 L -3,2.5 L -3,-2.5 Z"
                    fill={typeInfo.color}
                    opacity="0.3"
                  >
                    <animateMotion
                      dur="2s"
                      repeatCount="indefinite"
                      path={path}
                      rotate="auto"
                      begin="1.4s"
                    />
                  </path>
                </g>
              )}
              
              {/* Connection type indicator at midpoint - only show for fully visible lines */}
              {isFullyVisible && (
                <g
                  transform={`translate(${line.start.x + dx/2}, ${line.start.y + (line.end.y - line.start.y)/2})`}
                >
                  <circle
                    cx="0"
                    cy="0"
                    r="10"
                    fill={typeInfo.color}
                    opacity="0.9"
                    stroke="#1a1a1a"
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="0"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="10"
                    fill="white"
                    fontWeight="bold"
                  >
                    {typeInfo.icon}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </Box>
  );
};

export default AttributeMappingLines;