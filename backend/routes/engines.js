const express = require("express");
const router = express.Router();
const pool = require("../db/database");

router.post("/", async (req, res) => {
  try {
    const r = req.body;

    const result = await pool.query(
      `INSERT INTO engines
      (
        vessel_id,
        brand,
        model,
        hp,
        serial_number,
        install_date,
        engine_hours,
        gear_ratio,
        propeller,
        warranty_expiry,
        fuel_type
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *`,
      [
        r.VesselID,
        r.Brand,
        r.Model,
        r.HP,
        r.SerialNumber,
        r.InstallDate || null,
        r.EngineHours || null,
        r.GearRatio,
        r.Propeller,
        r.WarrantyExpiry || null,
        r.FuelType,
      ]
    );

    res.status(201).json({
      status: "OK",
      engine: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({
      status: "ERROR",
      message: err.message,
    });
  }
});

router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         e.*,
         v.boat_name,
         c.company
       FROM engines e
       LEFT JOIN vessels v
         ON e.vessel_id = v.vessel_id
       LEFT JOIN customers c
         ON v.customer_id = c.customer_id
       ORDER BY e.created_at DESC
       LIMIT 100`
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({
      status: "ERROR",
      message: err.message,
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const r = req.body;

    const result = await pool.query(
      `UPDATE engines
       SET
         vessel_id=$1,
         brand=$2,
         model=$3,
         hp=$4,
         serial_number=$5,
         install_date=$6,
         engine_hours=$7,
         gear_ratio=$8,
         propeller=$9,
         warranty_expiry=$10,
         fuel_type=$11,
         updated_at=NOW()
       WHERE engine_id=$12
       RETURNING *`,
      [
        r.VesselID,
        r.Brand,
        r.Model,
        r.HP || null,
        r.SerialNumber,
        r.InstallDate || null,
        r.EngineHours || null,
        r.GearRatio,
        r.Propeller,
        r.WarrantyExpiry || null,
        r.FuelType,
        req.params.id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: "ERROR",
        message: "Engine not found",
      });
    }

    res.json({
      status: "OK",
      engine: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({
      status: "ERROR",
      message: err.message,
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM engines
       WHERE engine_id=$1
       RETURNING *`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: "ERROR",
        message: "Engine not found",
      });
    }

    res.json({
      status: "OK",
      message: "Engine deleted",
      engine: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({
      status: "ERROR",
      message: err.message,
    });
  }
});

module.exports = router;
