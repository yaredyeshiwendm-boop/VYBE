const express = require("express");
const { query } = require("../../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const MAX_MESSAGE_LENGTH = 5000;

// --------------------------------------------------
// GET /api/messages/conversations
// Current user's conversations
// --------------------------------------------------

router.get("/conversations", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `
      SELECT
        c.id,
        c.updated_at,

        other_user.id AS user_id,
        other_user.username,
        other_user.display_name,

        last_message.content AS last_message,
        last_message.created_at AS last_message_at,

        COALESCE(unread.unread_count, 0)::int AS unread_count

      FROM conversations c

      JOIN conversation_members mine
        ON mine.conversation_id = c.id
       AND mine.user_id = $1

      JOIN conversation_members other_member
        ON other_member.conversation_id = c.id
       AND other_member.user_id <> $1

      JOIN users other_user
        ON other_user.id = other_member.user_id

      LEFT JOIN LATERAL (
        SELECT
          m.content,
          m.created_at
        FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) last_message ON true

      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS unread_count
        FROM messages m
        WHERE m.conversation_id = c.id
          AND m.sender_id <> $1
          AND (
            mine.last_read_at IS NULL
            OR m.created_at > mine.last_read_at
          )
      ) unread ON true

      ORDER BY COALESCE(last_message.created_at, c.updated_at) DESC
      `,
      [req.user.id]
    );

    res.json({
      success: true,
      conversations: result.rows
    });
  } catch (error) {
    console.error("Get conversations error:", error);

    res.status(500).json({
      success: false,
      error: "Could not load conversations"
    });
  }
});

// --------------------------------------------------
// POST /api/messages/conversations
// Create or get a 1-to-1 conversation
// --------------------------------------------------

router.post("/conversations", requireAuth, async (req, res) => {
  try {
    const targetUserId = String(req.body.user_id || "").trim();

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        error: "user_id is required"
      });
    }

    if (targetUserId === req.user.id) {
      return res.status(400).json({
        success: false,
        error: "You cannot start a conversation with yourself"
      });
    }

    const userCheck = await query(
      `
      SELECT id, username, display_name
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [targetUserId]
    );

    if (!userCheck.rows.length) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    const existing = await query(
      `
      SELECT c.id
      FROM conversations c
      JOIN conversation_members a
        ON a.conversation_id = c.id
       AND a.user_id = $1
      JOIN conversation_members b
        ON b.conversation_id = c.id
       AND b.user_id = $2
      WHERE (
        SELECT COUNT(*)
        FROM conversation_members cm
        WHERE cm.conversation_id = c.id
      ) = 2
      LIMIT 1
      `,
      [req.user.id, targetUserId]
    );

    if (existing.rows.length) {
      return res.json({
        success: true,
        conversation: {
          id: existing.rows[0].id,
          user: userCheck.rows[0]
        },
        created: false
      });
    }

    const conversation = await query(
      `
      INSERT INTO conversations
      DEFAULT VALUES
      RETURNING id, created_at, updated_at
      `
    );

    const conversationId = conversation.rows[0].id;

    await query(
      `
      INSERT INTO conversation_members
        (conversation_id, user_id)
      VALUES
        ($1, $2),
        ($1, $3)
      `,
      [conversationId, req.user.id, targetUserId]
    );

    res.status(201).json({
      success: true,
      conversation: {
        ...conversation.rows[0],
        user: userCheck.rows[0]
      },
      created: true
    });
  } catch (error) {
    console.error("Create conversation error:", error);

    res.status(500).json({
      success: false,
      error: "Could not create conversation"
    });
  }
});

// --------------------------------------------------
// GET /api/messages/conversations/:id
// Conversation messages
// --------------------------------------------------

router.get("/conversations/:id", requireAuth, async (req, res) => {
  try {
    const conversationId = String(req.params.id || "").trim();

    const membership = await query(
      `
      SELECT
        c.id,
        other_user.id AS user_id,
        other_user.username,
        other_user.display_name
      FROM conversations c

      JOIN conversation_members mine
        ON mine.conversation_id = c.id
       AND mine.user_id = $1

      JOIN conversation_members other_member
        ON other_member.conversation_id = c.id
       AND other_member.user_id <> $1

      JOIN users other_user
        ON other_user.id = other_member.user_id

      WHERE c.id = $2
      LIMIT 1
      `,
      [req.user.id, conversationId]
    );

    if (!membership.rows.length) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found"
      });
    }

    const messages = await query(
      `
      SELECT
        m.id,
        m.conversation_id,
        m.sender_id,
        m.content,
        m.created_at,
        u.username,
        u.display_name
      FROM messages m
      JOIN users u
        ON u.id = m.sender_id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
      LIMIT 500
      `,
      [conversationId]
    );

    res.json({
      success: true,
      conversation: membership.rows[0],
      messages: messages.rows
    });
  } catch (error) {
    console.error("Get messages error:", error);

    res.status(500).json({
      success: false,
      error: "Could not load messages"
    });
  }
});

// --------------------------------------------------
// POST /api/messages/conversations/:id
// Send message
// --------------------------------------------------

router.post("/conversations/:id", requireAuth, async (req, res) => {
  try {
    const conversationId = String(req.params.id || "").trim();
    const content = String(req.body.content || "").trim();

    if (!content) {
      return res.status(400).json({
        success: false,
        error: "Message cannot be empty"
      });
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        success: false,
        error: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`
      });
    }

    const membership = await query(
      `
      SELECT 1
      FROM conversation_members
      WHERE conversation_id = $1
        AND user_id = $2
      LIMIT 1
      `,
      [conversationId, req.user.id]
    );

    if (!membership.rows.length) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found"
      });
    }

    const result = await query(
      `
      INSERT INTO messages
        (conversation_id, sender_id, content)
      VALUES
        ($1, $2, $3)
      RETURNING
        id,
        conversation_id,
        sender_id,
        content,
        created_at,
        updated_at
      `,
      [conversationId, req.user.id, content]
    );

    await query(
      `
      UPDATE conversations
      SET updated_at = NOW()
      WHERE id = $1
      `,
      [conversationId]
    );

    const io = req.app.get("io");

    if (io) {
      io.to(`conversation:${conversationId}`).emit(
        "dm:message",
        {
          ...result.rows[0],
          username: req.user.username
        }
      );
    }

    res.status(201).json({
      success: true,
      message: result.rows[0]
    });
  } catch (error) {
    console.error("Send message error:", error);

    res.status(500).json({
      success: false,
      error: "Could not send message"
    });
  }
});

// --------------------------------------------------
// PUT /api/messages/conversations/:id/read
// Mark conversation as read
// --------------------------------------------------

router.put("/conversations/:id/read", requireAuth, async (req, res) => {
  try {
    const conversationId = String(req.params.id || "").trim();

    const result = await query(
      `
      UPDATE conversation_members
      SET last_read_at = NOW()
      WHERE conversation_id = $1
        AND user_id = $2
      RETURNING conversation_id, last_read_at
      `,
      [conversationId, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found"
      });
    }

    res.json({
      success: true,
      read: result.rows[0]
    });
  } catch (error) {
    console.error("Mark conversation read error:", error);

    res.status(500).json({
      success: false,
      error: "Could not mark conversation as read"
    });
  }
});

module.exports = router;
