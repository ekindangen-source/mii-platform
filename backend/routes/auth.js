const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();
const pool = require("../db/database");
const { requireAuth, requireRole } = require("../middleware/auth");

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { Email, Password } = req.body;

    if (!Email || !Password) {
      return res.status(400).json({
        status: "ERROR",
        message: "Email and password are required"
      });
    }

    const result = await pool.query(
      `SELECT user_id, full_name, email, password_hash, role, is_active
       FROM app_users
       WHERE LOWER(email) = LOWER($1)`,
      [Email]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        status: "ERROR",
        message: "Invalid email or password"
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        status: "ERROR",
        message: "User account is inactive"
      });
    }

    const valid = await bcrypt.compare(Password, user.password_hash);

    if (!valid) {
      return res.status(401).json({
        status: "ERROR",
        message: "Invalid email or password"
      });
    }

    const token = jwt.sign(
      {
        userId: user.user_id,
        email: user.email,
        role: user.role,
        fullName: user.full_name
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      status: "OK",
      token,
      user: {
        userId: user.user_id,
        fullName: user.full_name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({
      status: "ERROR",
      message: err.message
    });
  }
});

// CURRENT USER
router.get("/me", requireAuth, async (req, res) => {
  res.json({
    status: "OK",
    user: req.user
  });
});

// CREATE USER — ADMIN ONLY
router.post("/users", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const {
      UserID,
      FullName,
      Email,
      Password,
      Role
    } = req.body;

    if (!UserID || !FullName || !Email || !Password) {
      return res.status(400).json({
        status: "ERROR",
        message: "UserID, FullName, Email, and Password are required"
      });
    }

    const passwordHash = await bcrypt.hash(Password, 12);

    const result = await pool.query(
      `INSERT INTO app_users
       (user_id, full_name, email, password_hash, role)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING user_id, full_name, email, role, is_active, created_at`,
      [
        UserID,
        FullName,
        Email.toLowerCase(),
        passwordHash,
        Role || "viewer"
      ]
    );

    res.status(201).json({
      status: "OK",
      user: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({
      status: "ERROR",
      message: err.message
    });
  }
});

module.exports = router;