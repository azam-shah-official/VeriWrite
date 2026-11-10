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
};

export const PROTECTED_ENDPOINTS = {
  STUDENT_TEST: `${API_BASE_URL}/student/protected-test`,
  TEACHER_TEST: `${API_BASE_URL}/teacher/protected-test`,
};
