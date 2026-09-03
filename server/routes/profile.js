const express = require("express");

const { query } = require("../../db");
const { requireAuth, optionalAuth } = require("../middleware/auth");

const router = express.Router();

/*
 * GET /api/profile/me
 * Current authenticated user's profile
 */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT
        u.id,
        u.username,
        u.email,
        u.display_name,
        u.bio,
        u.avatar_url,
        u.is_verified,
        u.created_at,

        (
          SELECT COUNT(*)
          FROM posts p
          WHERE p.user_id = u.id
        )::int AS posts_count,

        (
          SELECT COUNT(*)
          FROM follows f
          WHERE f.following_id = u.id
        )::int AS followers_count,

        (
          SELECT COUNT(*)
          FROM follows f
          WHERE f.follower_id = u.id
        )::int AS following_count

       FROM users u
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Profile not found"
      });
    }

    res.json({
      success: true,
      profile: result.rows[0]
    });
  } catch (error) {
    console.error("Profile error:", error);

    res.status(500).json({
      success: false,
      error: "Could not load profile"
    });
  }
});

/*
 * PUT /api/profile/me
 * Update current user's profile
 */
router.put("/me", requireAuth, async (req, res) => {
  try {
    let {
      displayName,
      username,
      bio
    } = req.body;

    displayName = String(displayName || "").trim();
    username = String(username || "").trim().toLowerCase();
    bio = String(bio || "").trim();

    if (
      displayName.length < 1 ||
      displayName.length > 80
    ) {
      return res.status(400).json({
        success: false,
        error: "Display name must be 1-80 characters"
      });
    }

    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      return res.status(400).json({
        success: false,
        error:
          "Username must be 3-30 characters and use only letters, numbers, or underscore"
      });
    }

    if (bio.length > 160) {
      return res.status(400).json({
        success: false,
        error: "Bio must be 160 characters or less"
      });
    }

    const existing = await query(
      `SELECT id
       FROM users
       WHERE username = $1
         AND id <> $2
       LIMIT 1`,
      [username, req.user.id]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: "Username is already taken"
      });
    }

    const result = await query(
      `UPDATE users
       SET
        display_name = $1,
        username = $2,
        bio = $3,
        updated_at = NOW()
       WHERE id = $4
       RETURNING
        id,
        username,
        email,
        display_name,
        bio,
        avatar_url,
        is_verified,
        created_at`,
      [
        displayName,
        username,
        bio,
        req.user.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Profile not found"
      });
    }

    res.json({
      success: true,
      profile: result.rows[0]
    });
  } catch (error) {
    console.error("Profile update error:", error);

    res.status(500).json({
      success: false,
      error: "Could not update profile"
    });
  }
});


/*
 * GET /api/profile/:username
 * Public profile
 */
router.get("/:username", optionalAuth, async (req, res) => {
  try {
    const username = String(req.params.username || "").trim().toLowerCase();

    const result = await query(
      `SELECT
        u.id,
        u.username,
        u.display_name,
        u.bio,
        u.avatar_url,
        u.is_verified,
        u.created_at,

        (
          SELECT COUNT(*)
          FROM posts p
          WHERE p.user_id = u.id
        )::int AS posts_count,

        (
          SELECT COUNT(*)
          FROM follows f
          WHERE f.following_id = u.id
        )::int AS followers_count,

        (
          SELECT COUNT(*)
          FROM follows f
          WHERE f.follower_id = u.id
        )::int AS following_count,

        EXISTS (
          SELECT 1
          FROM follows f
          WHERE f.follower_id = $2
            AND f.following_id = u.id
        ) AS viewer_following

       FROM users u
       WHERE u.username = $1`,
      [username, req.user?.id || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Profile not found"
      });
    }

    res.json({
      success: true,
      profile: result.rows[0]
    });
  } catch (error) {
    console.error("Public profile error:", error);

    res.status(500).json({
      success: false,
      error: "Could not load profile"
    });
  }
});

/*
 * PUT /api/profile/:username/follow
 */
router.put("/:username/follow", requireAuth, async (req, res) => {
  try {
    const username = String(req.params.username || "").trim().toLowerCase();

    const target = await query(
      `SELECT id, username
       FROM users
       WHERE username = $1`,
      [username]
    );

    if (target.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Profile not found"
      });
    }

    const targetId = target.rows[0].id;

    if (targetId === req.user.id) {
      return res.status(400).json({
        success: false,
        error: "You cannot follow yourself"
      });
    }

    await query(
      `INSERT INTO follows
        (follower_id, following_id)
       VALUES ($1, $2)
       ON CONFLICT (follower_id, following_id)
       DO NOTHING`,
      [req.user.id, targetId]
    );

    const count = await query(
      `SELECT COUNT(*)::int AS followers_count
       FROM follows
       WHERE following_id = $1`,
      [targetId]
    );

    res.json({
      success: true,
      following: true,
      followers_count: count.rows[0].followers_count
    });
  } catch (error) {
    console.error("Follow error:", error);

    res.status(500).json({
      success: false,
      error: "Could not follow user"
    });
  }
});

/*
 * DELETE /api/profile/:username/follow
 */
router.delete("/:username/follow", requireAuth, async (req, res) => {
  try {
    const username = String(req.params.username || "").trim().toLowerCase();

    const target = await query(
      `SELECT id
       FROM users
       WHERE username = $1`,
      [username]
    );

    if (target.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Profile not found"
      });
    }

    const targetId = target.rows[0].id;

    const removed = await query(
      `DELETE FROM follows
       WHERE follower_id = $1
         AND following_id = $2
       RETURNING id`,
      [req.user.id, targetId]
    );

    const count = await query(
      `SELECT COUNT(*)::int AS followers_count
       FROM follows
       WHERE following_id = $1`,
      [targetId]
    );

    res.json({
      success: true,
      following: false,
      removed: removed.rows.length > 0,
      followers_count: count.rows[0].followers_count
    });
  } catch (error) {
    console.error("Unfollow error:", error);

    res.status(500).json({
      success: false,
      error: "Could not unfollow user"
    });
  }
});

module.exports = router;
