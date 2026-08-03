const express = require("express");
const router = express.Router();
const pool = require("../db/database");
const {
  requireAuth,
  requireRole,
} = require("../middleware/auth");

const ACCOUNT_TYPES = new Set([
  "organization",
  "individual",
]);

function normalizeAccountType(value) {
  const normalized = String(
    value || "organization"
  )
    .trim()
    .toLowerCase();

  return ACCOUNT_TYPES.has(normalized)
    ? normalized
    : null;
}

function nullable(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  return value;
}

function canAssignCustomers(user) {
  return ["admin", "manager"].includes(user?.role);
}

async function validateActiveAssignee(client, assignedTo) {
  if (!assignedTo) {
    return null;
  }

  const result = await client.query(
    `SELECT user_id
     FROM app_users
     WHERE user_id = $1 AND is_active = true`,
    [assignedTo]
  );

  if (!result.rowCount) {
    const error = new Error("Assigned user is not active");
    error.status = 400;
    throw error;
  }

  return assignedTo;
}

// CREATE CUSTOMER ACCOUNT
router.post(
  "/",
  requireAuth,
  requireRole("admin", "manager", "sales"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const r = req.body;
      const accountType = normalizeAccountType(
        r.AccountType
      );
      const initialPicName = String(
        r.InitialPICName || ""
      ).trim();
      const initialPicTitle = nullable(
        r.InitialPICTitle
      );
      const initialPicPhone = String(
        r.InitialPICPhone || ""
      ).trim();
      const requestedAssignee = nullable(r.AssignedTo);

      if (
        requestedAssignee &&
        requestedAssignee !== req.user.userId &&
        !canAssignCustomers(req.user)
      ) {
        return res.status(403).json({
          status: "ERROR",
          message:
            "Only administrators and managers can assign a customer to another user",
        });
      }

      if (!accountType) {
        return res.status(400).json({
          status: "ERROR",
          message:
            "Account type must be organization or individual",
        });
      }

      if (!String(r.Company || "").trim()) {
        return res.status(400).json({
          status: "ERROR",
          message: "Customer name is required",
        });
      }

      if (!initialPicName) {
        return res.status(400).json({
          status: "ERROR",
          message: "Initial PIC name is required",
        });
      }

      if (!initialPicPhone) {
        return res.status(400).json({
          status: "ERROR",
          message: "Initial PIC phone number is required",
        });
      }

      await client.query("BEGIN");
      const assignedTo = await validateActiveAssignee(
        client,
        requestedAssignee || req.user.userId
      );

      const result = await client.query(
        `INSERT INTO customers
        (
          account_type,
          company,
          industry,
          contact_person,
          position,
          province,
          home_port,
          fleet_size,
          annual_operating_hours,
          decision_maker,
          current_supplier,
          email,
          telephone,
          address,
          notes,
          lead_source,
          created_by,
          assigned_to
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,
          $10,$11,$12,$13,$14,$15,$16,$17,$18
        )
        RETURNING *`,
        [
          accountType,
          String(r.Company).trim(),
          nullable(r.Industry),
          initialPicName,
          initialPicTitle,
          nullable(r.Province),
          nullable(r.HomePort),
          r.FleetSize || null,
          r.AnnualOperatingHours || null,
          nullable(r.DecisionMaker),
          nullable(r.CurrentSupplier),
          nullable(r.Email),
          initialPicPhone,
          nullable(r.Address),
          nullable(r.Notes),
          nullable(r.Source),
          req.user.userId,
          assignedTo,
        ]
      );

      await client.query(
        `INSERT INTO customer_assignment_history
         (
           customer_id,
           previous_assigned_to,
           assigned_to,
           changed_by,
           reason
         )
         VALUES ($1,NULL,$2,$3,$4)`,
        [
          result.rows[0].customer_id,
          assignedTo,
          req.user.userId,
          "Customer created",
        ]
      );

      const contactResult = await client.query(
        `INSERT INTO customer_contacts
         (
           customer_id,
           full_name,
           job_title,
           telephone,
           is_primary,
           is_active,
           created_by,
           updated_by
         )
         VALUES ($1,$2,$3,$4,true,true,$5,$5)
         RETURNING *`,
        [
          result.rows[0].customer_id,
          initialPicName,
          initialPicTitle,
          initialPicPhone,
          req.user.userId,
        ]
      );

      await client.query("COMMIT");

      res.status(201).json({
        status: "OK",
        customer: result.rows[0],
        primaryContact: contactResult.rows[0],
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      res.status(500).json({
        status: "ERROR",
        message: err.message,
      });
    } finally {
      client.release();
    }
  }
);

// LIST CUSTOMER ACCOUNTS WITH PRIMARY PIC SUMMARY
router.get(
  "/",
  requireAuth,
  async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           c.*,
           owner.full_name AS assigned_to_name,
           owner.email AS assigned_to_email,
           creator.full_name AS created_by_name,
           pc.contact_id AS primary_contact_id,
           pc.full_name AS primary_contact_name,
           pc.job_title AS primary_contact_job_title,
           pc.email AS primary_contact_email,
           pc.telephone AS primary_contact_telephone,
           COALESCE(contact_totals.contact_count, 0)::integer
             AS contact_count,
           COALESCE(contact_totals.active_contact_count, 0)::integer
             AS active_contact_count
         FROM customers c
         LEFT JOIN app_users owner
           ON owner.user_id = c.assigned_to
         LEFT JOIN app_users creator
           ON creator.user_id = c.created_by
         LEFT JOIN LATERAL (
           SELECT
             cc.contact_id,
             cc.full_name,
             cc.job_title,
             cc.email,
             cc.telephone
           FROM customer_contacts cc
           WHERE
             cc.customer_id = c.customer_id
             AND cc.is_active = true
           ORDER BY
             cc.is_primary DESC,
             cc.created_at ASC,
             cc.contact_id ASC
           LIMIT 1
         ) pc ON true
         LEFT JOIN LATERAL (
           SELECT
             COUNT(*) AS contact_count,
             COUNT(*) FILTER (
               WHERE cc.is_active = true
             ) AS active_contact_count
           FROM customer_contacts cc
           WHERE cc.customer_id = c.customer_id
         ) contact_totals ON true
         ORDER BY c.created_at DESC
         LIMIT 100`
      );

      res.json(result.rows);
    } catch (err) {
      res.status(500).json({
        status: "ERROR",
        message: err.message,
      });
    }
  }
);

router.get(
  "/assignees",
  requireAuth,
  async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT user_id, full_name, email, role
         FROM app_users
         WHERE is_active = true
           AND role IN ('admin', 'manager', 'sales')
         ORDER BY full_name, user_id`
      );

      res.json(result.rows);
    } catch (err) {
      res.status(500).json({
        status: "ERROR",
        message: err.message,
      });
    }
  }
);

router.get(
  "/:id/assignment-history",
  requireAuth,
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           h.assignment_history_id,
           h.customer_id,
           h.previous_assigned_to,
           previous_user.full_name AS previous_assigned_to_name,
           h.assigned_to,
           assigned_user.full_name AS assigned_to_name,
           h.changed_by,
           changed_user.full_name AS changed_by_name,
           h.reason,
           h.assigned_at
         FROM customer_assignment_history h
         LEFT JOIN app_users previous_user
           ON previous_user.user_id = h.previous_assigned_to
         LEFT JOIN app_users assigned_user
           ON assigned_user.user_id = h.assigned_to
         LEFT JOIN app_users changed_user
           ON changed_user.user_id = h.changed_by
         WHERE h.customer_id = $1
         ORDER BY h.assigned_at DESC, h.assignment_history_id DESC`,
        [req.params.id]
      );

      res.json(result.rows);
    } catch (err) {
      res.status(500).json({
        status: "ERROR",
        message: err.message,
      });
    }
  }
);

router.patch(
  "/:id/assignment",
  requireAuth,
  requireRole("admin", "manager"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const assignedTo = nullable(req.body.AssignedTo);
      const reason = nullable(req.body.Reason);

      await client.query("BEGIN");
      await validateActiveAssignee(client, assignedTo);

      const current = await client.query(
        `SELECT customer_id, assigned_to
         FROM customers
         WHERE customer_id = $1
         FOR UPDATE`,
        [req.params.id]
      );

      if (!current.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          status: "ERROR",
          message: "Customer not found",
        });
      }

      if (current.rows[0].assigned_to === assignedTo) {
        await client.query("COMMIT");
        return res.json({
          status: "OK",
          message: "Customer assignment is unchanged",
        });
      }

      await client.query(
        `INSERT INTO customer_assignment_history
         (
           customer_id,
           previous_assigned_to,
           assigned_to,
           changed_by,
           reason
         )
         VALUES ($1,$2,$3,$4,$5)`,
        [
          req.params.id,
          current.rows[0].assigned_to,
          assignedTo,
          req.user.userId,
          reason,
        ]
      );

      const result = await client.query(
        `UPDATE customers
         SET assigned_to = $2, updated_at = NOW()
         WHERE customer_id = $1
         RETURNING *`,
        [req.params.id, assignedTo]
      );

      await client.query("COMMIT");
      res.json({ status: "OK", customer: result.rows[0] });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      res.status(Number(err.status) || 500).json({
        status: "ERROR",
        message: err.message,
      });
    } finally {
      client.release();
    }
  }
);

// UPDATE CUSTOMER ACCOUNT
router.put(
  "/:id",
  requireAuth,
  requireRole("admin", "manager", "sales"),
  async (req, res) => {
    try {
      const r = req.body;
      const accountType = normalizeAccountType(
        r.AccountType
      );

      if (!accountType) {
        return res.status(400).json({
          status: "ERROR",
          message:
            "Account type must be organization or individual",
        });
      }

      if (!String(r.Company || "").trim()) {
        return res.status(400).json({
          status: "ERROR",
          message: "Customer name is required",
        });
      }

      const result = await pool.query(
        `UPDATE customers
         SET
           account_type=$1,
           company=$2,
           industry=$3,
           contact_person=COALESCE($4, contact_person),
           position=COALESCE($5, position),
           province=$6,
           home_port=$7,
           fleet_size=$8,
           annual_operating_hours=$9,
           decision_maker=$10,
           current_supplier=$11,
           email=COALESCE($12, email),
           telephone=COALESCE($13, telephone),
           address=$14,
           notes=$15,
           lead_source=$16,
           updated_at=NOW()
         WHERE customer_id=$17
         RETURNING *`,
        [
          accountType,
          String(r.Company).trim(),
          nullable(r.Industry),
          nullable(r.ContactPerson),
          nullable(r.Position),
          nullable(r.Province),
          nullable(r.HomePort),
          r.FleetSize || null,
          r.AnnualOperatingHours || null,
          nullable(r.DecisionMaker),
          nullable(r.CurrentSupplier),
          nullable(r.Email),
          nullable(r.Telephone),
          nullable(r.Address),
          nullable(r.Notes),
          nullable(r.Source),
          req.params.id,
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          status: "ERROR",
          message: "Customer not found",
        });
      }

      res.json({
        status: "OK",
        customer: result.rows[0],
      });
    } catch (err) {
      res.status(500).json({
        status: "ERROR",
        message: err.message,
      });
    }
  }
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("admin", "manager"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `DELETE FROM customers
         WHERE customer_id = $1
         RETURNING *`,
        [req.params.id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          status: "ERROR",
          message: "Customer not found",
        });
      }

      res.json({
        status: "OK",
        message: "Customer deleted",
        customer: result.rows[0],
      });
    } catch (err) {
      res.status(500).json({
        status: "ERROR",
        message: err.message,
      });
    }
  }
);

module.exports = router;
