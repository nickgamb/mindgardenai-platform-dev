"""
Data Router System
Handles multiple data inputs and merges them for nodes that accept multiple data sources
"""

import time
from typing import Dict, List, Any

def merge_data_inputs(context: Dict[str, Any], node_id: str) -> Dict[str, Any]:
    """
    Merge multiple data inputs for nodes that accept multiple data sources
    
    Args:
        context (dict): The execution context containing data from previous nodes
        node_id (str): The ID of the current node
    
    Returns:
        dict: Merged data with metadata
    """
    data_inputs = []
    
    for ctx_key, ctx_value in context.items():
        if isinstance(ctx_value, dict) and 'data' in ctx_value:
            data_inputs.append({
                'source': ctx_key,
                'data': ctx_value['data'],
                'type': ctx_value.get('type', 'unknown'),
                'timestamp': ctx_value.get('timestamp', time.time()),
                'node_type': ctx_value.get('node_type', 'unknown')
            })
    
    # Sort by timestamp if available
    data_inputs.sort(key=lambda x: x.get('timestamp', 0))
    
    return {
        'merged_data': data_inputs,
        'input_count': len(data_inputs),
        'data_types': [d['type'] for d in data_inputs],
        'node_types': [d['node_type'] for d in data_inputs],
        'sources': [d['source'] for d in data_inputs],
        'timestamp': time.time()
    }

def get_node_input_data(context: Dict[str, Any], node_id: str = None) -> Dict[str, Any]:
    """
    Get input data for a node from the execution context
    
    Args:
        context (dict): The execution context
        node_id (str): The ID of the current node (optional)
    
    Returns:
        dict: Input data for the node
    """
    # Look for data inputs in context
    data_inputs = []
    trigger_inputs = []
    visual_inputs = []
    
    for ctx_key, ctx_value in context.items():
        if isinstance(ctx_value, dict):
            if 'data' in ctx_value:
                data_inputs.append({
                    'source': ctx_key,
                    'data': ctx_value['data'],
                    'type': ctx_value.get('type', 'unknown'),
                    'timestamp': ctx_value.get('timestamp', time.time())
                })
            elif 'trigger' in ctx_value:
                trigger_inputs.append({
                    'source': ctx_key,
                    'trigger': ctx_value['trigger'],
                    'type': ctx_value.get('type', 'unknown'),
                    'timestamp': ctx_value.get('timestamp', time.time())
                })
            elif 'visual' in ctx_value:
                visual_inputs.append({
                    'source': ctx_key,
                    'visual': ctx_value['visual'],
                    'type': ctx_value.get('type', 'unknown'),
                    'timestamp': ctx_value.get('timestamp', time.time())
                })
    
    return {
        'data_inputs': data_inputs,
        'trigger_inputs': trigger_inputs,
        'visual_inputs': visual_inputs,
        'has_data': len(data_inputs) > 0,
        'has_triggers': len(trigger_inputs) > 0,
        'has_visual': len(visual_inputs) > 0,
        'timestamp': time.time()
    }

def get_trigger_inputs(context: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Extract trigger inputs from context
    
    Args:
        context (dict): The execution context
    
    Returns:
        list: List of trigger inputs
    """
    trigger_inputs = []
    
    for ctx_key, ctx_value in context.items():
        if isinstance(ctx_value, dict) and 'trigger' in ctx_value:
            trigger_inputs.append({
                'source': ctx_key,
                'trigger': ctx_value['trigger'],
                'type': ctx_value.get('type', 'unknown'),
                'timestamp': ctx_value.get('timestamp', time.time())
            })
    
    return trigger_inputs

def get_visual_inputs(context: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Extract visual inputs from context
    
    Args:
        context (dict): The execution context
    
    Returns:
        list: List of visual inputs
    """
    visual_inputs = []
    
    for ctx_key, ctx_value in context.items():
        if isinstance(ctx_value, dict) and 'visual' in ctx_value:
            visual_inputs.append({
                'source': ctx_key,
                'visual': ctx_value['visual'],
                'type': ctx_value.get('type', 'unknown'),
                'timestamp': ctx_value.get('timestamp', time.time())
            })
    
    return visual_inputs 