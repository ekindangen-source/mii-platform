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

// CREATE CUSTOMER ACCOUNT
router.post(
  "/",
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
          created_by
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,
          $10,$11,$12,$13,$14,$15,$16,$17
        )
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
          req.user.userId,
        ]
      );

      res.status(201).json({
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

// LIST CUSTOMER ACCOUNTS WITH PRIMARY PIC SUMMARY
router.get(
  "/",
  requireAuth,
  async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           c.*,
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
