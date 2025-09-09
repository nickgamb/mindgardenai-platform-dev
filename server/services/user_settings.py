import logging
from services.database import get_user_settings as db_get_user_settings, update_user_settings as db_update_user_settings


def _deep_merge_dicts(base, updates):
    """Recursively merge two dictionaries without modifying inputs."""
    if not isinstance(base, dict):
        return updates
    result = {**base}
    for key, value in (updates or {}).items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _deep_merge_dicts(result[key], value)
        else:
            result[key] = value
    return result

def get_user_settings(user_id):
    """
    Get user-specific settings from database.
    
    Args:
        user_id (str): User identifier
        
    Returns:
        dict: User settings
    """
    settings = db_get_user_settings(user_id) or {}
    # Ensure defaults for feature flags
    feature_flags = settings.get('featureFlags') or {}
    if 'neuroTechWorkloads' not in feature_flags:
        feature_flags['neuroTechWorkloads'] = True
    settings['featureFlags'] = feature_flags
    return settings

def update_user_settings(user_id, settings_dict):
    """
    Update user-specific settings in database.
    
    Args:
        user_id (str): User identifier
        settings_dict (dict): Dictionary of user settings to update
    """
    current = db_get_user_settings(user_id) or {}
    merged = _deep_merge_dicts(current, settings_dict or {})
    # Re-assert defaults for missing flags
    if 'featureFlags' not in merged:
        merged['featureFlags'] = {'neuroTechWorkloads': True}
    else:
        merged['featureFlags'].setdefault('neuroTechWorkloads', True)
    db_update_user_settings(user_id, merged)
    logging.info(f"Updated user settings for user {user_id}: {merged}")

def get_user_preferences(user_id):
    """
    Get user UI preferences and display settings.
    
    Args:
        user_id (str): User identifier
        
    Returns:
        dict: User preferences
    """
    user_settings = get_user_settings(user_id)
    if user_settings and 'preferences' in user_settings:
        return user_settings['preferences']
    return {}

def update_user_preferences(user_id, preferences):
    """
    Update user UI preferences and display settings.
    
    Args:
        user_id (str): User identifier
        preferences (dict): User preferences to update
    """
    current_settings = get_user_settings(user_id) or {}
    current_settings['preferences'] = preferences
    update_user_settings(user_id, current_settings) 