import nodemailer from "nodemailer";

export const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const getResetPasswordBaseDeepLink = () => {
  return (
    process.env.RESET_PASSWORD_URL ||
    "exp://10.184.97.161:8081/--/reset-password"
  )
    .trim()
    .replace(/\/+$/, "");
};

export const getResetPasswordHttpRedirectUrl = (rawToken = "") => {
  const baseDeepLink = getResetPasswordBaseDeepLink();
  const cleanToken = String(rawToken || "").trim();

  let host = "10.184.97.161";
  try {
    const parsedUrl = new URL(baseDeepLink);
    if (parsedUrl.hostname) {
      host = parsedUrl.hostname;
    }
  } catch (_err) {
    const hostMatch = baseDeepLink.match(
      /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^/:?#]+)/
    );
    if (hostMatch && hostMatch[1]) {
      host = hostMatch[1];
    }
  }

  const backendPort = Number(process.env.PORT) || 5000;
  return `http://${host}:${backendPort}/api/auth/reset-password-link/${encodeURIComponent(
    cleanToken
  )}`;
};

export const isSmtpConfigured = () => {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  );
};

export const sendPasswordResetEmail = async ({ to, name, resetToken }) => {
  if (!isSmtpConfigured()) {
    const configError = new Error(
      "SMTP email credentials are not configured in environment variables."
    );
    configError.code = "SMTP_NOT_CONFIGURED";
    throw configError;
  }

  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const smtpSecure =
    process.env.SMTP_SECURE === "true" || smtpPort === 465;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST.trim(),
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: process.env.SMTP_USER.trim(),
      pass: process.env.SMTP_PASS.trim(),
    },
  });

  const baseResetUrl = getResetPasswordBaseDeepLink();
  const cleanToken = String(resetToken || "").trim();
  const encodedToken = encodeURIComponent(cleanToken);

  // Direct Expo deep link (kept for plain-text and copyable fallback)
  const resetLink = `${baseResetUrl}/${encodedToken}`;

  // Standard HTTP redirect link for the HTML email button (compatible with Gmail / email clients)
  const httpRedirectResetLink = getResetPasswordHttpRedirectUrl(cleanToken);

  const displayUserName = (name || "VeriWrite User").trim() || "VeriWrite User";
  const escapedUserName = escapeHtml(displayUserName);
  const escapedHttpButtonHref = escapeHtml(httpRedirectResetLink);
  const escapedExpoDeepLink = escapeHtml(resetLink);

  const fromAddress =
    process.env.SMTP_FROM ||
    `"VeriWrite Security" <${process.env.SMTP_USER.trim()}>`;

  const mailOptions = {
    from: fromAddress,
    to,
    subject: "VeriWrite Password Reset Request",
    text: [
      `Hello ${displayUserName},`,
      "",
      "We received a request to reset the password for your VeriWrite academic account.",
      "This password reset link is valid for 15 minutes.",
      "",
      "Open Reset Password Page (Mobile Browser Redirect):",
      httpRedirectResetLink,
      "",
      "Complete Expo Deep Link URL (copy and open on your mobile device):",
      resetLink,
      "",
      "If you did not request a password reset, please ignore this email and your password will remain unchanged.",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background-color: #0A0D1A; color: #E2E8F0; border-radius: 16px; border: 1px solid #232944;">
        <h2 style="color: #FFFFFF; margin-top: 0;">VeriWrite Password Reset</h2>
        <p style="color: #94A3B8; line-height: 1.6;">Hello ${escapedUserName},</p>
        <p style="color: #94A3B8; line-height: 1.6;">
          We received a request to reset the password for your VeriWrite account. Use the button or copy the complete reset link below within <strong>15 minutes</strong> to set a new password:
        </p>
        <p style="margin: 24px 0;">
          <a href="${escapedHttpButtonHref}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; background-image: linear-gradient(90deg, #5B50EB, #38BDF8); color: #FFFFFF; text-decoration: none; font-weight: bold; border-radius: 10px;">
            Reset Password
          </a>
        </p>
        <p style="color: #CBD5E1; font-size: 13px; font-weight: bold; margin: 20px 0 8px 0;">
          Copy Complete Reset URL (Backup Deep Link):
        </p>
        <p style="background-color: #141829; border: 1px solid #283254; border-radius: 10px; padding: 12px 14px; margin: 0 0 20px 0; color: #38BDF8; font-family: monospace; font-size: 13px; line-height: 1.5; word-break: break-all; user-select: all; -webkit-user-select: all;">${escapedExpoDeepLink}</p>
        <hr style="border: none; border-top: 1px solid #232944; margin: 20px 0;" />
        <p style="color: #64748B; font-size: 12px; margin-bottom: 0;">
          If you did not request this password reset, you can safely ignore this email.
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};
