const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db/database");
const router = express.Router();

const hash = token => crypto.createHash("sha256").update(String(token || "")).digest("hex");
const tokenShape = token => typeof token === "string" && token.length >= 32 && token.length <= 200;
function passwordError(password) {
  const value = String(password || "");
  if (value.length < 12) return "Password must contain at least 12 characters.";
  if (value.length > 128) return "Password is too long.";
  if (!/[a-z]/.test(value)) return "Password must contain a lowercase letter.";
  if (!/[A-Z]/.test(value)) return "Password must contain an uppercase letter.";
  if (!/[0-9]/.test(value)) return "Password must contain a number.";
  return "";
}
const query = `SELECT ui.invitation_id,ui.user_id,ui.expires_at,u.full_name,u.email,u.role
  FROM user_invitations ui JOIN app_users u ON u.user_id=ui.user_id
  WHERE ui.token_hash=$1 AND ui.accepted_at IS NULL AND ui.revoked_at IS NULL
    AND ui.expires_at>NOW() LIMIT 1`;

router.use((_req,res,next)=>{res.set("Cache-Control","no-store, max-age=0");next();});
router.get("/:token", async (req,res)=>{
  try {
    if (!tokenShape(req.params.token)) return res.status(410).json({status:"ERROR",message:"This invitation is invalid or has expired."});
    const result=await pool.query(query,[hash(req.params.token)]);
    if(!result.rowCount) return res.status(410).json({status:"ERROR",message:"This invitation is invalid or has expired."});
    const row=result.rows[0];
    res.json({status:"OK",invitation:{fullName:row.full_name,email:row.email,role:row.role,expiresAt:row.expires_at}});
  } catch { res.status(500).json({status:"ERROR",message:"Unable to validate this invitation."}); }
});
router.post("/:token/accept", async (req,res)=>{
  const client=await pool.connect();
  try {
    if (!tokenShape(req.params.token)) return res.status(410).json({status:"ERROR",message:"This invitation is invalid or has expired."});
    const invalid=passwordError(req.body.Password);
    if(invalid) return res.status(400).json({status:"ERROR",message:invalid});
    await client.query("BEGIN");
    const result=await client.query(`${query} FOR UPDATE`,[hash(req.params.token)]);
    if(!result.rowCount){await client.query("ROLLBACK");return res.status(410).json({status:"ERROR",message:"This invitation is invalid or has expired."});}
    const row=result.rows[0];
    const passwordHash=await bcrypt.hash(String(req.body.Password),12);
    await client.query(`UPDATE app_users SET password_hash=$2,is_active=TRUE WHERE user_id=$1`,[row.user_id,passwordHash]);
    await client.query(`UPDATE user_invitations SET accepted_at=NOW() WHERE invitation_id=$1`,[row.invitation_id]);
    await client.query(`UPDATE user_invitations SET revoked_at=NOW() WHERE user_id=$1 AND invitation_id<>$2 AND accepted_at IS NULL AND revoked_at IS NULL`,[row.user_id,row.invitation_id]);
    await client.query("COMMIT");
    res.json({status:"OK",message:"Your password has been created. You can now sign in."});
  } catch { try{await client.query("ROLLBACK");}catch{} res.status(500).json({status:"ERROR",message:"Unable to accept the invitation."}); }
  finally{client.release();}
});
module.exports=router;
