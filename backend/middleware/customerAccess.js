const GLOBAL_CUSTOMER_ROLES = new Set([
  "admin",
  "manager",
  "viewer",
]);

function customerAccessCondition(user, alias = "c", startIndex = 1) {
  if (GLOBAL_CUSTOMER_ROLES.has(user?.role)) {
    return { clause: "TRUE", parameters: [] };
  }

  if (user?.role === "sales") {
    return {
      clause: `${alias}.assigned_to = $${startIndex}`,
      parameters: [user.userId],
    };
  }

  if (user?.role === "technician") {
    return {
      clause: `EXISTS (
        SELECT 1
        FROM scheduled_activities access_activity
        WHERE access_activity.customer_id = ${alias}.customer_id
          AND access_activity.assigned_to = $${startIndex}
      )`,
      parameters: [user.userId],
    };
  }

  return { clause: "FALSE", parameters: [] };
}

async function ensureCustomerAccess(client, user, customerId, options = {}) {
  const { forUpdate = false } = options;
  const access = customerAccessCondition(user, "c", 2);
  const result = await client.query(
    `SELECT c.customer_id, c.assigned_to
     FROM customers c
     WHERE c.customer_id = $1
       AND ${access.clause}
     ${forUpdate ? "FOR UPDATE" : ""}`,
    [customerId, ...access.parameters]
  );

  if (!result.rowCount) {
    const error = new Error("Customer not found");
    error.status = 404;
    throw error;
  }

  return result.rows[0];
}

async function ensureVesselAccess(client, user, vesselId) {
  const access = customerAccessCondition(user, "c", 2);
  const result = await client.query(
    `SELECT v.vessel_id, v.customer_id
     FROM vessels v
     INNER JOIN customers c ON c.customer_id = v.customer_id
     WHERE v.vessel_id = $1
       AND ${access.clause}`,
    [vesselId, ...access.parameters]
  );

  if (!result.rowCount) {
    const error = new Error("Vessel not found");
    error.status = 404;
    throw error;
  }

  return result.rows[0];
}

async function ensureEngineAccess(client, user, engineId) {
  const access = customerAccessCondition(user, "c", 2);
  const result = await client.query(
    `SELECT e.engine_id, v.vessel_id, v.customer_id
     FROM engines e
     INNER JOIN vessels v ON v.vessel_id = e.vessel_id
     INNER JOIN customers c ON c.customer_id = v.customer_id
     WHERE e.engine_id = $1
       AND ${access.clause}`,
    [engineId, ...access.parameters]
  );

  if (!result.rowCount) {
    const error = new Error("Engine not found");
    error.status = 404;
    throw error;
  }

  return result.rows[0];
}

async function ensureTripAccess(client, user, tripId) {
  const access = customerAccessCondition(user, "c", 2);
  const result = await client.query(
    `SELECT t.trip_id
     FROM trips t
     INNER JOIN vessels v ON v.vessel_id = t.vessel_id
     INNER JOIN customers c ON c.customer_id = v.customer_id
     WHERE t.trip_id = $1
       AND ${access.clause}`,
    [tripId, ...access.parameters]
  );

  if (!result.rowCount) {
    const error = new Error("Trip not found");
    error.status = 404;
    throw error;
  }

  return result.rows[0];
}

async function ensureMaintenanceAccess(client, user, maintenanceId) {
  const access = customerAccessCondition(user, "c", 2);
  const result = await client.query(
    `SELECT m.maintenance_id
     FROM maintenance m
     INNER JOIN engines e ON e.engine_id = m.engine_id
     INNER JOIN vessels v ON v.vessel_id = e.vessel_id
     INNER JOIN customers c ON c.customer_id = v.customer_id
     WHERE m.maintenance_id = $1
       AND ${access.clause}`,
    [maintenanceId, ...access.parameters]
  );

  if (!result.rowCount) {
    const error = new Error("Maintenance record not found");
    error.status = 404;
    throw error;
  }

  return result.rows[0];
}

function requireCustomerAccess(parameterName = "customerId") {
  return async (req, res, next) => {
    try {
      await ensureCustomerAccess(
        req.app.locals.db || require("../db/database"),
        req.user,
        req.params[parameterName]
      );
      next();
    } catch (error) {
      res.status(Number(error.status) || 500).json({
        status: "ERROR",
        message:
          Number(error.status) === 404
            ? "Customer not found"
            : error.message || "Internal server error",
      });
    }
  };
}

module.exports = {
  customerAccessCondition,
  ensureEngineAccess,
  ensureCustomerAccess,
  ensureMaintenanceAccess,
  ensureTripAccess,
  ensureVesselAccess,
  requireCustomerAccess,
};
