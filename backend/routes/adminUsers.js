const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db/database");
const { requireAuth, requireRole } = require("../middleware/auth");
const { sendUserInvitationEmail } = require("../services/userInvitationEmail");

const router = express.Router();
const roles = new Set(["admin", "manager", "sales", "technician", "viewer"]);
const hours = () => {
  const value = Number(process.env.INVITATION_EXPIRES_HOURS || 24);
  return Number.isFinite(value) && value >= 1 && value <= 168 ? value : 24;
};
const emailValue = value => String(value || "").trim().toLowerCase();
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validRole = value => {
  const role = String(value || "viewer").trim().toLowerCase();
  return roles.has(role) ? role : null;
};
const tokenPair = () => {
  const token = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, hash };
};

router.use(requireAuth, requireRole("admin"));

router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.user_id,u.full_name,u.email,u.role,u.is_active,u.created_at,
        i.expires_at AS invitation_expires_at,
        CASE WHEN u.is_active THEN 'active'
          WHEN i.accepted_at IS NOT NULL OR i.revoked_at IS NOT NULL THEN 'inactive'
          WHEN i.expires_at > NOW() THEN 'invited'
          WHEN i.expires_at IS NOT NULL THEN 'expired'
          ELSE 'inactive' END AS invitation_status
      FROM app_users u
      LEFT JOIN LATERAL (
        SELECT expires_at,accepted_at,revoked_at FROM user_invitations
        WHERE user_id=u.user_id ORDER BY created_at DESC LIMIT 1
      ) i ON TRUE
      ORDER BY u.is_active DESC,u.full_name,u.user_id
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ status: "ERROR", message: error.message });
  }
});

router.post("/invite", async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = String(req.body.UserID || "").trim();
    const fullName = String(req.body.FullName || "").trim();
    const email = emailValue(req.body.Email);
    const role = validRole(req.body.Role);
    if (!userId || !fullName || !email || !role)
      return res.status(400).json({ status: "ERROR", message: "User ID, full name, email, and a valid role are required." });
    if (!validEmail(email))
      return res.status(400).json({ status: "ERROR", message: "Enter a valid email address." });

    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT user_id FROM app_users WHERE user_id=$1 OR LOWER(email)=LOWER($2) LIMIT 1`,
      [userId, email]
    );
    if (existing.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ status: "ERROR", message: "That user ID or email already exists." });
    }

    const placeholder = await bcrypt.hash(crypto.randomBytes(48).toString("base64url"), 12);
    const userResult = await client.query(
      `INSERT INTO app_users(user_id,full_name,email,password_hash,role,is_active)
       VALUES($1,$2,$3,$4,$5,FALSE)
       RETURNING user_id,full_name,email,role,is_active,created_at`,
      [userId, fullName, email, placeholder, role]
    );
    const { token, hash } = tokenPair();
    const expiresAt = new Date(Date.now() + hours() * 3600000);
    await client.query(
      `INSERT INTO user_invitations(user_id,token_hash,created_by,expires_at)
       VALUES($1,$2,$3,$4)`,
      [userId, hash, req.user?.userId || null, expiresAt]
    );
    const sent = await sendUserInvitationEmail({ email, fullName, role, token, expiresAt });
    await client.query(`UPDATE user_invitations SET email_sent_at=NOW() WHERE token_hash=$1`, [hash]);
    await client.query("COMMIT");
    res.status(201).json({
      status: "OK", message: "User created and invitation email sent.",
      user: { ...userResult.rows[0], invitation_status: "invited", invitation_expires_at: expiresAt },
      email_message_id: sent.messageId || null,
    });
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    res.status(500).json({ status: "ERROR", message: "Unable to create the user and send the invitation." });
  } finally { client.release(); }
});

router.post("/:userId/resend-invitation", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT user_id,full_name,email,role,is_active FROM app_users WHERE user_id=$1 FOR UPDATE`,
      [req.params.userId]
    );
    if (!result.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ status: "ERROR", message: "User not found." }); }
    const user = result.rows[0];
    if (user.is_active) { await client.query("ROLLBACK"); return res.status(409).json({ status: "ERROR", message: "Active users do not need an invitation." }); }
    await client.query(`UPDATE user_invitations SET revoked_at=NOW() WHERE user_id=$1 AND accepted_at IS NULL AND revoked_at IS NULL`, [user.user_id]);
    const { token, hash } = tokenPair();
    const expiresAt = new Date(Date.now() + hours() * 3600000);
    await client.query(`INSERT INTO user_invitations(user_id,token_hash,created_by,expires_at) VALUES($1,$2,$3,$4)`, [user.user_id, hash, req.user?.userId || null, expiresAt]);
    const sent = await sendUserInvitationEmail({ email: user.email, fullName: user.full_name, role: user.role, token, expiresAt });
    await client.query(`UPDATE user_invitations SET email_sent_at=NOW() WHERE token_hash=$1`, [hash]);
    await client.query("COMMIT");
    res.json({ status: "OK", message: "A new invitation email was sent.", invitation_expires_at: expiresAt, email_message_id: sent.messageId || null });
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    res.status(500).json({ status: "ERROR", message: "Unable to resend the invitation." });
  } finally { client.release(); }
});

router.patch("/:userId", async (req, res) => {
  try {
    const role = req.body.Role === undefined ? null : validRole(req.body.Role);
    const active = typeof req.body.IsActive === "boolean" ? req.body.IsActive : null;
    if (req.body.Role !== undefined && !role)
      return res.status(400).json({ status: "ERROR", message: "Invalid role." });
    const current = await pool.query(`SELECT is_active FROM app_users WHERE user_id=$1`, [req.params.userId]);
    if (!current.rowCount) return res.status(404).json({ status: "ERROR", message: "User not found." });
    if (active === true && !current.rows[0].is_active)
      return res.status(409).json({ status: "ERROR", message: "Invited users activate themselves by accepting the invitation." });
    const result = await pool.query(
      `UPDATE app_users SET role=COALESCE($2,role),is_active=COALESCE($3::boolean,is_active)
       WHERE user_id=$1 RETURNING user_id,full_name,email,role,is_active,created_at`,
      [req.params.userId, role, active]
    );
    res.json({ status: "OK", user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ status: "ERROR", message: error.message });
  }
});

module.exports = router;
