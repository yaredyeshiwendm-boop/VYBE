const express = require("express");

const { query } = require("../../db");
const {
  requireAuth,
  optionalAuth
} = require("../middleware/auth");

const router = express.Router();

const ALLOWED_REACTIONS = new Set([
  "like",
  "love",
  "laugh",
  "wow",
  "sad",
  "angry"
]);

/*
 * GET /api/posts
 * Public feed
 *
 * If logged in:
 *   viewer_reaction = current user's reaction
 *
 * Always:
 *   reaction_count = total reactions
 */
router.get("/", optionalAuth, async (req, res) => {
  try {
    const viewerId = req.user?.id || null;

    const result = await query(
      `SELECT
        p.id,
        p.content,
        p.created_at,
        p.updated_at,

        u.id AS user_id,
        u.username,
        u.display_name,
        u.avatar_url,
        u.is_verified,

        (
          SELECT COUNT(*)
          FROM reactions r
          WHERE r.post_id = p.id
        )::int AS reaction_count,

        (
          SELECT r.reaction_type
          FROM reactions r
          WHERE r.post_id = p.id
            AND r.user_id = $1
          LIMIT 1
        ) AS viewer_reaction

       FROM posts p

       INNER JOIN users u
         ON u.id = p.user_id

       ORDER BY p.created_at DESC

       LIMIT 50`,
      [viewerId]
    );

    res.json({
      success: true,
      posts: result.rows
    });
  } catch (error) {
    console.error("Get posts error:", error);

    res.status(500).json({
      success: false,
      error: "Could not load posts"
    });
  }
});


/*
 * POST /api/posts
 * Create post
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const content = String(req.body.content || "").trim();

    if (!content) {
      return res.status(400).json({
        success: false,
        error: "Post content is required"
      });
    }

    if (content.length > 2000) {
      return res.status(400).json({
        success: false,
        error: "Post cannot exceed 2000 characters"
      });
    }

    const result = await query(
      `INSERT INTO posts
        (user_id, content)

       VALUES ($1, $2)

       RETURNING
        id,
        content,
        created_at,
        updated_at`,
      [
        req.user.id,
        content
      ]
    );

    const post = result.rows[0];

    const author = await query(
      `SELECT
        id AS user_id,
        username,
        display_name,
        avatar_url,
        is_verified
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    res.status(201).json({
      success: true,
      post: {
        ...post,
        ...author.rows[0],
        reaction_count: 0,
        viewer_reaction: null
      }
    });
  } catch (error) {
    console.error("Create post error:", error);

    res.status(500).json({
      success: false,
      error: "Could not create post"
    });
  }
});


/*
 * PUT /api/posts/:id/reaction
 * Add or change current user's reaction
 *
 * Body:
 * {
 *   "reaction": "like"
 * }
 */
router.put("/:id/reaction", requireAuth, async (req, res) => {
  try {
    const postId = String(req.params.id);
    const reaction = String(req.body.reaction || "")
      .trim()
      .toLowerCase();

    if (!ALLOWED_REACTIONS.has(reaction)) {
      return res.status(400).json({
        success: false,
        error: "Invalid reaction type"
      });
    }

    const postCheck = await query(
      `SELECT id
       FROM posts
       WHERE id = $1`,
      [postId]
    );

    if (postCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Post not found"
      });
    }

    const result = await query(
      `INSERT INTO reactions
        (post_id, user_id, reaction_type)

       VALUES ($1, $2, $3)

       ON CONFLICT (post_id, user_id)
       DO UPDATE SET
         reaction_type = EXCLUDED.reaction_type,
         updated_at = NOW()

       RETURNING
        id,
        post_id,
        user_id,
        reaction_type,
        created_at,
        updated_at`,
      [
        postId,
        req.user.id,
        reaction
      ]
    );

    const countResult = await query(
      `SELECT COUNT(*)::int AS reaction_count
       FROM reactions
       WHERE post_id = $1`,
      [postId]
    );

    res.json({
      success: true,
      reaction: result.rows[0],
      reaction_count: countResult.rows[0].reaction_count
    });
  } catch (error) {
    console.error("Set reaction error:", error);

    res.status(500).json({
      success: false,
      error: "Could not save reaction"
    });
  }
});


/*
 * DELETE /api/posts/:id/reaction
 * Remove current user's reaction
 */
router.delete("/:id/reaction", requireAuth, async (req, res) => {
  try {
    const postId = String(req.params.id);

    const result = await query(
      `DELETE FROM reactions
       WHERE post_id = $1
         AND user_id = $2
       RETURNING id`,
      [
        postId,
        req.user.id
      ]
    );

    const countResult = await query(
      `SELECT COUNT(*)::int AS reaction_count
       FROM reactions
       WHERE post_id = $1`,
      [postId]
    );

    res.json({
      success: true,
      removed: result.rows.length > 0,
      reaction_count: countResult.rows[0].reaction_count
    });
  } catch (error) {
    console.error("Remove reaction error:", error);

    res.status(500).json({
      success: false,
      error: "Could not remove reaction"
    });
  }
});


/*
 * DELETE /api/posts/:id
 * Delete own post only
 */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM posts
       WHERE id = $1
         AND user_id = $2
       RETURNING id`,
      [
        req.params.id,
        req.user.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Post not found or not owned by you"
      });
    }

    res.json({
      success: true,
      deletedPostId: result.rows[0].id
    });
  } catch (error) {
    console.error("Delete post error:", error);

    res.status(500).json({
      success: false,
      error: "Could not delete post"
    });
  }
});


/*
 * GET /api/posts/user/:username
 * User's posts
 */
router.get("/user/:username", optionalAuth, async (req, res) => {
  try {
    const username = String(req.params.username)
      .trim()
      .toLowerCase();

    const viewerId = req.user?.id || null;

    const result = await query(
      `SELECT
        p.id,
        p.content,
        p.created_at,
        p.updated_at,

        u.id AS user_id,
        u.username,
        u.display_name,
        u.avatar_url,
        u.is_verified,

        (
          SELECT COUNT(*)
          FROM reactions r
          WHERE r.post_id = p.id
        )::int AS reaction_count,

        (
          SELECT r.reaction_type
          FROM reactions r
          WHERE r.post_id = p.id
            AND r.user_id = $2
          LIMIT 1
        ) AS viewer_reaction

       FROM posts p

       INNER JOIN users u
         ON u.id = p.user_id

       WHERE u.username = $1

       ORDER BY p.created_at DESC

       LIMIT 50`,
      [
        username,
        viewerId
      ]
    );

    res.json({
      success: true,
      posts: result.rows
    });
  } catch (error) {
    console.error("User posts error:", error);

    res.status(500).json({
      success: false,
      error: "Could not load user posts"
    });
  }
});


module.exports = router;
