const express = require("express");
const fs = require("fs");

const { query } = require("../../db");
const { requireAuth } = require("../middleware/auth");
const {
  upload,
  validateUploadedFile,
  saveUploadedFile
} = require("../middleware/upload");

const router = express.Router();

router.post(
  "/",
  requireAuth,
  upload.single("file"),
  async (req, res) => {
    let savedFile = null;

    try {
      const metadata = validateUploadedFile(req.file);

      savedFile = saveUploadedFile(
        req.file,
        metadata
      );

      const result = await query(
        `INSERT INTO media
          (
            user_id,
            media_type,
            url,
            mime_type,
            size_bytes
          )
         VALUES ($1, $2, $3, $4, $5)
         RETURNING
           id,
           media_type,
           url,
           mime_type,
           size_bytes,
           created_at`,
        [
          req.user.id,
          metadata.type,
          savedFile.url,
          metadata.mimeType,
          metadata.sizeBytes
        ]
      );

      res.status(201).json({
        success: true,
        media: result.rows[0]
      });
    } catch (error) {
      if (savedFile?.absolutePath) {
        try {
          fs.unlinkSync(savedFile.absolutePath);
        } catch {}
      }

      console.error("Media upload error:", error);

      const message =
        error.message ||
        "Could not upload media";

      const clientError =
        message.includes("Only ") ||
        message.includes("Unsupported") ||
        message.includes("content") ||
        message.includes("between") ||
        message.includes("required") ||
        error.code === "LIMIT_FILE_SIZE";

      res.status(clientError ? 400 : 500).json({
        success: false,
        error: clientError
          ? message
          : "Could not upload media"
      });
    }
  }
);

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM media
       WHERE id = $1
         AND user_id = $2
         AND post_id IS NULL
         AND NOT EXISTS (
           SELECT 1
           FROM stories
           WHERE stories.media_id = media.id
         )
       RETURNING url`,
      [
        req.params.id,
        req.user.id
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        error: "Media not found"
      });
    }

    const url = result.rows[0].url;

    if (url?.startsWith("/uploads/media/")) {
      const filename =
        url.slice("/uploads/media/".length);

      if (
        filename &&
        !filename.includes("/") &&
        !filename.includes("\\")
      ) {
        const absolutePath =
          require("path").join(
            __dirname,
            "../../uploads/media",
            filename
          );

        try {
          fs.unlinkSync(absolutePath);
        } catch {}
      }
    }

    res.json({
      success: true
    });
  } catch (error) {
    console.error("Delete media error:", error);

    res.status(500).json({
      success: false,
      error: "Could not delete media"
    });
  }
});

module.exports = router;
