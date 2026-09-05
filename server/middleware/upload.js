const multer = require("multer");
const crypto = require("crypto");

const ALLOWED = new Map([
  ["image/jpeg", { type: "image", max: 10 * 1024 * 1024, ext: ".jpg" }],
  ["image/png",  { type: "image", max: 10 * 1024 * 1024, ext: ".png" }],
  ["image/webp", { type: "image", max: 10 * 1024 * 1024, ext: ".webp" }],
  ["video/mp4",  { type: "video", max: 50 * 1024 * 1024, ext: ".mp4" }],
  ["video/webm", { type: "video", max: 50 * 1024 * 1024, ext: ".webm" }]
]);

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 1
  },

  fileFilter(req, file, cb) {
    /*
     * Do not trust the client-declared MIME type here.
     * Android/WebView can report an incorrect or empty MIME type.
     * The actual file signature is validated later.
     */
    cb(null, true);
  }
});

function getMediaRule(mimeType) {
  return ALLOWED.get(mimeType) || null;
}

function detectFileType(buffer) {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  // JPEG
  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  // PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: RIFF....WEBP
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  // WebM / Matroska: EBML header
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return "video/webm";
  }

  // MP4: ftyp box
  if (
    buffer.toString("ascii", 4, 8) === "ftyp"
  ) {
    return "video/mp4";
  }

  return null;
}

function validateUploadedFile(file) {
  if (!file || !file.buffer) {
    throw new Error("Media file is required");
  }

  /*
   * Determine the media type from the actual file bytes.
   * Do not rely on the MIME type supplied by the browser/device.
   */
  const detected = detectFileType(file.buffer);

  if (!detected) {
    throw new Error("Unsupported or invalid media file");
  }

  const rule = getMediaRule(detected);

  if (!rule) {
    throw new Error("Unsupported media type");
  }

  if (file.size <= 0 || file.size > rule.max) {
    throw new Error(
      rule.type === "image"
        ? "Image must be between 1 byte and 10 MB"
        : "Video must be between 1 byte and 50 MB"
    );
  }

  return {
    type: rule.type,
    mimeType: detected,
    sizeBytes: file.size,
    extension: rule.ext
  };
}

async function saveUploadedFile(file, metadata) {
  const { put } = require("@vercel/blob");

  const filename =
    crypto.randomBytes(24).toString("hex") +
    metadata.extension;

  const blob = await put(
    `media/${filename}`,
    file.buffer,
    {
      access: "public",
      contentType: metadata.mimeType,
      addRandomSuffix: false
    }
  );

  return {
    filename,
    absolutePath: null,
    url: blob.url
  };
}

module.exports = {
  upload,
  validateUploadedFile,
  saveUploadedFile,
  MEDIA_DIR: null
};
