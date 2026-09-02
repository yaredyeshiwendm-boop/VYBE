const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { query } = require("../../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
}

function setAuthCookie(res, token) {
  res.cookie("vybe_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

/*
 * POST /api/auth/register
 */
router.post("/register", async (req, res) => {
  try {
    let { username, email, password, displayName } = req.body;

    username = String(username || "").trim().toLowerCase();
    email = String(email || "").trim().toLowerCase();
    password = String(password || "");
    displayName = String(displayName || username).trim();

    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      return res.status(400).json({
        success: false,
        error: "Username must be 3-30 characters and use only letters, numbers, or underscore"
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Invalid email address"
      });
    }

    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({
        success: false,
        error: "Password must be 8-128 characters"
      });
    }

    if (displayName.length < 1 || displayName.length > 80) {
      return res.status(400).json({
        success: false,
        error: "Display name must be 1-80 characters"
      });
    }

    const existing = await query(
      `SELECT id
       FROM users
       WHERE username = $1 OR email = $2
       LIMIT 1`,
      [username, email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: "Username or email already exists"
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await query(
      `INSERT INTO users
        (username, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING
        id,
        username,
        email,
        display_name,
        bio,
        avatar_url,
        is_verified,
        created_at`,
      [username, email, passwordHash, displayName]
    );

    const user = result.rows[0];

    const token = createToken(user);

    setAuthCookie(res, token);

    return res.status(201).json({
      success: true,
      user
    });
  } catch (error) {
    console.error("Register error:", error);

    return res.status(500).json({
      success: false,
      error: "Registration failed"
    });
  }
});

/*
 * POST /api/auth/login
 */
router.post("/login", async (req, res) => {
  try {
    const identifier = String(req.body.identifier || "")
      .trim()
      .toLowerCase();

    const password = String(req.body.password || "");

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        error: "Username/email and password are required"
      });
    }

    const result = await query(
      `SELECT
        id,
        username,
        email,
        password_hash,
        display_name,
        bio,
        avatar_url,
        is_verified,
        created_at
       FROM users
       WHERE username = $1 OR email = $1
       LIMIT 1`,
      [identifier]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials"
      });
    }

    const user = result.rows[0];

    const validPassword = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials"
      });
    }

    delete user.password_hash;

    const token = createToken(user);

    setAuthCookie(res, token);

    return res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      error: "Login failed"
    });
  }
});

/*
 * POST /api/auth/logout
 */
router.post("/logout", (req, res) => {
  res.clearCookie("vybe_token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  res.json({
    success: true,
    message: "Logged out"
  });
});

/*
 * GET /api/auth/me
 */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT
        id,
        username,
        email,
        display_name,
        bio,
        avatar_url,
        is_verified,
        created_at
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error("Auth me error:", error);

    res.status(500).json({
      success: false,
      error: "Could not load user"
    });
  }
});

module.exports = router;
