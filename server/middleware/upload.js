const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const MEDIA_DIR = path.join(
  __dirname,
  "../../uploads/media"
);

fs.mkdirSync(MEDIA_DIR, {
  recursive: true
});

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
    const rule = ALLOWED.get(file.mimetype);

    if (!rule) {
      return cb(
        new Error(
          "Only JPG, PNG, WebP, MP4 and WebM files are allowed"
        )
      );
    }

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

  const rule = getMediaRule(file.mimetype);

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

  const detected = detectFileType(file.buffer);

  if (detected !== file.mimetype) {
    throw new Error("File content does not match its declared type");
  }

  return {
    type: rule.type,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    extension: rule.ext
  };
}

function saveUploadedFile(file, metadata) {
  const filename =
    crypto.randomBytes(24).toString("hex") +
    metadata.extension;

  const absolutePath = path.join(
    MEDIA_DIR,
    filename
  );

  fs.writeFileSync(
    absolutePath,
    file.buffer,
    { flag: "wx", mode: 0o600 }
  );

  return {
    filename,
    absolutePath,
    url: `/uploads/media/${filename}`
  };
}

module.exports = {
  upload,
  validateUploadedFile,
  saveUploadedFile,
  MEDIA_DIR
};
