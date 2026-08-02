const express = require("express");
const router = express.Router({
  mergeParams: true,
});
const pool = require("../db/database");
const {
  requireAuth,
  requireRole,
} = require("../middleware/auth");

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

function readBoolean(value, fallback) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value)
    .trim()
    .toLowerCase();

  if (["true", "1", "yes"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no"].includes(normalized)) {
    return false;
  }

  return fallback;
}

async function lockCustomer(client, customerId) {
  const result = await client.query(
    `SELECT customer_id
     FROM customers
     WHERE customer_id = $1
     FOR UPDATE`,
    [customerId]
  );

  if (result.rowCount === 0) {
    const error = new Error("Customer not found");
    error.status = 404;
    throw error;
  }
}

async function getContactForUpdate(
  client,
  customerId,
  contactId
) {
  const result = await client.query(
    `SELECT *
     FROM customer_contacts
     WHERE
       customer_id = $1
       AND contact_id = $2
     FOR UPDATE`,
    [customerId, contactId]
  );

  if (result.rowCount === 0) {
    const error = new Error("Contact not found");
    error.status = 404;
    throw error;
  }

  return result.rows[0];
}

async function ensurePrimaryContact(
  client,
  customerId,
  userId
) {
  const primary = await client.query(
    `SELECT contact_id
     FROM customer_contacts
     WHERE
       customer_id = $1
       AND is_active = true
       AND is_primary = true
     LIMIT 1`,
    [customerId]
  );

  if (primary.rowCount > 0) {
    return primary.rows[0].contact_id;
  }

  const promoted = await client.query(
    `UPDATE customer_contacts
     SET
       is_primary = true,
       updated_by = $2,
       updated_at = NOW()
     WHERE contact_id = (
       SELECT contact_id
       FROM customer_contacts
       WHERE
         customer_id = $1
         AND is_active = true
       ORDER BY created_at ASC, contact_id ASC
       LIMIT 1
     )
     RETURNING contact_id`,
    [customerId, userId]
  );

  return promoted.rows[0]?.contact_id || null;
}

function sendError(res, err) {
  const status = Number(err.status) || 500;

  return res.status(status).json({
    status: "ERROR",
    message:
      status === 500
        ? err.message || "Internal server error"
        : err.message,
  });
}

// LIST ALL CONTACTS / PICS FOR ONE CUSTOMER
router.get(
  "/",
  requireAuth,
  async (req, res) => {
    try {
      const customerId = req.params.customerId;

      const customer = await pool.query(
        `SELECT customer_id
         FROM customers
         WHERE customer_id = $1`,
        [customerId]
      );

      if (customer.rowCount === 0) {
        return res.status(404).json({
          status: "ERROR",
          message: "Customer not found",
        });
      }

      const result = await pool.query(
        `SELECT *
         FROM customer_contacts
         WHERE customer_id = $1
         ORDER BY
           is_active DESC,
           is_primary DESC,
           full_name ASC,
           contact_id ASC`,
        [customerId]
      );

      return res.json(result.rows);
    } catch (err) {
      return sendError(res, err);
    }
  }
);

// CREATE CONTACT / PIC
router.post(
  "/",
  requireAuth,
  requireRole("admin", "manager", "sales"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const customerId = req.params.customerId;
      const r = req.body;
      const fullName = String(
        r.FullName || ""
      ).trim();

      if (!fullName) {
        return res.status(400).json({
          status: "ERROR",
          message: "Contact name is required",
        });
      }

      await client.query("BEGIN");
      await lockCustomer(client, customerId);

      const isActive = readBoolean(
        r.IsActive,
        true
      );
      let isPrimary =
        isActive &&
        readBoolean(r.IsPrimary, false);

      if (isActive && !isPrimary) {
        const existingPrimary = await client.query(
          `SELECT contact_id
           FROM customer_contacts
           WHERE
             customer_id = $1
             AND is_active = true
             AND is_primary = true
           LIMIT 1`,
          [customerId]
        );

        isPrimary =
          existingPrimary.rowCount === 0;
      }

      if (isPrimary) {
        await client.query(
          `UPDATE customer_contacts
           SET
             is_primary = false,
             updated_by = $2,
             updated_at = NOW()
           WHERE
             customer_id = $1
             AND is_primary = true`,
          [customerId, req.user.userId]
        );
      }

      const result = await client.query(
        `INSERT INTO customer_contacts
         (
           customer_id,
           full_name,
           job_title,
           telephone,
           email,
           is_primary,
           is_active,
           notes,
           created_by,
           updated_by
         )
         VALUES
         ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
         RETURNING *`,
        [
          customerId,
          fullName,
          nullable(r.JobTitle),
          nullable(r.Telephone),
          nullable(r.Email),
          isPrimary,
          isActive,
          nullable(r.Notes),
          req.user.userId,
        ]
      );

      await ensurePrimaryContact(
        client,
        customerId,
        req.user.userId
      );

      await client.query("COMMIT");

      return res.status(201).json({
        status: "OK",
        contact: result.rows[0],
      });
    } catch (err) {
      await client.query("ROLLBACK");
      return sendError(res, err);
    } finally {
      client.release();
    }
  }
);

// UPDATE CONTACT / PIC
router.put(
  "/:contactId",
  requireAuth,
  requireRole("admin", "manager", "sales"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const customerId = req.params.customerId;
      const contactId = req.params.contactId;
      const r = req.body;
      const fullName = String(
        r.FullName || ""
      ).trim();

      if (!fullName) {
        return res.status(400).json({
          status: "ERROR",
          message: "Contact name is required",
        });
      }

      await client.query("BEGIN");
      await lockCustomer(client, customerId);

      const current = await getContactForUpdate(
        client,
        customerId,
        contactId
      );

      const isActive = readBoolean(
        r.IsActive,
        current.is_active
      );
      const requestedPrimary = readBoolean(
        r.IsPrimary,
        current.is_primary
      );
      const isPrimary =
        isActive && requestedPrimary;

      if (isPrimary) {
        await client.query(
          `UPDATE customer_contacts
           SET
             is_primary = false,
             updated_by = $3,
             updated_at = NOW()
           WHERE
             customer_id = $1
             AND contact_id <> $2
             AND is_primary = true`,
          [
            customerId,
            contactId,
            req.user.userId,
          ]
        );
      }

      const result = await client.query(
        `UPDATE customer_contacts
         SET
           full_name = $3,
           job_title = $4,
           telephone = $5,
           email = $6,
           is_primary = $7,
           is_active = $8,
           notes = $9,
           updated_by = $10,
           updated_at = NOW()
         WHERE
           customer_id = $1
           AND contact_id = $2
         RETURNING *`,
        [
          customerId,
          contactId,
          fullName,
          nullable(r.JobTitle),
          nullable(r.Telephone),
          nullable(r.Email),
          isPrimary,
          isActive,
          nullable(r.Notes),
          req.user.userId,
        ]
      );

      await ensurePrimaryContact(
        client,
        customerId,
        req.user.userId
      );

      await client.query("COMMIT");

      return res.json({
        status: "OK",
        contact: result.rows[0],
      });
    } catch (err) {
      await client.query("ROLLBACK");
      return sendError(res, err);
    } finally {
      client.release();
    }
  }
);

// SET AN ACTIVE CONTACT AS PRIMARY
router.post(
  "/:contactId/set-primary",
  requireAuth,
  requireRole("admin", "manager", "sales"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const customerId = req.params.customerId;
      const contactId = req.params.contactId;

      await client.query("BEGIN");
      await lockCustomer(client, customerId);

      const contact = await getContactForUpdate(
        client,
        customerId,
        contactId
      );

      if (!contact.is_active) {
        const error = new Error(
          "Inactive contacts cannot be primary"
        );
        error.status = 400;
        throw error;
      }

      await client.query(
        `UPDATE customer_contacts
         SET
           is_primary = false,
           updated_by = $2,
           updated_at = NOW()
         WHERE
           customer_id = $1
           AND is_primary = true`,
        [customerId, req.user.userId]
      );

      const result = await client.query(
        `UPDATE customer_contacts
         SET
           is_primary = true,
           updated_by = $3,
           updated_at = NOW()
         WHERE
           customer_id = $1
           AND contact_id = $2
         RETURNING *`,
        [
          customerId,
          contactId,
          req.user.userId,
        ]
      );

      await client.query("COMMIT");

      return res.json({
        status: "OK",
        contact: result.rows[0],
      });
    } catch (err) {
      await client.query("ROLLBACK");
      return sendError(res, err);
    } finally {
      client.release();
    }
  }
);

// ACTIVATE OR DEACTIVATE A CONTACT
router.patch(
  "/:contactId/status",
  requireAuth,
  requireRole("admin", "manager", "sales"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const customerId = req.params.customerId;
      const contactId = req.params.contactId;

      if (
        req.body.IsActive === undefined &&
        req.body.is_active === undefined
      ) {
        return res.status(400).json({
          status: "ERROR",
          message: "IsActive is required",
        });
      }

      const isActive = readBoolean(
        req.body.IsActive ??
          req.body.is_active,
        true
      );

      await client.query("BEGIN");
      await lockCustomer(client, customerId);
      await getContactForUpdate(
        client,
        customerId,
        contactId
      );

      const result = await client.query(
        `UPDATE customer_contacts
         SET
           is_active = $3,
           is_primary = CASE
             WHEN $3 = false THEN false
             ELSE is_primary
           END,
           updated_by = $4,
           updated_at = NOW()
         WHERE
           customer_id = $1
           AND contact_id = $2
         RETURNING *`,
        [
          customerId,
          contactId,
          isActive,
          req.user.userId,
        ]
      );

      await ensurePrimaryContact(
        client,
        customerId,
        req.user.userId
      );

      await client.query("COMMIT");

      return res.json({
        status: "OK",
        contact: result.rows[0],
      });
    } catch (err) {
      await client.query("ROLLBACK");
      return sendError(res, err);
    } finally {
      client.release();
    }
  }
);

module.exports = router;
