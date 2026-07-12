const express = require("express");
const router = express.Router();
const pool = require("../db/database");

router.post("/", async (req, res) => {
  try {
    const r = req.body;

    const result = await pool.query(
      `INSERT INTO vessels
      (vessel_id, customer_id, boat_name, builder, year_built, length_m, beam_m,
       hull_material, hull_type, passenger_capacity, fuel_tank_l, home_port, typical_route)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
      [
        r.VesselID,
        r.CustomerID,
        r.BoatName,
        r.Builder,
        r.YearBuilt || null,
        r.LengthM || null,
        r.BeamM || null,
        r.HullMaterial,
        r.HullType,
        r.PassengerCapacity || null,
        r.FuelTankL || null,
        r.HomePort,
        r.TypicalRoute
      ]
    );

    res.json({ status: "OK", vessel: result.rows[0] });
  } catch (err) {
    res.status(500).json({ status: "ERROR", message: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT v.*, c.company
       FROM vessels v
       LEFT JOIN customers c ON v.customer_id = c.customer_id
       ORDER BY v.created_at DESC
       LIMIT 100`
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

`UPDATE vessels
SET
customer_id=$1,
boat_name=$2,
builder=$3,
year_built=$4,
length_m=$5,
beam_m=$6,
hull_material=$7,
hull_type=$8,
passenger_capacity=$9,
fuel_tank_l=$10,
home_port=$11,
typical_route=$12,
updated_at=NOW()

WHERE vessel_id=$13

RETURNING *`,

[
r.CustomerID,
r.BoatName,
r.Builder,
r.YearBuilt || null,
r.LengthM || null,
r.BeamM || null,
r.HullMaterial,
r.HullType,
r.PassengerCapacity || null,
r.FuelTankL || null,
r.HomePort,
r.TypicalRoute,
req.params.id
]

);

        if(result.rowCount===0){

            return res.status(404).json({
                status:"ERROR",
                message:"Vessel not found"
            });

        }

        res.json({
            status:"OK",
            vessel:result.rows[0]
        });

    }

    catch(err){

        res.status(500).json({
            status:"ERROR",
            message:err.message
        });

    }

});

router.delete("/:id", async (req, res) => {

    try{

        const result=await pool.query(

            `DELETE FROM vessels
             WHERE vessel_id=$1
             RETURNING *`,

            [req.params.id]

        );

        if(result.rowCount===0){

            return res.status(404).json({
                status:"ERROR",
                message:"Vessel not found"
            });

        }

        res.json({
            status:"OK",
            message:"Vessel deleted",
            vessel:result.rows[0]
        });

    }

    catch(err){

        res.status(500).json({
            status:"ERROR",
            message:err.message
        });

    }

});

module.exports = router;
