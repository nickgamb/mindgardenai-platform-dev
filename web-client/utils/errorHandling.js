// Utility functions for handling errors gracefully

/**
 * Handles API errors and returns a user-friendly error message
 * @param {Error} error - The error object
 * @param {string} context - Context of where the error occurred
 * @returns {string} User-friendly error message
 */
export const handleApiError = (error, context = '') => {
  console.error(`${context} Error:`, error);

  // Network errors
  if (error.isNetworkError || error.code === 'NETWORK_ERROR' || error.code === 'ERR_NETWORK') {
    return 'Network connection error. Please check your internet connection and try again.';
  }

  // Timeout errors
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }

  // HTTP status errors
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;

    switch (status) {
      case 400:
        return data?.message || 'Invalid request. Please check your input and try again.';
      case 401:
        return 'Authentication required. Please log in again.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 409:
        return data?.message || 'Conflict occurred. Please try again.';
      case 422:
        return data?.message || 'Validation error. Please check your input.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
        return 'Server error. Please try again later.';
      case 502:
      case 503:
      case 504:
        return 'Service temporarily unavailable. Please try again later.';
      default:
        return data?.message || `Unexpected error (${status}). Please try again.`;
    }
  }

  // Generic error messages
  if (error.message) {
    // Don't expose internal error messages to users
    if (error.message.includes('Network Error') || error.message.includes('timeout')) {
      return 'Connection error. Please check your internet connection.';
    }
    
    // For development, show more details
    if (process.env.NODE_ENV === 'development') {
      return `Error: ${error.message}`;
    }
    
    return 'An unexpected error occurred. Please try again.';
  }

  return 'An unexpected error occurred. Please try again.';
};

/**
 * Determines if an error should be shown to the user
 * @param {Error} error - The error object
 * @returns {boolean} Whether to show the error
 */
export const shouldShowError = (error) => {
  // Don't show network errors that are likely temporary
  if (error.isNetworkError || error.code === 'NETWORK_ERROR' || error.code === 'ERR_NETWORK') {
    return false;
  }

  // Don't show timeout errors
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return false;
  }

  // Show authentication errors
  if (error.response?.status === 401 || error.response?.status === 403) {
    return true;
  }

  // Show server errors
  if (error.response?.status >= 500) {
    return true;
  }

  // Show validation errors
  if (error.response?.status === 400 || error.response?.status === 422) {
    return true;
  }

  return true;
};

/**
 * Creates a safe async function wrapper that handles errors gracefully
 * @param {Function} asyncFn - The async function to wrap
 * @param {Function} onError - Error handler function
 * @param {string} context - Context for error messages
 * @returns {Function} Wrapped function
 */
export const createSafeAsyncFunction = (asyncFn, onError, context = '') => {
  return async (...args) => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      const errorMessage = handleApiError(error, context);
      if (onError) {
        onError(errorMessage);
      }
      throw error; // Re-throw to allow calling code to handle if needed
    }
  };
};

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} Promise that resolves with the function result
 */
export const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain errors
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw error;
      }
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}; 