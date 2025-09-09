"""
Connection Types System for MindGarden Platform
Defines and validates different types of connections between mgflow flow nodes

Connection Types:
- Data Connections: Transfer processed data between nodes (CSV, API responses, transforms)
- Trigger Connections: Control flow execution and sequencing
- Visual Connections: Pass data for visualization and preview
"""

CONNECTION_TYPES = {
    # Generic data connections
    'data_input': {'color': '#06b6d4', 'type': 'data', 'direction': 'input'},
    'data_output': {'color': '#06b6d4', 'type': 'data', 'direction': 'output'},
    
    # Flow control triggers
    'trigger_input': {'color': '#f59e0b', 'type': 'trigger', 'direction': 'input'},
    'trigger_output': {'color': '#f59e0b', 'type': 'trigger', 'direction': 'output'},
    'start_flow_trigger': {'color': '#f59e0b', 'type': 'trigger', 'direction': 'output'},
    'stop_flow_trigger': {'color': '#ef4444', 'type': 'trigger', 'direction': 'output'},
    'frontend_trigger': {'color': '#8b5cf6', 'type': 'trigger', 'direction': 'output'},
    
    # Visualization and preview
    'visual_input': {'color': '#06b6d4', 'type': 'visual', 'direction': 'input'},
    'visual_output': {'color': '#06b6d4', 'type': 'visual', 'direction': 'output'},
    
    # MGFlow-specific data types
    'file_output': {'color': '#10b981', 'type': 'data', 'direction': 'output'},      # File/CSV data
    'csv_data': {'color': '#10b981', 'type': 'data', 'direction': 'output'},        # CSV-specific data
    'api_data': {'color': '#ef4444', 'type': 'data', 'direction': 'output'},        # API response data
    'transform_data': {'color': '#8b5cf6', 'type': 'data', 'direction': 'output'},  # ETL transformed data
    'ai_output': {'color': '#06b6d4', 'type': 'data', 'direction': 'output'},       # AI/LLM generated data
}

def validate_connection(source_type, target_type):
    """
    Validate if a connection between two handle types is valid
    
    Args:
        source_type (str): The source handle type
        target_type (str): The target handle type
    
    Returns:
        bool: True if connection is valid, False otherwise
    """
    if source_type not in CONNECTION_TYPES or target_type not in CONNECTION_TYPES:
        return False
    
    source_info = CONNECTION_TYPES[source_type]
    target_info = CONNECTION_TYPES[target_type]
    
    # Check direction compatibility
    if source_info['direction'] != 'output' or target_info['direction'] != 'input':
        return False
    
    # Check type compatibility
    if source_info['type'] != target_info['type']:
        return False
    
    return True

def get_connection_info(handle_type):
    """
    Get information about a connection type
    
    Args:
        handle_type (str): The handle type
    
    Returns:
        dict: Connection type information or None if not found
    """
    return CONNECTION_TYPES.get(handle_type)

def get_compatible_targets(source_type):
    """
    Get all compatible target types for a given source type
    
    Args:
        source_type (str): The source handle type
    
    Returns:
        list: List of compatible target types
    """
    if source_type not in CONNECTION_TYPES:
        return []
    
    source_info = CONNECTION_TYPES[source_type]
    if source_info['direction'] != 'output':
        return []
    
    compatible_targets = []
    for target_type, target_info in CONNECTION_TYPES.items():
        if (target_info['direction'] == 'input' and 
            target_info['type'] == source_info['type']):
            compatible_targets.append(target_type)
    
    return compatible_targets 