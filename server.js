require("dotenv").config();

const express = require("express");
const path = require("path");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { query } = require("./db");
const authRoutes = require("./server/routes/auth");
const profileRoutes = require("./server/routes/profile");
const searchRoutes = require("./server/routes/search");
const postsRoutes = require("./server/routes/posts");

const app = express();
const PORT = process.env.PORT || 3000;

// --------------------------------------------------
// Security
// --------------------------------------------------

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

// --------------------------------------------------
// Body parsing
// --------------------------------------------------

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --------------------------------------------------
// Static frontend
// --------------------------------------------------

app.use(express.static(path.join(__dirname, "public")));

// --------------------------------------------------
// Health check
// --------------------------------------------------

app.get("/api/health", async (req, res) => {
  try {
    const result = await query("SELECT NOW() AS server_time");

    res.json({
      success: true,
      app: "VYBE",
      status: "online",
      database: "connected",
      serverTime: result.rows[0].server_time,
      message: "Post it. Join it. VYBE it."
    });
  } catch (error) {
    console.error("Health check database error:", error);

    res.status(503).json({
      success: false,
      app: "VYBE",
      status: "online",
      database: "disconnected",
      error: "Database unavailable"
    });
  }
});

// --------------------------------------------------
// Authentication
// --------------------------------------------------

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/posts", postsRoutes);

// --------------------------------------------------
// API 404
// --------------------------------------------------

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    error: "API endpoint not found"
  });
});

// --------------------------------------------------
// Frontend fallback
// --------------------------------------------------

app.use((req, res, next) => {
  if (req.method === "GET") {
    return res.sendFile(
      path.join(__dirname, "public", "index.html")
    );
  }

  next();
});

// --------------------------------------------------
// Global error handler
// --------------------------------------------------

app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);

  res.status(500).json({
    success: false,
    error: "Internal server error"
  });
});

// --------------------------------------------------
// Start
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(`🔥 VYBE server running on port ${PORT}`);
});
