// Basic rate limiter for password reset requests to prevent abuse
// Limits each IP/email combination to maxRequests within windowMs (default: 5 requests per 15 minutes)

const requestStore = new Map();

export const createRateLimiter = ({
  windowMs = 15 * 60 * 1000,
  maxRequests = 5,
  message = "Too many password reset requests. Please try again after 15 minutes.",
} = {}) => {
  return (req, res, next) => {
    const now = Date.now();
    const ip =
      req.ip ||
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      "unknown";

    // Clean up expired entries opportunistically
    for (const [key, entry] of requestStore.entries()) {
      if (now > entry.resetTime) {
        requestStore.delete(key);
      }
    }

    const record = requestStore.get(ip);

    if (!record || now > record.resetTime) {
      requestStore.set(ip, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }

    if (record.count >= maxRequests) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((record.resetTime - now) / 1000)
      );
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        success: false,
        message,
      });
    }

    record.count += 1;
    return next();
  };
};

export const forgotPasswordRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
});
