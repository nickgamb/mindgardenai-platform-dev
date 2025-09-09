import { useState, useCallback, useContext } from 'react';
import { AppContext } from '../contexts/AppContext';
import { handleApiError, shouldShowError, retryWithBackoff } from '../utils/errorHandling';

/**
 * Custom hook for handling API calls with error handling
 * @param {Function} apiFunction - The API function to call
 * @param {Object} options - Configuration options
 * @returns {Object} Object containing call function, loading state, and error state
 */
export const useApiCall = (apiFunction, options = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const { showError, clearError } = useContext(AppContext);

  const {
    showErrorToUser = true,
    retryAttempts = 0,
    retryDelay = 1000,
    onSuccess,
    onError,
    context = ''
  } = options;

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    clearError();

    try {
      let result;
      
      if (retryAttempts > 0) {
        result = await retryWithBackoff(
          () => apiFunction(...args),
          retryAttempts,
          retryDelay
        );
      } else {
        result = await apiFunction(...args);
      }

      setData(result);
      
      if (onSuccess) {
        onSuccess(result);
      }

      return result;
    } catch (error) {
      const errorMessage = handleApiError(error, context);
      setError(errorMessage);

      // Show error to user if configured and error should be shown
      if (showErrorToUser && shouldShowError(error)) {
        showError(errorMessage);
      }

      if (onError) {
        onError(error, errorMessage);
      }

      throw error;
    } finally {
      setLoading(false);
    }
  }, [
    apiFunction,
    showErrorToUser,
    retryAttempts,
    retryDelay,
    onSuccess,
    onError,
    context,
    showError,
    clearError
  ]);

  const reset = useCallback(() => {
    setError(null);
    setData(null);
    clearError();
  }, [clearError]);

  return {
    execute,
    loading,
    error,
    data,
    reset
  };
};

/**
 * Custom hook for handling API calls that don't return data (like POST, PUT, DELETE)
 * @param {Function} apiFunction - The API function to call
 * @param {Object} options - Configuration options
 * @returns {Object} Object containing call function, loading state, and error state
 */
export const useApiAction = (apiFunction, options = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { showError, clearError } = useContext(AppContext);

  const {
    showErrorToUser = true,
    retryAttempts = 0,
    retryDelay = 1000,
    onSuccess,
    onError,
    context = ''
  } = options;

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    clearError();

    try {
      let result;
      
      if (retryAttempts > 0) {
        result = await retryWithBackoff(
          () => apiFunction(...args),
          retryAttempts,
          retryDelay
        );
      } else {
        result = await apiFunction(...args);
      }

      if (onSuccess) {
        onSuccess(result);
      }

      return result;
    } catch (error) {
      const errorMessage = handleApiError(error, context);
      setError(errorMessage);

      // Show error to user if configured and error should be shown
      if (showErrorToUser && shouldShowError(error)) {
        showError(errorMessage);
      }

      if (onError) {
        onError(error, errorMessage);
      }

      throw error;
    } finally {
      setLoading(false);
    }
  }, [
    apiFunction,
    showErrorToUser,
    retryAttempts,
    retryDelay,
    onSuccess,
    onError,
    context,
    showError,
    clearError
  ]);

  const reset = useCallback(() => {
    setError(null);
    clearError();
  }, [clearError]);

  return {
    execute,
    loading,
    error,
    reset
  };
}; 