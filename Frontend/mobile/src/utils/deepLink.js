import * as Linking from "expo-linking";

/**
 * Safely inspects an incoming deep link URL and extracts a password reset token if present.
 * Supports:
 * - Expo Go development links: exp://<IP>:8081/--/reset-password/<token> or ?token=<token>
 * - Custom scheme links: veriwrite://reset-password/<token> or ?token=<token>
 * - HTTP reset paths: http://<IP>:5000/api/auth/reset-password/<token>
 * Never logs raw tokens.
 */
export const parseResetPasswordDeepLink = (url) => {
  if (!url || typeof url !== "string") {
    return { isResetPasswordRoute: false, token: null };
  }

  try {
    const parsed = Linking.parse(url);
    const rawPath = (parsed?.path || "").replace(/^\/+|\/+$/g, "");
    const queryToken =
      typeof parsed?.queryParams?.token === "string"
        ? parsed.queryParams.token.trim()
        : null;

    // Check if the path or hostname targets reset-password
    const isResetRouteByHost =
      parsed?.hostname === "reset-password" ||
      rawPath.startsWith("reset-password") ||
      rawPath.includes("auth/reset-password") ||
      url.includes("reset-password");

    if (!isResetRouteByHost) {
      return { isResetPasswordRoute: false, token: null };
    }

    if (queryToken) {
      return { isResetPasswordRoute: true, token: queryToken };
    }

    // Extract token segment after "reset-password/" or "reset-password-link/"
    const match = url.match(/reset-password(?:-link)?\/([^/?#]+)/i);
    if (match && match[1]) {
      const candidate = decodeURIComponent(match[1]).trim();
      return {
        isResetPasswordRoute: true,
        token: candidate.length > 0 ? candidate : null,
      };
    }

    // Matched reset-password route, but token segment is missing
    return { isResetPasswordRoute: true, token: null };
  } catch (_err) {
    return { isResetPasswordRoute: false, token: null };
  }
};
