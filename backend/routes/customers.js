const express = require("express");
const router = express.Router();
const pool = require("../db/database");

//-----------------
//Customers
//-----------------

router.post("/", async (req, res) => {
  try {
    const r = req.body;

    const result = await pool.query(
      `INSERT INTO customers
      (customer_id, company, industry, contact_person, position, province, home_port,
       fleet_size, annual_operating_hours, decision_maker, current_supplier, email, telephone, address, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *`,
      [
        r.CustomerID,
        r.Company,
        r.Industry,
        r.ContactPerson,
        r.Position,
        r.Province,
        r.HomePort,
        r.FleetSize || null,
        r.AnnualOperatingHours || null,
        r.DecisionMaker,
        r.CurrentSupplier,
	r.Email,
	r.Telephone,
	r.Address,
        r.Notes
      ]
    );

    res.json({ status: "OK", customer: result.rows[0] });
  } catch (err) {
    res.status(500).json({ status: "ERROR", message: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM customers ORDER BY created_at DESC LIMIT 100"
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ status: "ERROR", message: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const r = req.body;

    const result = await pool.query(
      `UPDATE customers
       SET
         company=$1,
         industry=$2,
         contact_person=$3,
         position=$4,
         province=$5,
         home_port=$6,
         fleet_size=$7,
         annual_operating_hours=$8,
         decision_maker=$9,
         current_supplier=$10,
         email=$11,
         telephone=$12,
         address=$13,
         notes=$14,
         updated_at=NOW()
       WHERE customer_id=$15
       RETURNING *`,
      [
        r.Company,
        r.Industry,
        r.ContactPerson,
        r.Position,
        r.Province,
        r.HomePort,
        r.FleetSize || null,
        r.AnnualOperatingHours || null,
        r.DecisionMaker,
        r.CurrentSupplier,
        r.Email,
        r.Telephone,
        r.Address,
        r.Notes,
        req.params.id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: "ERROR",
        message: "Customer not found"
      });
    }

    res.json({
      status: "OK",
      customer: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({
      status: "ERROR",
      message: err.message
    });
  }
});

router.delete("/:id", async (req, res) => {
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
        message: "Customer not found"
      });
    }

    res.json({
      status: "OK",
      message: "Customer deleted",
      customer: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({
      status: "ERROR",
      message: err.message
    });
  }
});

module.exports = router;
