import { AUTH_ENDPOINTS } from "../config/api";
import { getStoredToken, clearAuthSession } from "./authStorage";

/**
 * Reusable authenticated API request helper.
 * - Reads the stored JWT from Expo SecureStore (never logs tokens).
 * - Automatically attaches the `Authorization: Bearer <token>` header.
 * - Handles HTTP 401 (clears expired/invalid local session) and HTTP 403 (role forbidden).
 */
export const authenticatedRequest = async (url, options = {}) => {
  const {
    method = "GET",
    headers = {},
    body,
    onUnauthorized,
    onForbidden,
  } = options;

  const token = await getStoredToken();

  if (!token) {
    await clearAuthSession();
    if (typeof onUnauthorized === "function") {
      onUnauthorized();
    }
    return {
      ok: false,
      status: 401,
      isUnauthorized: true,
      isForbidden: false,
      data: {
        success: false,
        message: "Authentication required. Please sign in.",
      },
    };
  }

  const requestHeaders = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    ...headers,
  };

  let serializedBody;
  if (body !== undefined && body !== null) {
    if (typeof body === "string") {
      serializedBody = body;
    } else {
      requestHeaders["Content-Type"] =
        requestHeaders["Content-Type"] || "application/json";
      serializedBody = JSON.stringify(body);
    }
  }

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      ...(serializedBody !== undefined ? { body: serializedBody } : {}),
    });

    let data = null;
    try {
      data = await response.json();
    } catch (_parseErr) {
      data = null;
    }

    if (response.status === 401) {
      await clearAuthSession();
      if (typeof onUnauthorized === "function") {
        onUnauthorized();
      }
      return {
        ok: false,
        status: 401,
        isUnauthorized: true,
        isForbidden: false,
        data: data || {
          success: false,
          message: "Session expired or invalid. Please sign in again.",
        },
      };
    }

    if (response.status === 403) {
      if (typeof onForbidden === "function") {
        onForbidden(data);
      }
      return {
        ok: false,
        status: 403,
        isUnauthorized: false,
        isForbidden: true,
        data: data || {
          success: false,
          message:
            "Access forbidden. You do not have permission to access this resource.",
        },
      };
    }

    return {
      ok: response.ok && Boolean(data?.success !== false),
      status: response.status,
      isUnauthorized: false,
      isForbidden: false,
      data,
    };
  } catch (_networkError) {
    return {
      ok: false,
      status: 0,
      isUnauthorized: false,
      isForbidden: false,
      isNetworkError: true,
      data: {
        success: false,
        message:
          "Unable to connect to the VeriWrite server. Ensure the backend is running and your device is on the same Wi-Fi network.",
      },
    };
  }
};

export const fetchCurrentUserProfile = async (options = {}) => {
  return authenticatedRequest(AUTH_ENDPOINTS.ME, {
    method: "GET",
    ...options,
  });
};
