const express = require("express");
const { query } = require("../../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT
        n.id,
        n.type,
        n.post_id,
        n.comment_id,
        n.created_at,
        n.read_at,

        a.id AS actor_id,
        a.username AS actor_username,
        a.display_name AS actor_display_name,
        a.avatar_url AS actor_avatar_url,
        a.is_verified AS actor_is_verified

       FROM notifications n
       LEFT JOIN users a
         ON a.id = n.actor_id

       WHERE n.recipient_id = $1

       ORDER BY n.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    const unread = await query(
      `SELECT COUNT(*)::int AS count
       FROM notifications
       WHERE recipient_id = $1
         AND read_at IS NULL`,
      [req.user.id]
    );

    res.json({
      success: true,
      notifications: result.rows,
      unread_count: unread.rows[0].count
    });
  } catch (error) {
    console.error("Notifications error:", error);

    res.status(500).json({
      success: false,
      error: "Could not load notifications"
    });
  }
});

router.put("/read-all", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE recipient_id = $1
         AND read_at IS NULL
       RETURNING id`,
      [req.user.id]
    );

    res.json({
      success: true,
      marked_read: result.rowCount
    });
  } catch (error) {
    console.error("Read notifications error:", error);

    res.status(500).json({
      success: false,
      error: "Could not mark notifications as read"
    });
  }
});

router.put("/:id/read", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, NOW())
       WHERE id = $1
         AND recipient_id = $2
       RETURNING id, read_at`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Notification not found"
      });
    }

    res.json({
      success: true,
      notification: result.rows[0]
    });
  } catch (error) {
    console.error("Read notification error:", error);

    res.status(500).json({
      success: false,
      error: "Could not mark notification as read"
    });
  }
});

module.exports = router;
