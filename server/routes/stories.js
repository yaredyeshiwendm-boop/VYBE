const express = require("express");

const { query } = require("../../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT
        s.id,
        s.user_id,
        s.media_id,
        s.caption,
        s.created_at,
        s.expires_at,

        u.username,
        u.display_name,
        u.avatar_url,
        u.is_verified,

        m.media_type,
        m.url,
        m.mime_type,
        m.size_bytes,
        m.width,
        m.height,
        m.duration_ms,

        (
          SELECT COUNT(*)::int
          FROM story_views sv2
          WHERE sv2.story_id = s.id
        ) AS viewer_count,

        COALESCE((
          SELECT sr.reaction
          FROM story_reactions sr
          WHERE sr.story_id = s.id
            AND sr.user_id = $1
        ), NULL) AS viewer_reaction,

        EXISTS (
          SELECT 1
          FROM story_views sv
          WHERE sv.story_id = s.id
            AND sv.viewer_id = $1
        ) AS viewer_viewed

       FROM stories s

       JOIN users u
         ON u.id = s.user_id

       JOIN media m
         ON m.id = s.media_id

       WHERE s.expires_at > NOW()
         AND (
           s.user_id = $1
           OR EXISTS (
             SELECT 1
             FROM follows f
             WHERE f.follower_id = $1
               AND f.following_id = s.user_id
           )
         )

       ORDER BY s.created_at ASC`,
      [req.user.id]
    );

    res.json({
      success: true,
      stories: result.rows
    });
  } catch (error) {
    console.error("Load stories error:", error);

    res.status(500).json({
      success: false,
      error: "Could not load stories"
    });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const mediaId = String(req.body.media_id || "").trim();
    const caption = String(req.body.caption || "").trim();

    if (!mediaId) {
      return res.status(400).json({
        success: false,
        error: "Media is required"
      });
    }

    if (caption.length > 500) {
      return res.status(400).json({
        success: false,
        error: "Story caption cannot exceed 500 characters"
      });
    }

    const countResult = await query(
      `SELECT COUNT(*)::int AS count
       FROM stories
       WHERE user_id = $1
         AND created_at > NOW() - INTERVAL '24 hours'`,
      [req.user.id]
    );

    if (countResult.rows[0].count >= 3) {
      return res.status(400).json({
        success: false,
        error: "You can only share 3 stories every 24 hours"
      });
    }

    const media = await query(
      `SELECT
        id,
        media_type,
        url,
        mime_type,
        size_bytes,
        width,
        height,
        duration_ms
       FROM media
       WHERE id = $1
         AND user_id = $2
         AND post_id IS NULL`,
      [mediaId, req.user.id]
    );

    if (!media.rows.length) {
      return res.status(404).json({
        success: false,
        error: "Media not found or unavailable"
      });
    }

    const result = await query(
      `INSERT INTO stories
        (user_id, media_id, caption, expires_at)
       VALUES
        ($1, $2, $3, NOW() + INTERVAL '24 hours')
       RETURNING
        id,
        user_id,
        media_id,
        caption,
        created_at,
        expires_at`,
      [req.user.id, mediaId, caption]
    );

    res.status(201).json({
      success: true,
      story: {
        ...result.rows[0],
        media: media.rows[0]
      }
    });
  } catch (error) {
    console.error("Create story error:", error);

    res.status(500).json({
      success: false,
      error: "Could not create story"
    });
  }
});

router.post("/:id/view", requireAuth, async (req, res) => {
  try {
    const story = await query(
      `SELECT id
       FROM stories
       WHERE id = $1
         AND expires_at > NOW()`,
      [req.params.id]
    );

    if (!story.rows.length) {
      return res.status(404).json({
        success: false,
        error: "Story not found or expired"
      });
    }

    await query(
      `INSERT INTO story_views
        (story_id, viewer_id)
       VALUES ($1, $2)
       ON CONFLICT (story_id, viewer_id)
       DO NOTHING`,
      [
        req.params.id,
        req.user.id
      ]
    );

    res.json({
      success: true
    });
  } catch (error) {
    console.error("Story view error:", error);

    res.status(500).json({
      success: false,
      error: "Could not record story view"
    });
  }
});


router.post("/:id/reaction", requireAuth, async (req, res) => {
  try {
    const reaction = String(req.body.reaction || "❤️").trim();

    const allowed = ["❤️", "😂", "😮", "😢", "😡", "👍"];
    if (!allowed.includes(reaction)) {
      return res.status(400).json({
        success: false,
        error: "Invalid reaction"
      });
    }

    const story = await query(
      `SELECT id
       FROM stories
       WHERE id = $1
         AND expires_at > NOW()`,
      [req.params.id]
    );

    if (!story.rows.length) {
      return res.status(404).json({
        success: false,
        error: "Story not found or expired"
      });
    }

    await query(
      `INSERT INTO story_reactions
        (story_id, user_id, reaction)
       VALUES ($1, $2, $3)
       ON CONFLICT (story_id, user_id)
       DO UPDATE SET
         reaction = EXCLUDED.reaction,
         created_at = NOW()`,
      [req.params.id, req.user.id, reaction]
    );

    res.json({
      success: true,
      reaction
    });
  } catch (error) {
    console.error("Story reaction error:", error);

    res.status(500).json({
      success: false,
      error: "Could not react to story"
    });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT
        s.id,
        s.user_id,
        s.media_id,
        s.caption,
        s.created_at,
        s.expires_at,

        u.username,
        u.display_name,
        u.avatar_url,
        u.is_verified,

        m.media_type,
        m.url,
        m.mime_type,
        m.size_bytes,
        m.width,
        m.height,
        m.duration_ms

       FROM stories s
       JOIN users u
         ON u.id = s.user_id
       JOIN media m
         ON m.id = s.media_id

       WHERE s.id = $1
         AND s.expires_at > NOW()
         AND (
           s.user_id = $2
           OR EXISTS (
             SELECT 1
             FROM follows f
             WHERE f.follower_id = $2
               AND f.following_id = s.user_id
           )
         )`,
      [
        req.params.id,
        req.user.id
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        error: "Story not found"
      });
    }

    res.json({
      success: true,
      story: result.rows[0]
    });
  } catch (error) {
    console.error("Get story error:", error);

    res.status(500).json({
      success: false,
      error: "Could not load story"
    });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM stories
       WHERE id = $1
         AND user_id = $2
       RETURNING media_id`,
      [
        req.params.id,
        req.user.id
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        error: "Story not found"
      });
    }

    res.json({
      success: true
    });
  } catch (error) {
    console.error("Delete story error:", error);

    res.status(500).json({
      success: false,
      error: "Could not delete story"
    });
  }
});

module.exports = router;
