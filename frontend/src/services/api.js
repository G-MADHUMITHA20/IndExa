import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
export const TOKEN_STORAGE_KEY = 'indexa_auth_token';

/**
 * Axios instance configured with base URL and application defaults.
 *
 * SECURITY NOTE ON TOKEN STORAGE:
 * In this prototype, JWT tokens are maintained in client-side storage (localStorage)
 * to facilitate client-side routing.
 * Note: Client-side storage is vulnerable to XSS and is NOT equivalent to HttpOnly,
 * Secure cookies. Passwords are never stored in browser storage, tokens are never
 * passed in URLs, and tokens expire automatically based on server configuration.
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: automatically attach Authorization Bearer token if present
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: detect token expiration or 401s and broadcast session expiry
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Broadcast session expired event if not currently on login or register endpoint
      const url = error.config?.url || '';
      if (!url.includes('/auth/login') && !url.includes('/auth/register')) {
        window.dispatchEvent(new CustomEvent('auth:session-expired'));
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Register a new student account.
 */
export async function registerUser({ name, email, password }) {
  const response = await apiClient.post('/auth/register', {
    name,
    email,
    password,
  });
  return response.data;
}

/**
 * Authenticate existing user credentials and receive access token.
 */
export async function loginUser({ email, password }) {
  const response = await apiClient.post('/auth/login', {
    email,
    password,
  });
  return response.data;
}

/**
 * Fetch the authenticated user's profile.
 */
export async function getCurrentUser() {
  const response = await apiClient.get('/auth/me');
  return response.data;
}

/**
 * Check backend service and database health status (Preserved from Phase 1).
 */
export async function getHealthStatus() {
  try {
    const response = await apiClient.get('/health');
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.detail || error.message || 'Unable to connect to backend service',
    };
  }
}

export default apiClient;
