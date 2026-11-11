import { AUTH_ENDPOINTS, ASSIGNMENT_ENDPOINTS } from "../config/api";
import { getStoredToken, clearAuthSession } from "./authStorage";

const DEFAULT_UPLOAD_TIMEOUT_MS = 60000; // 60 seconds for up to 10 MB multipart uploads

/**
 Sends a multipart/form-data request using React Native's native XMLHttpRequest.
 Expo SDK 58's WinterCG fetch polyfill does not support React Native `{ uri, name, type }`
 FormData file parts and throws `Unsupported FormDataPart implementation` before sending.
 Native XMLHttpRequest streams `{ uri, name, type }` parts directly and generates the
 multipart boundary automatically when Content-Type is omitted.
 */
const sendFormDataWithXhr = (
  url,
  { method = "POST", headers = {}, body, timeoutMs = DEFAULT_UPLOAD_TIMEOUT_MS }
) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.timeout = timeoutMs;

    Object.keys(headers).forEach((headerName) => {
      // Never manually set Content-Type on FormData; let native XMLHttpRequest generate the boundary
      if (headerName.toLowerCase() === "content-type") {
        return;
      }
      const headerValue = headers[headerName];
      if (headerValue !== undefined && headerValue !== null) {
        xhr.setRequestHeader(headerName, String(headerValue));
      }
    });

    xhr.onload = () => {
      let parsedData = null;
      try {
        const rawText =
          typeof xhr.responseText === "string"
            ? xhr.responseText
            : typeof xhr.response === "string"
              ? xhr.response
              : "";
        parsedData = rawText ? JSON.parse(rawText) : null;
      } catch (_parseErr) {
        parsedData = null;
      }

      resolve({
        status: xhr.status,
        ok: xhr.status >= 200 && xhr.status < 300,
        data: parsedData,
      });
    };

    xhr.onerror = () => {
      reject(new Error("NETWORK_ERROR"));
    };

    xhr.ontimeout = () => {
      reject(new Error("TIMEOUT_ERROR"));
    };

    xhr.onabort = () => {
      reject(new Error("ABORT_ERROR"));
    };

    xhr.send(body);
  });

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

  const isFormDataBody =
    body !== undefined &&
    body !== null &&
    typeof FormData !== "undefined" &&
    body instanceof FormData;

  let serializedBody;
  if (body !== undefined && body !== null) {
    if (isFormDataBody) {
      serializedBody = body;
      delete requestHeaders["Content-Type"];
      delete requestHeaders["content-type"];
    } else if (typeof body === "string") {
      serializedBody = body;
    } else {
      requestHeaders["Content-Type"] =
        requestHeaders["Content-Type"] || "application/json";
      serializedBody = JSON.stringify(body);
    }
  }

  try {
    let responseStatus;
    let responseOk;
    let data = null;

    if (isFormDataBody) {
      const xhrResult = await sendFormDataWithXhr(url, {
        method,
        headers: requestHeaders,
        body: serializedBody,
      });
      responseStatus = xhrResult.status;
      responseOk = xhrResult.ok;
      data = xhrResult.data;
    } else {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        ...(serializedBody !== undefined ? { body: serializedBody } : {}),
      });

      responseStatus = response.status;
      responseOk = response.ok;

      try {
        data = await response.json();
      } catch (_parseErr) {
        data = null;
      }
    }

    if (responseStatus === 401) {
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

    if (responseStatus === 403) {
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
      ok: responseOk && Boolean(data?.success !== false),
      status: responseStatus,
      isUnauthorized: false,
      isForbidden: false,
      data,
    };
  } catch (requestError) {
    const errorCode = requestError?.message || "";
    let errorMessage =
      "Unable to connect to the VeriWrite server. Ensure the backend is running and your device is on the same Wi-Fi network.";

    if (errorCode === "TIMEOUT_ERROR") {
      errorMessage =
        "The upload request timed out. Please check your Wi-Fi connection and try again.";
    } else if (errorCode === "ABORT_ERROR") {
      errorMessage = "The upload request was cancelled. Please try again.";
    }

    return {
      ok: false,
      status: 0,
      isUnauthorized: false,
      isForbidden: false,
      isNetworkError: true,
      data: {
        success: false,
        message: errorMessage,
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

export const fetchMyAssignments = async (options = {}) => {
  return authenticatedRequest(ASSIGNMENT_ENDPOINTS.MY_ASSIGNMENTS, {
    method: "GET",
    ...options,
  });
};
