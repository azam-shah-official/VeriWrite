// Centralized Backend API Configuration
// Uses the development computer's local network IPv4 address so physical Android phones on Expo Go can connect
export const LOCAL_NETWORK_IP = "10.184.97.161";
export const BACKEND_PORT = 5000;

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  `http://${LOCAL_NETWORK_IP}:${BACKEND_PORT}/api`;

export const AUTH_ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/auth/login`,
  REGISTER: `${API_BASE_URL}/auth/register`,
  FORGOT_PASSWORD: `${API_BASE_URL}/auth/forgot-password`,
  RESET_PASSWORD: (token) =>
    `${API_BASE_URL}/auth/reset-password/${encodeURIComponent(token)}`,
  ME: `${API_BASE_URL}/auth/me`,
  UPDATE_PROFILE: `${API_BASE_URL}/auth/profile`,
};

export const ASSIGNMENT_ENDPOINTS = {
  MY_ASSIGNMENTS: `${API_BASE_URL}/assignments/my`,
  UPLOAD: `${API_BASE_URL}/assignments/upload`,
  TEACHERS: `${API_BASE_URL}/assignments/teachers`,
  ANALYZE: (id) =>
    `${API_BASE_URL}/assignments/${encodeURIComponent(id)}/analyze`,
  EVIDENCE: (id) =>
    `${API_BASE_URL}/assignments/${encodeURIComponent(id)}/evidence`,
  REVIEW_STATUS: (id) =>
    `${API_BASE_URL}/assignments/${encodeURIComponent(id)}/review-status`,
  COMMENTS: (id) =>
    `${API_BASE_URL}/assignments/${encodeURIComponent(id)}/comments`,
  AUDIT_TRAIL: (id) =>
    `${API_BASE_URL}/assignments/${encodeURIComponent(id)}/audit-trail`,
};

export const SUBJECT_ENDPOINTS = {
  MY_SUBJECTS: `${API_BASE_URL}/subjects/my`,
  CREATE: `${API_BASE_URL}/subjects`,
  UPDATE: (id) => `${API_BASE_URL}/subjects/${encodeURIComponent(id)}`,
  DELETE: (id) => `${API_BASE_URL}/subjects/${encodeURIComponent(id)}`,
  BY_TEACHER: (teacherId) =>
    `${API_BASE_URL}/subjects/teacher/${encodeURIComponent(teacherId)}`,
};

export const TEACHER_ENDPOINTS = {
  DASHBOARD_STATS: `${API_BASE_URL}/teacher/dashboard/stats`,
  SUBMISSIONS: (params = "") =>
    `${API_BASE_URL}/teacher/submissions${params ? `?${params}` : ""}`,
  SUBMIT_REVIEW: (id) =>
    `${API_BASE_URL}/teacher/submissions/${encodeURIComponent(id)}/review`,
  FINDING_DECISION: (id, findingId) =>
    `${API_BASE_URL}/teacher/submissions/${encodeURIComponent(id)}/findings/${encodeURIComponent(findingId)}/decision`,
  COMMENTS: (id) =>
    `${API_BASE_URL}/teacher/submissions/${encodeURIComponent(id)}/comments`,
  AUDIT_TRAIL: (id) =>
    `${API_BASE_URL}/teacher/submissions/${encodeURIComponent(id)}/audit-trail`,
  ASSIGNMENTS: `${API_BASE_URL}/teacher/assignments`,
  CREATE_ASSIGNMENT: `${API_BASE_URL}/teacher/assignments`,
  ASSIGNMENT_BY_ID: (id) =>
    `${API_BASE_URL}/teacher/assignments/${encodeURIComponent(id)}`,
  UPDATE_ASSIGNMENT: (id) =>
    `${API_BASE_URL}/teacher/assignments/${encodeURIComponent(id)}`,
  DELETE_ASSIGNMENT: (id) =>
    `${API_BASE_URL}/teacher/assignments/${encodeURIComponent(id)}`,
};

export const PROTECTED_ENDPOINTS = {
  STUDENT_TEST: `${API_BASE_URL}/student/protected-test`,
  TEACHER_TEST: `${API_BASE_URL}/teacher/protected-test`,
};
