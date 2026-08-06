const express = require("express");
const pool = require("../db/database");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const READ_ROLES = ["admin", "manager", "sales", "viewer"];
const WRITE_ROLES = ["admin", "manager", "sales"];
const STATUSES = new Set(["new", "contacted", "qualified", "converted", "disqualified"]);

const nullable = (value) => {
  if (value === undefined || value === null) return null;
  const result = typeof value === "string" ? value.trim() : value;
  return result === "" ? null : result;
};
const isManager = (user) => ["admin", "manager"].includes(user?.role);
const sendError = (res, error) => res.status(Number(error.status) || 500).json({
  status: "ERROR", message: error.message || "Internal server error",
});
const visibility = (user, index = 1) => user?.role === "sales"
  ? { clause: `l.owner_id = $${index}`, parameters: [user.userId] }
  : { clause: "TRUE", parameters: [] };

async function ownerId(client, user, requested) {
  const value = nullable(requested) || user.userId;
  if (!isManager(user) && value !== user.userId) {
    throw Object.assign(new Error("Only administrators and managers can assign another lead owner"), { status: 403 });
  }
  const found = await client.query(
    `SELECT user_id FROM app_users WHERE user_id=$1 AND is_active=true
     AND role IN ('admin','manager','sales')`, [value]
  );
  if (!found.rowCount) throw Object.assign(new Error("Lead owner is not an active sales user"), { status: 400 });
  return value;
}

function payload(body, existing = {}) {
  const result = {
    accountType: String(body.AccountType ?? existing.account_type ?? "organization").toLowerCase(),
    name: String(body.Name ?? existing.name ?? "").trim(),
    contactName: String(body.ContactName ?? existing.contact_name ?? "").trim(),
    contactTitle: nullable(body.ContactTitle ?? existing.contact_title),
    contactPhone: String(body.ContactPhone ?? existing.contact_phone ?? "").trim(),
    contactEmail: nullable(body.ContactEmail ?? existing.contact_email),
    industry: nullable(body.Industry ?? existing.industry), province: nullable(body.Province ?? existing.province),
    address: nullable(body.Address ?? existing.address), source: nullable(body.Source ?? existing.source),
    productInterest: nullable(body.ProductInterest ?? existing.product_interest),
    estimatedValue: Number(body.EstimatedValue ?? existing.estimated_value ?? 0),
    status: String(body.Status ?? existing.status ?? "new").toLowerCase(),
    nextAction: nullable(body.NextAction ?? existing.next_action),
    nextActionAt: nullable(body.NextActionAt ?? existing.next_action_at),
    notes: nullable(body.Notes ?? existing.notes),
    disqualifiedReason: nullable(body.DisqualifiedReason ?? existing.disqualified_reason),
  };
  if (!result.name || !result.contactName || !result.contactPhone) {
    throw Object.assign(new Error("Lead name, PIC name, and PIC phone are required"), { status: 400 });
  }
  if (!new Set(["organization", "individual"]).has(result.accountType)) {
    throw Object.assign(new Error("Account type is invalid"), { status: 400 });
  }
  if (!STATUSES.has(result.status) || result.status === "converted") {
    throw Object.assign(new Error("Lead status is invalid; use Convert for converted leads"), { status: 400 });
  }
  if (!Number.isFinite(result.estimatedValue) || result.estimatedValue < 0) {
    throw Object.assign(new Error("Estimated value must be zero or greater"), { status: 400 });
  }
  if (Boolean(result.nextAction) !== Boolean(result.nextActionAt)) {
    throw Object.assign(new Error("Next action and its date/time must both be provided"), { status: 400 });
  }
  if (result.status === "disqualified" && !result.disqualifiedReason) {
    throw Object.assign(new Error("Disqualification reason is required"), { status: 400 });
  }
  return result;
}

const SELECT = `SELECT l.*, owner.full_name AS owner_name,
  c.company AS converted_customer_name
  FROM sales_leads l
  JOIN app_users owner ON owner.user_id=l.owner_id
  LEFT JOIN customers c ON c.customer_id=l.converted_customer_id`;

router.get("/owners", requireAuth, requireRole(...READ_ROLES), async (_req, res) => {
  try {
    const result = await pool.query(`SELECT user_id, full_name, email FROM app_users
      WHERE is_active=true AND role IN ('admin','manager','sales') ORDER BY full_name`);
    res.json(result.rows);
  } catch (error) { sendError(res, error); }
});

router.get("/summary", requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  try {
    const visible = visibility(req.user);
    const result = await pool.query(`SELECT
      COUNT(*) FILTER (WHERE status NOT IN ('converted','disqualified'))::integer AS active_count,
      COUNT(*) FILTER (WHERE status='qualified')::integer AS qualified_count,
      COUNT(*) FILTER (WHERE status='converted')::integer AS converted_count,
      COUNT(*) FILTER (WHERE status NOT IN ('converted','disqualified') AND next_action_at<NOW())::integer AS overdue_actions
      FROM sales_leads l WHERE ${visible.clause}`, visible.parameters);
    res.json(result.rows[0]);
  } catch (error) { sendError(res, error); }
});

router.get("/", requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  try {
    const visible = visibility(req.user);
    const parameters = [...visible.parameters];
    const clauses = [visible.clause];
    if (nullable(req.query.status) && STATUSES.has(req.query.status)) {
      parameters.push(req.query.status); clauses.push(`l.status=$${parameters.length}`);
    }
    if (nullable(req.query.search)) {
      parameters.push(req.query.search); const i = parameters.length;
      clauses.push(`(l.name ILIKE '%'||$${i}||'%' OR l.contact_name ILIKE '%'||$${i}||'%' OR l.product_interest ILIKE '%'||$${i}||'%')`);
    }
    const result = await pool.query(`${SELECT} WHERE ${clauses.join(" AND ")}
      ORDER BY CASE WHEN l.status IN ('converted','disqualified') THEN 1 ELSE 0 END,
      l.next_action_at NULLS LAST, l.updated_at DESC`, parameters);
    res.json(result.rows);
  } catch (error) { sendError(res, error); }
});

router.post("/", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  const client = await pool.connect();
  try {
    const value = payload(req.body || {});
    const owner = await ownerId(client, req.user, req.body?.OwnerID);
    const result = await client.query(`INSERT INTO sales_leads (
      account_type,name,contact_name,contact_title,contact_phone,contact_email,
      industry,province,address,source,product_interest,estimated_value,status,
      owner_id,next_action,next_action_at,notes,disqualified_reason,created_by,updated_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$19)
    RETURNING lead_id`, [value.accountType,value.name,value.contactName,value.contactTitle,value.contactPhone,
      value.contactEmail,value.industry,value.province,value.address,value.source,value.productInterest,
      value.estimatedValue,value.status,owner,value.nextAction,value.nextActionAt,value.notes,
      value.disqualifiedReason,req.user.userId]);
    const created = await pool.query(`${SELECT} WHERE l.lead_id=$1`, [result.rows[0].lead_id]);
    res.status(201).json({ status: "OK", lead: created.rows[0] });
  } catch (error) { sendError(res, error); } finally { client.release(); }
});

router.put("/:id", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const visible = visibility(req.user, 2);
    const current = await client.query(`SELECT l.* FROM sales_leads l WHERE l.lead_id=$1
      AND ${visible.clause} FOR UPDATE`, [req.params.id, ...visible.parameters]);
    if (!current.rowCount) throw Object.assign(new Error("Lead not found"), { status: 404 });
    if (current.rows[0].status === "converted") throw Object.assign(new Error("Converted leads cannot be edited"), { status: 409 });
    const value = payload(req.body || {}, current.rows[0]);
    const owner = await ownerId(client, req.user, req.body?.OwnerID || current.rows[0].owner_id);
    await client.query(`UPDATE sales_leads SET account_type=$2,name=$3,contact_name=$4,
      contact_title=$5,contact_phone=$6,contact_email=$7,industry=$8,province=$9,address=$10,
      source=$11,product_interest=$12,estimated_value=$13,status=$14,owner_id=$15,
      next_action=$16,next_action_at=$17,notes=$18,disqualified_reason=$19,
      updated_by=$20,updated_at=NOW() WHERE lead_id=$1`, [req.params.id,value.accountType,value.name,
      value.contactName,value.contactTitle,value.contactPhone,value.contactEmail,value.industry,value.province,
      value.address,value.source,value.productInterest,value.estimatedValue,value.status,owner,value.nextAction,
      value.nextActionAt,value.notes,value.disqualifiedReason,req.user.userId]);
    await client.query("COMMIT");
    const updated = await pool.query(`${SELECT} WHERE l.lead_id=$1`, [req.params.id]);
    res.json({ status: "OK", lead: updated.rows[0] });
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); sendError(res, error); }
  finally { client.release(); }
});

router.post("/:id/convert", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const visible = visibility(req.user, 2);
    const found = await client.query(`SELECT l.* FROM sales_leads l WHERE lead_id=$1
      AND ${visible.clause} FOR UPDATE`, [req.params.id, ...visible.parameters]);
    if (!found.rowCount) throw Object.assign(new Error("Lead not found"), { status: 404 });
    const lead = found.rows[0];
    if (lead.status !== "qualified") throw Object.assign(new Error("Only a qualified lead can be converted"), { status: 409 });
    const customer = await client.query(`INSERT INTO customers (
      account_type,company,industry,contact_person,position,province,email,telephone,address,
      notes,lead_source,created_by,assigned_to
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [lead.account_type,lead.name,lead.industry,lead.contact_name,lead.contact_title,lead.province,
       lead.contact_email,lead.contact_phone,lead.address,lead.notes,lead.source,req.user.userId,lead.owner_id]);
    const customerId = customer.rows[0].customer_id;
    await client.query(`INSERT INTO customer_assignment_history
      (customer_id,previous_assigned_to,assigned_to,changed_by,reason)
      VALUES ($1,NULL,$2,$3,'Converted from lead')`, [customerId,lead.owner_id,req.user.userId]);
    const contact = await client.query(`INSERT INTO customer_contacts (
      customer_id,full_name,job_title,telephone,email,is_primary,is_active,created_by,updated_by
    ) VALUES ($1,$2,$3,$4,$5,true,true,$6,$6) RETURNING *`,
      [customerId,lead.contact_name,lead.contact_title,lead.contact_phone,lead.contact_email,req.user.userId]);
    let opportunityId = null;
    if (req.body?.CreateOpportunity) {
      const title = String(req.body.OpportunityTitle || lead.product_interest || `Opportunity - ${lead.name}`).trim();
      const opportunity = await client.query(`INSERT INTO sales_opportunities (
        customer_id,contact_id,owner_id,title,product_interest,description,stage,
        estimated_value,probability,expected_close_date,next_action,next_action_at,created_by,updated_by
      ) VALUES ($1,$2,$3,$4,$5,$6,'qualified',$7,25,$8,$9,$10,$11,$11) RETURNING opportunity_id`,
        [customerId,contact.rows[0].contact_id,lead.owner_id,title,lead.product_interest,lead.notes,
         lead.estimated_value,nullable(req.body.ExpectedCloseDate),lead.next_action,lead.next_action_at,req.user.userId]);
      opportunityId = opportunity.rows[0].opportunity_id;
    }
    await client.query(`UPDATE sales_leads SET status='converted',converted_customer_id=$2,
      converted_opportunity_id=$3,converted_at=NOW(),updated_by=$4,updated_at=NOW()
      WHERE lead_id=$1`, [lead.lead_id,customerId,opportunityId,req.user.userId]);
    await client.query("COMMIT");
    res.json({ status: "OK", customer: customer.rows[0], primaryContact: contact.rows[0], opportunityId });
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); sendError(res, error); }
  finally { client.release(); }
});

router.delete("/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const result = await pool.query(`DELETE FROM sales_leads WHERE lead_id=$1 AND status<>'converted' RETURNING lead_id`, [req.params.id]);
    if (!result.rowCount) return res.status(409).json({ status: "ERROR", message: "Converted leads cannot be deleted" });
    res.json({ status: "OK", message: "Lead deleted" });
  } catch (error) { sendError(res, error); }
});

module.exports = router;
