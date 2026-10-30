import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  TOKEN_STORAGE_KEY,
  loginUser,
  registerUser,
  getCurrentUser,
} from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Initialize session: verify token and load user profile on mount
  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!storedToken) {
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const userProfile = await getCurrentUser();
        if (isMounted) {
          setUser(userProfile);
          setToken(storedToken);
          setAuthError(null);
        }
      } catch {
        // Token is invalid or expired
        if (isMounted) {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    // Listen for session expiry event dispatched by axios response interceptor
    const handleSessionExpired = () => {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setUser(null);
      setToken(null);
      setAuthError('Your session has expired. Please sign in again.');
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => {
      isMounted = false;
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, []);

  const login = useCallback(async ({ email, password }) => {
    setAuthError(null);
    try {
      const data = await loginUser({ email, password });
      const { access_token, user: userProfile } = data;

      localStorage.setItem(TOKEN_STORAGE_KEY, access_token);
      setToken(access_token);
      setUser(userProfile);
      return { success: true, user: userProfile };
    } catch (err) {
      const message =
        err.response?.data?.detail ||
        err.message ||
        'Unable to sign in. Please verify your credentials.';
      setAuthError(message);
      return { success: false, error: message };
    }
  }, []);

  const register = useCallback(async ({ name, email, password }) => {
    setAuthError(null);
    try {
      const newUser = await registerUser({ name, email, password });
      return { success: true, user: newUser };
    } catch (err) {
      const message =
        err.response?.data?.detail ||
        err.message ||
        'Registration failed. Please try again.';
      setAuthError(message);
      return { success: false, error: message };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
    setToken(null);
    setAuthError(null);
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isLoading,
    authError,
    clearAuthError,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
