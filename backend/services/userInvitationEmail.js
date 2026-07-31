const nodemailer = require("nodemailer");

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function config() {
  const value = {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "",
  };
  const missing = Object.entries(value)
    .filter(([key, item]) => ["host", "port", "user", "pass", "from"].includes(key) && !item)
    .map(([key]) => key.toUpperCase());
  if (missing.length) throw new Error(`Missing SMTP configuration: ${missing.join(", ")}`);
  return value;
}

function transporter() {
  const c = config();
  return nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: { user: c.user, pass: c.pass },
  });
}

function baseUrl() {
  return String(process.env.APP_BASE_URL || "https://crm.blueoceanforever.com").replace(/\/+$/, "");
}

function roleLabel(role) {
  return String(role || "viewer").replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
}

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

async function verifyInvitationEmailTransport() {
  await transporter().verify();
}

async function sendUserInvitationEmail({ email, fullName, role, token, expiresAt }) {
  const c = config();
  const link = `${baseUrl()}/accept-invitation?token=${encodeURIComponent(token)}`;
  const expiry = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta", dateStyle: "full", timeStyle: "short",
  }).format(new Date(expiresAt));
  const result = await transporter().sendMail({
    from: c.from,
    to: email,
    subject: "You are invited to MII Platform",
    text: [
      `Hello ${fullName},`, "", "You have been invited to MII Platform.",
      `Role: ${roleLabel(role)}`, "", "Create your password using this one-time link:",
      link, "", `The link expires on ${expiry} WIB.`, "",
      "If you were not expecting this invitation, ignore this email.",
    ].join("\n"),
    html: `<!doctype html><html><body style="margin:0;background:#f4f7fa;font-family:Arial;color:#1f2937">
      <div style="max-width:620px;margin:auto;padding:28px 16px">
        <div style="background:#17365d;color:white;padding:24px;border-radius:12px 12px 0 0"><h1 style="margin:0;font-size:24px">Welcome to MII Platform</h1></div>
        <div style="background:white;padding:28px;border:1px solid #dbe3ec;border-top:0;border-radius:0 0 12px 12px">
          <p>Hello ${esc(fullName)},</p><p>You have been invited with the role <strong>${esc(roleLabel(role))}</strong>.</p>
          <p style="margin:28px 0"><a href="${esc(link)}" style="display:inline-block;padding:13px 20px;border-radius:7px;background:#0f766e;color:white;text-decoration:none;font-weight:bold">Create password</a></p>
          <p style="color:#64748b;font-size:13px">This one-time link expires on ${esc(expiry)} WIB.</p>
          <p style="color:#64748b;font-size:13px">If you were not expecting this invitation, ignore this email.</p>
        </div>
      </div></body></html>`,
  });
  return { messageId: result.messageId, link };
}

module.exports = { sendUserInvitationEmail, verifyInvitationEmailTransport };
