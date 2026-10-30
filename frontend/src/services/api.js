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

/* ==========================================================================
   Exam & Question Management Services (Teacher Only)
   ========================================================================== */

/**
 * Create a new exam.
 */
export async function createExam(examData) {
  const response = await apiClient.post('/exams', examData);
  return response.data;
}

/**
 * List exams created by authenticated teacher with optional status/search filters.
 */
export async function getExams({ status, search } = {}) {
  const params = {};
  if (status && status !== 'all') params.status = status;
  if (search && search.trim()) params.search = search.trim();

  const response = await apiClient.get('/exams', { params });
  return response.data;
}

/**
 * Retrieve a single exam detail with its questions.
 */
export async function getExam(examId) {
  const response = await apiClient.get(`/exams/${examId}`);
  return response.data;
}

/**
 * Update an existing exam.
 */
export async function updateExam(examId, examData) {
  const response = await apiClient.put(`/exams/${examId}`, examData);
  return response.data;
}

/**
 * Delete an eligible draft exam.
 */
export async function deleteExam(examId) {
  const response = await apiClient.delete(`/exams/${examId}`);
  return response.data;
}

/**
 * Add a question to an exam.
 */
export async function addQuestion(examId, questionData) {
  const response = await apiClient.post(`/exams/${examId}/questions`, questionData);
  return response.data;
}

/**
 * Update an existing question within an exam.
 */
export async function updateQuestion(examId, questionId, questionData) {
  const response = await apiClient.put(`/exams/${examId}/questions/${questionId}`, questionData);
  return response.data;
}

/**
 * Delete a question from an exam.
 */
export async function deleteQuestion(examId, questionId) {
  const response = await apiClient.delete(`/exams/${examId}/questions/${questionId}`);
  return response.data;
}

/**
 * Reorder questions within an exam.
 */
export async function reorderQuestions(examId, questionIds) {
  const response = await apiClient.put(`/exams/${examId}/questions/reorder`, {
    question_ids: questionIds,
  });
  return response.data;
}

/**
 * Publish a draft exam.
 */
export async function publishExam(examId) {
  const response = await apiClient.post(`/exams/${examId}/publish`);
  return response.data;
}

/**
 * Close a published exam.
 */
export async function closeExam(examId) {
  const response = await apiClient.post(`/exams/${examId}/close`);
  return response.data;
}

/* ==========================================================================
   Student Examination Services (Student Only)
   ========================================================================== */

/**
 * List published exams available to the student with optional status/search filters.
 */
export async function getAvailableExams({ status, search } = {}) {
  const params = {};
  if (status && status !== 'all') params.status = status;
  if (search && search.trim()) params.search = search.trim();

  const response = await apiClient.get('/student/exams', { params });
  return response.data;
}

/**
 * Retrieve public details of an eligible published exam.
 */
export async function getStudentExam(examId) {
  const response = await apiClient.get(`/student/exams/${examId}`);
  return response.data;
}

/**
 * Start a new attempt or resume an existing ongoing attempt.
 */
export async function startOrResumeAttempt(examId) {
  const response = await apiClient.post(`/student/exams/${examId}/start`);
  return response.data;
}

/**
 * List the authenticated student's previous and current attempts.
 */
export async function getStudentAttempts() {
  const response = await apiClient.get('/student/attempts');
  return response.data;
}

/**
 * Retrieve full details for a student's own attempt.
 */
export async function getStudentAttempt(attemptId) {
  const response = await apiClient.get(`/student/attempts/${attemptId}`);
  return response.data;
}

/**
 * Retrieve questions for an active attempt (correct answers omitted).
 */
export async function getAttemptQuestions(attemptId) {
  const response = await apiClient.get(`/student/attempts/${attemptId}/questions`);
  return response.data;
}

/**
 * Save or autosave a student's draft answer for a specific question.
 */
export async function saveDraftAnswer(attemptId, questionId, draftResponse) {
  const response = await apiClient.put(`/student/attempts/${attemptId}/answers/${questionId}`, {
    draft_response: draftResponse,
  });
  return response.data;
}

/**
 * Explicitly submit an exam attempt.
 */
export async function submitAttempt(attemptId) {
  const response = await apiClient.post(`/student/attempts/${attemptId}/submit`);
  return response.data;
}

/**
 * Retrieve student's accessibility preferences.
 */
export async function getStudentPreferences() {
  const response = await apiClient.get('/student/preferences');
  return response.data;
}

/**
 * Update student's accessibility preferences in MongoDB.
 */
export async function updateStudentPreferences(preferences) {
  const response = await apiClient.put('/student/preferences', preferences);
  return response.data;
}

export default apiClient;
