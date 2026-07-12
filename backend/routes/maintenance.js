const express = require("express");
const router = express.Router();
const pool = require("../db/database");

// GET all maintenance records
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         m.*,
         e.brand,
         e.model,
         e.serial_number,
         v.boat_name,
         c.company
       FROM maintenance m
       LEFT JOIN engines e
         ON m.engine_id = e.engine_id
       LEFT JOIN vessels v
         ON e.vessel_id = v.vessel_id
       LEFT JOIN customers c
         ON v.customer_id = c.customer_id
       ORDER BY m.service_date DESC, m.created_at DESC`
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({
      status: "ERROR",
      message: err.message
    });
  }
});

// GET one maintenance record
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM maintenance
       WHERE maintenance_id = $1`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: "ERROR",
        message: "Maintenance record not found"
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({
      status: "ERROR",
      message: err.message
    });
  }
});

// CREATE maintenance record
router.post("/", async (req, res) => {
  try {
    const r = req.body;

    const result = await pool.query(
      `INSERT INTO maintenance (
         maintenance_id,
         engine_id,
         service_date,
         engine_hours,
         service_type,
         technician,
         parts_replaced,
         labor_hours,
         labor_cost,
         parts_cost,
         downtime_hours,
         warranty_claim,
         status,
         next_service_date,
         next_service_hours,
         remarks
       )
       VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,
         $9,$10,$11,$12,$13,$14,$15,$16
       )
       RETURNING *`,
      [
        r.MaintenanceID,
        r.EngineID,
        r.ServiceDate,
        r.EngineHours || null,
        r.ServiceType,
        r.Technician,
        r.PartsReplaced,
        r.LaborHours || null,
        r.LaborCost || null,
        r.PartsCost || null,
        r.DowntimeHours || null,
        r.WarrantyClaim,
        r.Status || "Completed",
        r.NextServiceDate || null,
        r.NextServiceHours || null,
        r.Remarks
      ]
    );

    res.status(201).json({
      status: "OK",
      maintenance: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({
      status: "ERROR",
      message: err.message
    });
  }
});

// UPDATE maintenance record
router.put("/:id", async (req, res) => {
  try {
    const r = req.body;

    const result = await pool.query(
      `UPDATE maintenance
       SET
         engine_id = $1,
         service_date = $2,
         engine_hours = $3,
         service_type = $4,
         technician = $5,
         parts_replaced = $6,
         labor_hours = $7,
         labor_cost = $8,
         parts_cost = $9,
         downtime_hours = $10,
         warranty_claim = $11,
         status = $12,
         next_service_date = $13,
         next_service_hours = $14,
         remarks = $15,
         updated_at = NOW()
       WHERE maintenance_id = $16
       RETURNING *`,
      [
        r.EngineID,
        r.ServiceDate,
        r.EngineHours || null,
        r.ServiceType,
        r.Technician,
        r.PartsReplaced,
        r.LaborHours || null,
        r.LaborCost || null,
        r.PartsCost || null,
        r.DowntimeHours || null,
        r.WarrantyClaim,
        r.Status,
        r.NextServiceDate || null,
        r.NextServiceHours || null,
        r.Remarks,
        req.params.id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: "ERROR",
        message: "Maintenance record not found"
      });
    }

    res.json({
      status: "OK",
      maintenance: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({
      status: "ERROR",
      message: err.message
    });
  }
});

// DELETE maintenance record
router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM maintenance
       WHERE maintenance_id = $1
       RETURNING *`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: "ERROR",
        message: "Maintenance record not found"
      });
    }

    res.json({
      status: "OK",
      message: "Maintenance record deleted",
      maintenance: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({
      status: "ERROR",
      message: err.message
    });
  }
});

module.exports = router;
