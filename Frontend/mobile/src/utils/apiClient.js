import {
  AUTH_ENDPOINTS,
  ASSIGNMENT_ENDPOINTS,
  SUBJECT_ENDPOINTS,
  TEACHER_ENDPOINTS,
} from "../config/api";
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

export const updateCurrentUserProfile = async (profileData, options = {}) => {
  return authenticatedRequest(AUTH_ENDPOINTS.UPDATE_PROFILE, {
    method: "PATCH",
    body: profileData,
    ...options,
  });
};

export const fetchMyAssignments = async (options = {}) => {
  return authenticatedRequest(ASSIGNMENT_ENDPOINTS.MY_ASSIGNMENTS, {
    method: "GET",
    ...options,
  });
};

export const triggerWritingAnalysis = async (assignmentId, options = {}) => {
  const { forceReanalysis = false, ...restOptions } = options;
  return authenticatedRequest(ASSIGNMENT_ENDPOINTS.ANALYZE(assignmentId), {
    method: "POST",
    body: { forceReanalysis },
    ...restOptions,
  });
};

export const fetchAssignmentEvidence = async (assignmentId, options = {}) => {
  return authenticatedRequest(ASSIGNMENT_ENDPOINTS.EVIDENCE(assignmentId), {
    method: "GET",
    ...options,
  });
};

export const fetchTeacherDashboardStats = async (options = {}) => {
  return authenticatedRequest(TEACHER_ENDPOINTS.DASHBOARD_STATS, {
    method: "GET",
    ...options,
  });
};

export const fetchTeacherSubmissions = async (queryParams = "", options = {}) => {
  return authenticatedRequest(TEACHER_ENDPOINTS.SUBMISSIONS(queryParams), {
    method: "GET",
    ...options,
  });
};

export const submitTeacherReview = async (submissionId, reviewData, options = {}) => {
  return authenticatedRequest(TEACHER_ENDPOINTS.SUBMIT_REVIEW(submissionId), {
    method: "PATCH",
    body: reviewData,
    ...options,
  });
};

export const fetchTeacherAssignments = async (options = {}) => {
  return authenticatedRequest(TEACHER_ENDPOINTS.ASSIGNMENTS, {
    method: "GET",
    ...options,
  });
};

export const createTeacherAssignment = async (assignmentData, options = {}) => {
  return authenticatedRequest(TEACHER_ENDPOINTS.CREATE_ASSIGNMENT, {
    method: "POST",
    body: assignmentData,
    ...options,
  });
};

export const updateTeacherAssignment = async (id, assignmentData, options = {}) => {
  return authenticatedRequest(TEACHER_ENDPOINTS.UPDATE_ASSIGNMENT(id), {
    method: "PUT",
    body: assignmentData,
    ...options,
  });
};

export const deleteTeacherAssignment = async (id, options = {}) => {
  return authenticatedRequest(TEACHER_ENDPOINTS.DELETE_ASSIGNMENT(id), {
    method: "DELETE",
    ...options,
  });
};

export const fetchMySubjects = async (options = {}) => {
  return authenticatedRequest(SUBJECT_ENDPOINTS.MY_SUBJECTS, {
    method: "GET",
    ...options,
  });
};

export const createSubject = async (subjectData, options = {}) => {
  return authenticatedRequest(SUBJECT_ENDPOINTS.CREATE, {
    method: "POST",
    body: subjectData,
    ...options,
  });
};

export const updateSubject = async (id, subjectData, options = {}) => {
  return authenticatedRequest(SUBJECT_ENDPOINTS.UPDATE(id), {
    method: "PUT",
    body: subjectData,
    ...options,
  });
};

export const deleteSubject = async (id, options = {}) => {
  return authenticatedRequest(SUBJECT_ENDPOINTS.DELETE(id), {
    method: "DELETE",
    ...options,
  });
};

export const fetchTeacherSubjects = async (teacherId, options = {}) => {
  return authenticatedRequest(SUBJECT_ENDPOINTS.BY_TEACHER(teacherId), {
    method: "GET",
    ...options,
  });
};

/**
 * Task 11: Teacher accepts or rejects an individual finding.
 */
export const submitFindingDecision = async (
  assignmentId,
  findingId,
  decisionData,
  options = {}
) => {
  return authenticatedRequest(
    TEACHER_ENDPOINTS.FINDING_DECISION(assignmentId, findingId),
    {
      method: "PATCH",
      body: decisionData,
      ...options,
    }
  );
};

/**
 * Task 12: Teacher posts feedback or discussion comment on a submission.
 */
export const addTeacherComment = async (
  assignmentId,
  commentData,
  options = {}
) => {
  return authenticatedRequest(TEACHER_ENDPOINTS.COMMENTS(assignmentId), {
    method: "POST",
    body: commentData,
    ...options,
  });
};

/**
 * Task 12: Teacher fetches comments thread for a submission.
 */
export const fetchTeacherComments = async (assignmentId, options = {}) => {
  return authenticatedRequest(TEACHER_ENDPOINTS.COMMENTS(assignmentId), {
    method: "GET",
    ...options,
  });
};

/**
 * Task 13: Teacher fetches append-only audit trail for a submission.
 */
export const fetchTeacherAuditTrail = async (assignmentId, options = {}) => {
  return authenticatedRequest(TEACHER_ENDPOINTS.AUDIT_TRAIL(assignmentId), {
    method: "GET",
    ...options,
  });
};

/**
 * Task 14: Student fetches real-time review status, finding decisions, and teacher feedback.
 */
export const fetchStudentReviewStatus = async (assignmentId, options = {}) => {
  return authenticatedRequest(ASSIGNMENT_ENDPOINTS.REVIEW_STATUS(assignmentId), {
    method: "GET",
    ...options,
  });
};

/**
 * Task 12: Student fetches review comments thread on their submission.
 */
export const fetchStudentComments = async (assignmentId, options = {}) => {
  return authenticatedRequest(ASSIGNMENT_ENDPOINTS.COMMENTS(assignmentId), {
    method: "GET",
    ...options,
  });
};

/**
 * Task 13: Student fetches review history and audit records for their submission.
 */
export const fetchStudentAuditTrail = async (assignmentId, options = {}) => {
  return authenticatedRequest(ASSIGNMENT_ENDPOINTS.AUDIT_TRAIL(assignmentId), {
    method: "GET",
    ...options,
  });
};
