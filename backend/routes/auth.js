const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();
const pool = require("../db/database");
const {
  requireAuth,
  requireRole,
} = require("../middleware/auth");

const allowedRoles = [
  "admin",
  "manager",
  "sales",
  "technician",
  "viewer",
];

function publicUser(row) {
  return {
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function countOtherActiveAdmins(
  client,
  excludedUserId
) {
  const result = await client.query(
    `SELECT COUNT(*)::integer AS count
     FROM app_users
     WHERE role = 'admin'
       AND is_active = TRUE
       AND user_id <> $1`,
    [excludedUserId]
  );

  return result.rows[0].count;
}

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { Email, Password } = req.body;

    if (!Email || !Password) {
      return res.status(400).json({
        status: "ERROR",
        message:
          "Email and password are required",
      });
    }

    const result = await pool.query(
      `SELECT
         user_id,
         full_name,
         email,
         password_hash,
         role,
         is_active,
         created_at,
         updated_at
       FROM app_users
       WHERE LOWER(email) = LOWER($1)`,
      [Email]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        status: "ERROR",
        message: "Invalid email or password",
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        status: "ERROR",
        message: "User account is inactive",
      });
    }

    const valid = await bcrypt.compare(
      Password,
      user.password_hash
    );

    if (!valid) {
      return res.status(401).json({
        status: "ERROR",
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        userId: user.user_id,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({
      status: "OK",
      token,
      user: publicUser(user),
    });
  } catch (err) {
    return res.status(500).json({
      status: "ERROR",
      message: err.message,
    });
  }
});

// CURRENT USER
router.get("/me", requireAuth, (req, res) => {
  return res.json({
    status: "OK",
    user: req.user,
  });
});

// LIST USERS — ADMIN ONLY
router.get(
  "/users",
  requireAuth,
  requireRole("admin"),
  async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           user_id,
           full_name,
           email,
           role,
           is_active,
           created_at,
           updated_at
         FROM app_users
         ORDER BY full_name, email`
      );

      return res.json(result.rows);
    } catch (err) {
      return res.status(500).json({
        status: "ERROR",
        message: err.message,
      });
    }
  }
);

// CREATE USER — ADMIN ONLY
router.post(
  "/users",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const {
        UserID,
        FullName,
        Email,
        Password,
        Role,
      } = req.body;

      if (
        !UserID ||
        !FullName ||
        !Email ||
        !Password
      ) {
        return res.status(400).json({
          status: "ERROR",
          message:
            "User ID, full name, email, and password are required",
        });
      }

      if (Password.length < 8) {
        return res.status(400).json({
          status: "ERROR",
          message:
            "Password must contain at least 8 characters",
        });
      }

      const normalizedRole =
        Role || "viewer";

      if (
        !allowedRoles.includes(normalizedRole)
      ) {
        return res.status(400).json({
          status: "ERROR",
          message: "Invalid role",
        });
      }

      const passwordHash = await bcrypt.hash(
        Password,
        12
      );

      const result = await pool.query(
        `INSERT INTO app_users
         (
           user_id,
           full_name,
           email,
           password_hash,
           role,
           is_active
         )
         VALUES
         ($1, $2, LOWER($3), $4, $5, TRUE)
         RETURNING
           user_id,
           full_name,
           email,
           role,
           is_active,
           created_at,
           updated_at`,
        [
          UserID.trim(),
          FullName.trim(),
          Email.trim(),
          passwordHash,
          normalizedRole,
        ]
      );

      return res.status(201).json(
        result.rows[0]
      );
    } catch (err) {
      const duplicate =
        err.code === "23505";

      return res
        .status(duplicate ? 409 : 500)
        .json({
          status: "ERROR",
          message: duplicate
            ? "User ID or email already exists"
            : err.message,
        });
    }
  }
);

// UPDATE USER PROFILE / ROLE — ADMIN ONLY
router.put(
  "/users/:userId",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const { userId } = req.params;
      const {
        FullName,
        Email,
        Role,
      } = req.body;

      if (!FullName || !Email || !Role) {
        return res.status(400).json({
          status: "ERROR",
          message:
            "Full name, email, and role are required",
        });
      }

      if (!allowedRoles.includes(Role)) {
        return res.status(400).json({
          status: "ERROR",
          message: "Invalid role",
        });
      }

      await client.query("BEGIN");

      // Serialize admin-role changes so two requests
      // cannot remove the last active admin together.
      await client.query(
        "SELECT pg_advisory_xact_lock($1)",
        [862024]
      );

      const currentResult =
        await client.query(
          `SELECT
             user_id,
             role,
             is_active
           FROM app_users
           WHERE user_id = $1
           FOR UPDATE`,
          [userId]
        );

      if (currentResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          status: "ERROR",
          message: "User not found",
        });
      }

      const current =
        currentResult.rows[0];

      if (
        current.role === "admin" &&
        current.is_active &&
        Role !== "admin"
      ) {
        const otherAdmins =
          await countOtherActiveAdmins(
            client,
            userId
          );

        if (otherAdmins === 0) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            status: "ERROR",
            message:
              "At least one active admin account must remain",
          });
        }
      }

      const result = await client.query(
        `UPDATE app_users
         SET
           full_name = $1,
           email = LOWER($2),
           role = $3,
           updated_at = NOW()
         WHERE user_id = $4
         RETURNING
           user_id,
           full_name,
           email,
           role,
           is_active,
           created_at,
           updated_at`,
        [
          FullName.trim(),
          Email.trim(),
          Role,
          userId,
        ]
      );

      await client.query("COMMIT");

      return res.json(result.rows[0]);
    } catch (err) {
      await client
        .query("ROLLBACK")
        .catch(() => {});

      const duplicate =
        err.code === "23505";

      return res
        .status(duplicate ? 409 : 500)
        .json({
          status: "ERROR",
          message: duplicate
            ? "Email already exists"
            : err.message,
        });
    } finally {
      client.release();
    }
  }
);

// ACTIVATE / DEACTIVATE USER — ADMIN ONLY
router.patch(
  "/users/:userId/active",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const { userId } = req.params;
      const { IsActive } = req.body;

      if (typeof IsActive !== "boolean") {
        return res.status(400).json({
          status: "ERROR",
          message:
            "IsActive must be true or false",
        });
      }

      if (
        req.user.userId === userId &&
        IsActive === false
      ) {
        return res.status(400).json({
          status: "ERROR",
          message:
            "You cannot deactivate your own account",
        });
      }

      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock($1)",
        [862024]
      );

      const currentResult =
        await client.query(
          `SELECT
             user_id,
             role,
             is_active
           FROM app_users
           WHERE user_id = $1
           FOR UPDATE`,
          [userId]
        );

      if (currentResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          status: "ERROR",
          message: "User not found",
        });
      }

      const current =
        currentResult.rows[0];

      if (
        current.role === "admin" &&
        current.is_active &&
        IsActive === false
      ) {
        const otherAdmins =
          await countOtherActiveAdmins(
            client,
            userId
          );

        if (otherAdmins === 0) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            status: "ERROR",
            message:
              "At least one active admin account must remain",
          });
        }
      }

      const result = await client.query(
        `UPDATE app_users
         SET
           is_active = $1,
           updated_at = NOW()
         WHERE user_id = $2
         RETURNING
           user_id,
           full_name,
           email,
           role,
           is_active,
           created_at,
           updated_at`,
        [IsActive, userId]
      );

      await client.query("COMMIT");

      return res.json(result.rows[0]);
    } catch (err) {
      await client
        .query("ROLLBACK")
        .catch(() => {});

      return res.status(500).json({
        status: "ERROR",
        message: err.message,
      });
    } finally {
      client.release();
    }
  }
);

// RESET PASSWORD — ADMIN ONLY
router.patch(
  "/users/:userId/password",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { Password } = req.body;

      if (!Password || Password.length < 8) {
        return res.status(400).json({
          status: "ERROR",
          message:
            "Password must contain at least 8 characters",
        });
      }

      const passwordHash =
        await bcrypt.hash(Password, 12);

      const result = await pool.query(
        `UPDATE app_users
         SET
           password_hash = $1,
           updated_at = NOW()
         WHERE user_id = $2
         RETURNING user_id`,
        [passwordHash, userId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          status: "ERROR",
          message: "User not found",
        });
      }

      return res.json({
        status: "OK",
        message:
          "Password updated successfully",
      });
    } catch (err) {
      return res.status(500).json({
        status: "ERROR",
        message: err.message,
      });
    }
  }
);

module.exports = router;
