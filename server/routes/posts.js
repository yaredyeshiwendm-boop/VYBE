const express = require("express");

const { query } = require("../../db");
const {
  requireAuth,
  optionalAuth
} = require("../middleware/auth");

const { createNotification } = require("../services/notifications");

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
  SELECT COALESCE(
    json_object_agg(
      r.reaction_type,
      r.reaction_count
    ),
    '{}'::json
  )
  FROM (
    SELECT
      reaction_type,
      COUNT(*)::int AS reaction_count
    FROM reactions
    WHERE post_id = p.id
    GROUP BY reaction_type
  ) r
) AS reaction_counts,

        (
          SELECT r.reaction_type
          FROM reactions r
          WHERE r.post_id = p.id
            AND r.user_id = $1
          LIMIT 1
        ) AS viewer_reaction,

        (
          SELECT COUNT(*)
          FROM reposts rp
          WHERE rp.post_id = p.id
        )::int AS repost_count,

        EXISTS (
          SELECT 1
          FROM reposts rp
          WHERE rp.post_id = p.id
            AND rp.user_id = $1
        ) AS viewer_reposted,

        (
          SELECT COUNT(*)
          FROM saves sp
          WHERE sp.post_id = p.id
        )::int AS save_count,

        EXISTS (
          SELECT 1
          FROM saves sp
          WHERE sp.post_id = p.id
            AND sp.user_id = $1
        ) AS viewer_saved

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
    const reaction = String(
      req.body.reaction ??
      req.body.reaction_type ??
      ""
    )
      .trim()
      .toLowerCase();

    if (!ALLOWED_REACTIONS.has(reaction)) {
      return res.status(400).json({
        success: false,
        error: "Invalid reaction type"
      });
    }

    const postCheck = await query(
      `SELECT
        id,
        user_id
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

    const existingReaction = await query(
      `SELECT id
       FROM reactions
       WHERE post_id = $1
         AND user_id = $2`,
      [postId, req.user.id]
    );

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

    if (
      existingReaction.rows.length === 0 &&
      postCheck.rows[0].user_id !== req.user.id
    ) {
      await createNotification({
        recipientId: postCheck.rows[0].user_id,
        actorId: req.user.id,
        type: "reaction",
        postId
      });
    }

    const countResult = await query(
      `SELECT COUNT(*)::int AS reaction_count
       FROM reactions
       WHERE post_id = $1`,
      [postId]
    );

    res.json({
      success: true,
      reaction: result.rows[0],
      reaction_count: countResult.rows[0].reaction_count,
      reaction_counts: (
        await query(
          `SELECT
             COALESCE(
               json_object_agg(reaction_type, reaction_count),
               '{}'::json
             ) AS reaction_counts
           FROM (
             SELECT
               reaction_type,
               COUNT(*)::int AS reaction_count
             FROM reactions
             WHERE post_id = $1
             GROUP BY reaction_type
           ) counts`,
          [postId]
        )
      ).rows[0].reaction_counts
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
      reaction_count: countResult.rows[0].reaction_count,
      reaction_counts: (
        await query(
          `SELECT
             COALESCE(
               json_object_agg(reaction_type, reaction_count),
               '{}'::json
             ) AS reaction_counts
           FROM (
             SELECT
               reaction_type,
               COUNT(*)::int AS reaction_count
             FROM reactions
             WHERE post_id = $1
             GROUP BY reaction_type
           ) counts`,
          [postId]
        )
      ).rows[0].reaction_counts
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
        ) AS viewer_reaction,

        (
          SELECT COUNT(*)
          FROM reposts rp
          WHERE rp.post_id = p.id
        )::int AS repost_count,

        EXISTS (
          SELECT 1
          FROM reposts rp
          WHERE rp.post_id = p.id
            AND rp.user_id = $2
        ) AS viewer_reposted,

        (
          SELECT COUNT(*)
          FROM saves sp
          WHERE sp.post_id = p.id
        )::int AS save_count,

        EXISTS (
          SELECT 1
          FROM saves sp
          WHERE sp.post_id = p.id
            AND sp.user_id = $2
        ) AS viewer_saved

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

// =========================================
// COMMENTS
// =========================================

router.get("/:id/comments", optionalAuth, async (req, res) => {
  try {
    const postId = String(req.params.id);

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
      `SELECT
        c.id,
        c.post_id,
        c.user_id,
        c.content,
        c.created_at,
        c.updated_at,

        u.username,
        u.display_name,
        u.avatar_url,
        u.is_verified

       FROM comments c

       INNER JOIN users u
         ON u.id = c.user_id

       WHERE c.post_id = $1

       ORDER BY c.created_at ASC

       LIMIT 100`,
      [postId]
    );

    res.json({
      success: true,
      comments: result.rows
    });
  } catch (error) {
    console.error("Get comments error:", error);

    res.status(500).json({
      success: false,
      error: "Could not load comments"
    });
  }
});


router.post("/:id/comments", requireAuth, async (req, res) => {
  try {
    const postId = String(req.params.id);
    const content = String(req.body.content || "").trim();

    if (!content) {
      return res.status(400).json({
        success: false,
        error: "Comment content is required"
      });
    }

    if (content.length > 1000) {
      return res.status(400).json({
        success: false,
        error: "Comment cannot exceed 1000 characters"
      });
    }

    const postCheck = await query(
      `SELECT
        id,
        user_id
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
      `INSERT INTO comments
        (post_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING
        id,
        post_id,
        user_id,
        content,
        created_at,
        updated_at`,
      [postId, req.user.id, content]
    );

    await createNotification({
      recipientId: postCheck.rows[0].user_id,
      actorId: req.user.id,
      type: "comment",
      postId,
      commentId: result.rows[0].id
    });

    const author = await query(
      `SELECT
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
      comment: {
        ...result.rows[0],
        ...author.rows[0]
      }
    });
  } catch (error) {
    console.error("Create comment error:", error);

    res.status(500).json({
      success: false,
      error: "Could not create comment"
    });
  }
});


router.delete(
  "/:id/comments/:commentId",
  requireAuth,
  async (req, res) => {
    try {
      const postId = String(req.params.id);
      const commentId = String(req.params.commentId);

      const result = await query(
        `DELETE FROM comments
         WHERE id = $1
           AND post_id = $2
           AND user_id = $3
         RETURNING id`,
        [
          commentId,
          postId,
          req.user.id
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Comment not found or not owned by you"
        });
      }

      res.json({
        success: true,
        deletedCommentId: result.rows[0].id
      });
    } catch (error) {
      console.error("Delete comment error:", error);

      res.status(500).json({
        success: false,
        error: "Could not delete comment"
      });
    }
  }
);


/*
 * PUT /api/posts/:id/repost
 * Repost current user's post
 */
router.put("/:id/repost", requireAuth, async (req, res) => {
  try {
    const postId = String(req.params.id);

    const postCheck = await query(
      `SELECT
        id,
        user_id
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
      `INSERT INTO reposts
        (post_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (post_id, user_id)
       DO NOTHING
       RETURNING
        id,
        post_id,
        user_id,
        created_at`,
      [postId, req.user.id]
    );

    if (
      result.rows.length > 0 &&
      postCheck.rows[0].user_id !== req.user.id
    ) {
      await createNotification({
        recipientId: postCheck.rows[0].user_id,
        actorId: req.user.id,
        type: "repost",
        postId
      });
    }

    const countResult = await query(
      `SELECT COUNT(*)::int AS repost_count
       FROM reposts
       WHERE post_id = $1`,
      [postId]
    );

    res.json({
      success: true,
      reposted: true,
      created: result.rows.length > 0,
      repost: result.rows[0] || null,
      repost_count: countResult.rows[0].repost_count
    });
  } catch (error) {
    console.error("Create repost error:", error);

    res.status(500).json({
      success: false,
      error: "Could not repost post"
    });
  }
});


/*
 * DELETE /api/posts/:id/repost
 * Remove current user's repost
 */
router.delete("/:id/repost", requireAuth, async (req, res) => {
  try {
    const postId = String(req.params.id);

    const result = await query(
      `DELETE FROM reposts
       WHERE post_id = $1
         AND user_id = $2
       RETURNING id`,
      [postId, req.user.id]
    );

    const countResult = await query(
      `SELECT COUNT(*)::int AS repost_count
       FROM reposts
       WHERE post_id = $1`,
      [postId]
    );

    res.json({
      success: true,
      reposted: false,
      removed: result.rows.length > 0,
      repost_count: countResult.rows[0].repost_count
    });
  } catch (error) {
    console.error("Remove repost error:", error);

    res.status(500).json({
      success: false,
      error: "Could not remove repost"
    });
  }
});


/*
 * PUT /api/posts/:id/save
 * Save current user's post
 */
router.put("/:id/save", requireAuth, async (req, res) => {
  try {
    const postId = String(req.params.id);

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
      `INSERT INTO saves
        (post_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (post_id, user_id)
       DO NOTHING
       RETURNING
        id,
        post_id,
        user_id,
        created_at`,
      [postId, req.user.id]
    );

    const countResult = await query(
      `SELECT COUNT(*)::int AS save_count
       FROM saves
       WHERE post_id = $1`,
      [postId]
    );

    res.json({
      success: true,
      saved: true,
      created: result.rows.length > 0,
      save: result.rows[0] || null,
      save_count: countResult.rows[0].save_count
    });
  } catch (error) {
    console.error("Save post error:", error);

    res.status(500).json({
      success: false,
      error: "Could not save post"
    });
  }
});


/*
 * DELETE /api/posts/:id/save
 * Remove current user's saved post
 */
router.delete("/:id/save", requireAuth, async (req, res) => {
  try {
    const postId = String(req.params.id);

    const result = await query(
      `DELETE FROM saves
       WHERE post_id = $1
         AND user_id = $2
       RETURNING id`,
      [postId, req.user.id]
    );

    const countResult = await query(
      `SELECT COUNT(*)::int AS save_count
       FROM saves
       WHERE post_id = $1`,
      [postId]
    );

    res.json({
      success: true,
      saved: false,
      removed: result.rows.length > 0,
      save_count: countResult.rows[0].save_count
    });
  } catch (error) {
    console.error("Unsave post error:", error);

    res.status(500).json({
      success: false,
      error: "Could not unsave post"
    });
  }
});

module.exports = router;

/*
 * POST /api/posts/:id/report
 * Report a post
 */
router.post("/:id/report", requireAuth, async (req, res) => {
  try {
    const postId = String(req.params.id || "").trim();

    const reason = String(req.body?.reason || "").trim().toLowerCase();
    const details = String(req.body?.details || "").trim();

    const allowedReasons = new Set([
      "spam",
      "harassment",
      "hate",
      "violence",
      "sexual",
      "misinformation",
      "other"
    ]);

    if (!allowedReasons.has(reason)) {
      return res.status(400).json({
        success: false,
        error: "Invalid report reason"
      });
    }

    if (details.length > 500) {
      return res.status(400).json({
        success: false,
        error: "Report details are too long"
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
      `INSERT INTO reports
        (reporter_id, post_id, reason, details)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (reporter_id, post_id)
       DO NOTHING
       RETURNING
        id,
        post_id,
        reason,
        details,
        status,
        created_at`,
      [
        req.user.id,
        postId,
        reason,
        details
      ]
    );

    res.status(201).json({
      success: true,
      created: result.rows.length > 0,
      already_reported: result.rows.length === 0,
      report: result.rows[0] || null
    });
  } catch (error) {
    console.error("Report post error:", error);

    res.status(500).json({
      success: false,
      error: "Could not report post"
    });
  }
});
