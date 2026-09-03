const express = require("express");
const { query } = require("../../db");
const { optionalAuth } = require("../middleware/auth");

const router = express.Router();

/*
 * GET /api/search/users?q=username
 */
router.get("/users", optionalAuth, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();

    if (q.length < 1) {
      return res.json({
        success: true,
        users: []
      });
    }

    if (q.length > 50) {
      return res.status(400).json({
        success: false,
        error: "Search query is too long"
      });
    }

    const result = await query(
      `SELECT
        u.id,
        u.username,
        u.display_name,
        u.bio,
        u.avatar_url,
        u.is_verified,

        (
          SELECT COUNT(*)
          FROM follows f
          WHERE f.following_id = u.id
        )::int AS followers_count,

        EXISTS (
          SELECT 1
          FROM follows f
          WHERE f.follower_id = $2
            AND f.following_id = u.id
        ) AS viewer_following

       FROM users u

       WHERE
         u.username ILIKE $1
         OR u.display_name ILIKE $1

       ORDER BY
         CASE
           WHEN lower(u.username) = lower($3) THEN 0
           WHEN lower(u.username) LIKE lower($3) || '%' THEN 1
           ELSE 2
         END,
         u.username ASC

       LIMIT 30`,
      [
        `%${q}%`,
        req.user?.id || null,
        q
      ]
    );

    res.json({
      success: true,
      users: result.rows
    });
  } catch (error) {
    console.error("User search error:", error);

    res.status(500).json({
      success: false,
      error: "Could not search users"
    });
  }
});

module.exports = router;
