const { query } = require("../../db");

async function createNotification({
  recipientId,
  actorId,
  type,
  postId = null,
  commentId = null
}) {
  if (!recipientId || !actorId || recipientId === actorId) {
    return null;
  }

  const result = await query(
    `INSERT INTO notifications
      (recipient_id, actor_id, type, post_id, comment_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, type, post_id, comment_id, created_at`,
    [
      recipientId,
      actorId,
      type,
      postId,
      commentId
    ]
  );

  return result.rows[0] || null;
}

module.exports = {
  createNotification
};
