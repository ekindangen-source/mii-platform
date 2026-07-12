const express = require("express");
const router = express.Router();

const pool = require("../db/database");


// ========================================
// GET ALL TRIPS
// ========================================

router.get("/", async (req, res) => {

    try {

        const result = await pool.query(

`SELECT
t.*,
v.boat_name,
c.company

FROM trips t

LEFT JOIN vessels v
ON t.vessel_id=v.vessel_id

LEFT JOIN customers c
ON v.customer_id=c.customer_id

ORDER BY t.trip_date DESC`

        );

        res.json(result.rows);

    }

    catch(err){

        res.status(500).json({
            status:"ERROR",
            message:err.message
        });

    }

});


// ========================================
// CREATE TRIP
// ========================================

router.post("/", async (req, res) => {

    try{

        const r=req.body;

        const result=await pool.query(

`INSERT INTO trips
(
trip_id,
vessel_id,
trip_date,
captain,
operating_hours,
distance_nm,
average_speed_kn,
fuel_used_l,
fuel_price_per_l,
electricity_kwh,
weather,
sea_state,
payload
)

VALUES

($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)

RETURNING *`,

[
r.TripID,
r.VesselID,
r.Date,
r.Captain,
r.OperatingHours || null,
r.DistanceNM || null,
r.AverageSpeedKn || null,
r.FuelUsedL || null,
r.FuelPricePerL || null,
r.ElectricityKWh || null,
r.Weather,
r.SeaState,
r.Payload
]

        );

        res.json({

            status:"OK",
            trip:result.rows[0]

        });

    }

    catch(err){

        res.status(500).json({

            status:"ERROR",
            message:err.message

        });

    }

});


// ========================================
// UPDATE TRIP
// ========================================

router.put("/:id", async (req, res) => {

    try{

        const r=req.body;

        const result=await pool.query(

`UPDATE trips

SET

vessel_id=$1,
trip_date=$2,
captain=$3,
operating_hours=$4,
distance_nm=$5,
average_speed_kn=$6,
fuel_used_l=$7,
fuel_price_per_l=$8,
electricity_kwh=$9,
weather=$10,
sea_state=$11,
payload=$12,
updated_at=NOW()

WHERE trip_id=$13

RETURNING *`,

[
r.VesselID,
r.Date,
r.Captain,
r.OperatingHours || null,
r.DistanceNM || null,
r.AverageSpeedKn || null,
r.FuelUsedL || null,
r.FuelPricePerL || null,
r.ElectricityKWh || null,
r.Weather,
r.SeaState,
r.Payload,
req.params.id
]

        );

        if(result.rowCount===0){

            return res.status(404).json({

                status:"ERROR",
                message:"Trip not found"

            });

        }

        res.json({

            status:"OK",
            trip:result.rows[0]

        });

    }

    catch(err){

        res.status(500).json({

            status:"ERROR",
            message:err.message

        });

    }

});


// ========================================
// DELETE TRIP
// ========================================

router.delete("/:id", async (req, res) => {

    try{

        const result=await pool.query(

`DELETE FROM trips

WHERE trip_id=$1

RETURNING *`,

[req.params.id]

        );

        if(result.rowCount===0){

            return res.status(404).json({

                status:"ERROR",
                message:"Trip not found"

            });

        }

        res.json({

            status:"OK",
            message:"Trip deleted",
            trip:result.rows[0]

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
