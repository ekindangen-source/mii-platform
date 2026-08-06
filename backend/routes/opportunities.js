const express = require("express");
const pool = require("../db/database");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  customerAccessCondition,
  ensureCustomerAccess,
} = require("../middleware/customerAccess");

const router = express.Router();
const READ_ROLES = ["admin", "manager", "sales", "technician", "viewer"];
const WRITE_ROLES = ["admin", "manager", "sales"];
const STAGES = new Set([
  "prospecting",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
]);
const DEFAULT_PROBABILITY = {
  prospecting: 10,
  qualified: 25,
  proposal: 50,
  negotiation: 75,
  won: 100,
  lost: 0,
};

function nullable(value) {
  if (value === undefined || value === null) return null;
  const trimmed = typeof value === "string" ? value.trim() : value;
  return trimmed === "" ? null : trimmed;
}

function isManager(user) {
  return ["admin", "manager"].includes(user?.role);
}

function normalizeStage(value, fallback = "prospecting") {
  const stage = String(value || fallback).trim().toLowerCase();
  return STAGES.has(stage) ? stage : null;
}

function normalizeNumber(value, fallback = 0) {
  if (value === "" || value === undefined || value === null) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sendError(res, error) {
  const status = Number(error.status) || 500;
  return res.status(status).json({
    status: "ERROR",
    message: status === 500 ? error.message || "Internal server error" : error.message,
  });
}

async function validateOwner(client, user, requestedOwner) {
  const ownerId = nullable(requestedOwner) || user.userId;
  if (!isManager(user) && ownerId !== user.userId) {
    const error = new Error("Only administrators and managers can assign another opportunity owner");
    error.status = 403;
    throw error;
  }
  const result = await client.query(
    `SELECT user_id FROM app_users
     WHERE user_id = $1 AND is_active = true
       AND role IN ('admin','manager','sales')`,
    [ownerId]
  );
  if (!result.rowCount) {
    const error = new Error("Opportunity owner is not an active sales user");
    error.status = 400;
    throw error;
  }
  return ownerId;
}

async function validateContact(client, customerId, contactId) {
  if (!contactId) return null;
  const result = await client.query(
    `SELECT contact_id FROM customer_contacts
     WHERE customer_id = $1 AND contact_id = $2 AND is_active = true`,
    [customerId, contactId]
  );
  if (!result.rowCount) {
    const error = new Error("The selected PIC does not belong to this customer");
    error.status = 400;
    throw error;
  }
  return contactId;
}

async function validateInstalledBase(client, customerId, vesselId, engineId) {
  let vessel = nullable(vesselId);
  const engine = nullable(engineId);
  if (engine) {
    const result = await client.query(
      `SELECT e.engine_id, e.vessel_id FROM engines e
       JOIN vessels v ON v.vessel_id=e.vessel_id
       WHERE e.engine_id=$1 AND v.customer_id=$2`, [engine, customerId]
    );
    if (!result.rowCount) throw Object.assign(new Error("The selected engine does not belong to this customer"), { status: 400 });
    if (vessel && vessel !== result.rows[0].vessel_id) {
      throw Object.assign(new Error("The selected engine does not belong to the selected vessel"), { status: 400 });
    }
    vessel = vessel || result.rows[0].vessel_id;
  }
  if (vessel) {
    const result = await client.query(
      `SELECT vessel_id FROM vessels WHERE vessel_id=$1 AND customer_id=$2`, [vessel, customerId]
    );
    if (!result.rowCount) throw Object.assign(new Error("The selected vessel does not belong to this customer"), { status: 400 });
  }
  return { vesselId: vessel, engineId: engine };
}

function validatePayload(body, existing = {}) {
  const title = String(body.Title ?? existing.title ?? "").trim();
  const stage = normalizeStage(body.Stage, existing.stage || "prospecting");
  const estimatedValue = normalizeNumber(body.EstimatedValue, existing.estimated_value || 0);
  const probability = normalizeNumber(
    body.Probability,
    body.Stage ? DEFAULT_PROBABILITY[stage] : existing.probability ?? DEFAULT_PROBABILITY[stage]
  );
  const nextAction = nullable(body.NextAction);
  const nextActionAt = nullable(body.NextActionAt);
  const lossReason = nullable(body.LossReason);

  if (!title) throw Object.assign(new Error("Opportunity title is required"), { status: 400 });
  if (!stage) throw Object.assign(new Error("Opportunity stage is invalid"), { status: 400 });
  if (estimatedValue === null || estimatedValue < 0) {
    throw Object.assign(new Error("Estimated value must be zero or greater"), { status: 400 });
  }
  if (probability === null || probability < 0 || probability > 100) {
    throw Object.assign(new Error("Probability must be between 0 and 100"), { status: 400 });
  }
  if (Boolean(nextAction) !== Boolean(nextActionAt)) {
    throw Object.assign(new Error("Next action and its date/time must both be provided"), { status: 400 });
  }
  if (stage === "lost" && !lossReason) {
    throw Object.assign(new Error("Loss reason is required for a lost opportunity"), { status: 400 });
  }
  return { title, stage, estimatedValue, probability, nextAction, nextActionAt, lossReason };
}

const SELECT_OPPORTUNITY = `
  SELECT o.*, c.company AS customer_name,
    cc.full_name AS contact_name, cc.job_title AS contact_job_title,
    owner.full_name AS owner_name, owner.email AS owner_email,
    creator.full_name AS created_by_name,
    v.boat_name AS vessel_name,
    e.brand AS engine_brand, e.model AS engine_model,
    e.serial_number AS engine_serial_number,
    (o.estimated_value * o.probability / 100.0) AS weighted_value
  FROM sales_opportunities o
  INNER JOIN customers c ON c.customer_id = o.customer_id
  LEFT JOIN customer_contacts cc
    ON cc.customer_id = o.customer_id AND cc.contact_id = o.contact_id
  INNER JOIN app_users owner ON owner.user_id = o.owner_id
  LEFT JOIN app_users creator ON creator.user_id = o.created_by
  LEFT JOIN vessels v ON v.vessel_id=o.vessel_id
  LEFT JOIN engines e ON e.engine_id=o.engine_id
`;

function visibility(user, startIndex = 1) {
  const access = customerAccessCondition(user, "c", startIndex);
  const clauses = [access.clause];
  const parameters = [...access.parameters];
  if (user?.role === "sales") {
    clauses.push(`o.owner_id = $${startIndex + parameters.length}`);
    parameters.push(user.userId);
  }
  return { clause: clauses.join(" AND "), parameters };
}

router.get("/owners", requireAuth, requireRole(...READ_ROLES), async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT user_id, full_name, email, role FROM app_users
       WHERE is_active = true AND role IN ('admin','manager','sales')
       ORDER BY full_name, user_id`
    );
    return res.json(result.rows);
  } catch (error) {
    return sendError(res, error);
  }
});

router.get("/customer/:customerId/installed-base", requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  try {
    await ensureCustomerAccess(pool, req.user, req.params.customerId);
    const result = await pool.query(
      `SELECT v.vessel_id, v.boat_name, v.builder, v.year_built,
        e.engine_id, e.brand, e.model, e.hp, e.serial_number
       FROM vessels v LEFT JOIN engines e ON e.vessel_id=v.vessel_id
       WHERE v.customer_id=$1 ORDER BY v.boat_name, e.brand, e.model`,
      [req.params.customerId]
    );
    const vessels = [];
    for (const row of result.rows) {
      let vessel = vessels.find((item) => item.vessel_id === row.vessel_id);
      if (!vessel) {
        vessel = { vessel_id: row.vessel_id, boat_name: row.boat_name,
          builder: row.builder, year_built: row.year_built, engines: [] };
        vessels.push(vessel);
      }
      if (row.engine_id) vessel.engines.push({ engine_id: row.engine_id, brand: row.brand,
        model: row.model, hp: row.hp, serial_number: row.serial_number });
    }
    return res.json(vessels);
  } catch (error) { return sendError(res, error); }
});

router.get("/summary", requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  try {
    const visible = visibility(req.user, 1);
    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE o.stage NOT IN ('won','lost'))::integer AS open_count,
         COALESCE(SUM(o.estimated_value) FILTER (WHERE o.stage NOT IN ('won','lost')),0) AS open_value,
         COALESCE(SUM(o.estimated_value * o.probability / 100.0)
           FILTER (WHERE o.stage NOT IN ('won','lost')),0) AS weighted_value,
         COUNT(*) FILTER (WHERE o.stage = 'won')::integer AS won_count,
         COALESCE(SUM(o.estimated_value) FILTER (WHERE o.stage = 'won'),0) AS won_value,
         COUNT(*) FILTER (
           WHERE o.stage NOT IN ('won','lost') AND o.next_action_at < NOW()
         )::integer AS overdue_actions
       FROM sales_opportunities o
       INNER JOIN customers c ON c.customer_id = o.customer_id
       WHERE ${visible.clause}`,
      visible.parameters
    );
    return res.json(result.rows[0]);
  } catch (error) {
    return sendError(res, error);
  }
});

router.get("/", requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  try {
    const visible = visibility(req.user, 1);
    const clauses = [visible.clause];
    const parameters = [...visible.parameters];
    const add = (sql, value) => {
      parameters.push(value);
      clauses.push(sql.replace("?", `$${parameters.length}`));
    };
    if (nullable(req.query.customerId)) add("o.customer_id = ?", nullable(req.query.customerId));
    if (nullable(req.query.stage) && STAGES.has(req.query.stage)) add("o.stage = ?", req.query.stage);
    if (isManager(req.user) && nullable(req.query.ownerId) && req.query.ownerId !== "all") {
      add("o.owner_id = ?", req.query.ownerId);
    }
    if (nullable(req.query.search)) {
      parameters.push(req.query.search);
      const index = parameters.length;
      clauses.push(`(
        o.title ILIKE '%' || $${index} || '%'
        OR c.company ILIKE '%' || $${index} || '%'
        OR o.product_interest ILIKE '%' || $${index} || '%'
      )`);
    }
    const result = await pool.query(
      `${SELECT_OPPORTUNITY}
       WHERE ${clauses.join(" AND ")}
       ORDER BY
         CASE WHEN o.stage IN ('won','lost') THEN 1 ELSE 0 END,
         o.expected_close_date NULLS LAST, o.updated_at DESC`,
      parameters
    );
    return res.json(result.rows);
  } catch (error) {
    return sendError(res, error);
  }
});

router.post("/", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  const client = await pool.connect();
  try {
    const body = req.body || {};
    const customerId = nullable(body.CustomerID);
    if (!customerId) throw Object.assign(new Error("Customer is required"), { status: 400 });
    const values = validatePayload(body);
    await client.query("BEGIN");
    await ensureCustomerAccess(client, req.user, customerId);
    const contactId = await validateContact(
      client,
      customerId,
      nullable(body.ContactID)
    );
    const ownerId = await validateOwner(client, req.user, body.OwnerID);
    const installedBase = await validateInstalledBase(
      client, customerId, body.VesselID, body.EngineID
    );
    const result = await client.query(
      `INSERT INTO sales_opportunities (
         customer_id, contact_id, owner_id, title, product_interest,
         description, stage, estimated_value, probability, expected_close_date,
         next_action, next_action_at, competitor, loss_reason, closed_at,
         created_by, updated_by, vessel_id, engine_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
         CASE WHEN $7 IN ('won','lost') THEN NOW() ELSE NULL END,$15,$15,$16,$17)
       RETURNING opportunity_id`,
      [customerId, contactId, ownerId, values.title, nullable(body.ProductInterest),
       nullable(body.Description), values.stage, values.estimatedValue, values.probability,
       nullable(body.ExpectedCloseDate), values.nextAction, values.nextActionAt,
       nullable(body.Competitor), values.lossReason, req.user.userId,
       installedBase.vesselId, installedBase.engineId]
    );
    await client.query("COMMIT");
    const created = await pool.query(`${SELECT_OPPORTUNITY} WHERE o.opportunity_id = $1`, [result.rows[0].opportunity_id]);
    return res.status(201).json({ status: "OK", opportunity: created.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return sendError(res, error);
  } finally {
    client.release();
  }
});

router.put("/:id", requireAuth, requireRole(...WRITE_ROLES), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const visible = visibility(req.user, 2);
    const current = await client.query(
      `SELECT o.* FROM sales_opportunities o
       INNER JOIN customers c ON c.customer_id = o.customer_id
       WHERE o.opportunity_id = $1 AND ${visible.clause} FOR UPDATE`,
      [req.params.id, ...visible.parameters]
    );
    if (!current.rowCount) throw Object.assign(new Error("Opportunity not found"), { status: 404 });
    const body = req.body || {};
    const customerId = nullable(body.CustomerID) || current.rows[0].customer_id;
    const values = validatePayload(body, current.rows[0]);
    await ensureCustomerAccess(client, req.user, customerId);
    const requestedContact = body.ContactID === undefined
      ? current.rows[0].contact_id
      : nullable(body.ContactID);
    const contactId = await validateContact(client, customerId, requestedContact);
    const ownerId = await validateOwner(client, req.user, body.OwnerID || current.rows[0].owner_id);
    const installedBase = await validateInstalledBase(
      client, customerId,
      body.VesselID === undefined ? current.rows[0].vessel_id : body.VesselID,
      body.EngineID === undefined ? current.rows[0].engine_id : body.EngineID
    );
    await client.query(
      `UPDATE sales_opportunities SET
         customer_id=$2, contact_id=$3, owner_id=$4, title=$5,
         product_interest=$6, description=$7, stage=$8, estimated_value=$9,
         probability=$10, expected_close_date=$11, next_action=$12,
         next_action_at=$13, competitor=$14, loss_reason=$15,
         closed_at=CASE
           WHEN $8 IN ('won','lost') AND stage NOT IN ('won','lost') THEN NOW()
           WHEN $8 NOT IN ('won','lost') THEN NULL ELSE closed_at END,
         updated_by=$16, vessel_id=$17, engine_id=$18, updated_at=NOW()
       WHERE opportunity_id=$1`,
      [req.params.id, customerId, contactId, ownerId, values.title,
       nullable(body.ProductInterest), nullable(body.Description), values.stage,
       values.estimatedValue, values.probability, nullable(body.ExpectedCloseDate),
       values.nextAction, values.nextActionAt, nullable(body.Competitor),
       values.lossReason, req.user.userId, installedBase.vesselId,
       installedBase.engineId]
    );
    await client.query("COMMIT");
    const updated = await pool.query(`${SELECT_OPPORTUNITY} WHERE o.opportunity_id = $1`, [req.params.id]);
    return res.json({ status: "OK", opportunity: updated.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return sendError(res, error);
  } finally {
    client.release();
  }
});

router.delete("/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM sales_opportunities WHERE opportunity_id=$1 RETURNING *`,
      [req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ status: "ERROR", message: "Opportunity not found" });
    return res.json({ status: "OK", message: "Opportunity deleted", opportunity: result.rows[0] });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
