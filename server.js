require("dotenv").config();

const express = require("express");
const path = require("path");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const { query } = require("./db");
const authRoutes = require("./server/routes/auth");
const profileRoutes = require("./server/routes/profile");
const searchRoutes = require("./server/routes/search");
const postsRoutes = require("./server/routes/posts");
const notificationsRoutes = require("./server/routes/notifications");
const mediaRoutes = require("./server/routes/media");
const storiesRoutes = require("./server/routes/stories");
const messagesRoutes = require("./server/routes/messages");

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: true,
    credentials: true
  }
});

// Make Socket.IO available to Express routes.
app.set("io", io);

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
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  fallthrough: false,
  index: false
}));

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
app.use("/api/notifications", notificationsRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/stories", storiesRoutes);
app.use("/api/messages", messagesRoutes);

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

// --------------------------------------------------
// Socket.IO — VYBE realtime messaging
// --------------------------------------------------

io.use((socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie || "";

    const cookies = Object.fromEntries(
      cookieHeader
        .split(";")
        .map(part => part.trim())
        .filter(Boolean)
        .map(part => {
          const index = part.indexOf("=");
          if (index === -1) return [part, ""];
          return [
            decodeURIComponent(part.slice(0, index)),
            decodeURIComponent(part.slice(index + 1))
          ];
        })
    );

    const token = cookies.vybe_token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    socket.user = {
      id: decoded.id,
      username: decoded.username
    };

    next();
  } catch (error) {
    console.error("Socket authentication error:", error.message);
    next(new Error("Invalid or expired authentication"));
  }
});

io.on("connection", socket => {
  console.log(
    `[VYBE SOCKET] connected: ${socket.user.username}`
  );

  socket.join(`user:${socket.user.id}`);

  socket.on("join_conversation", async conversationId => {
    try {
      const result = await query(
        `
        SELECT 1
        FROM conversation_members
        WHERE conversation_id = $1
          AND user_id = $2
        LIMIT 1
        `,
        [conversationId, socket.user.id]
      );

      if (!result.rows.length) return;

      socket.join(`conversation:${conversationId}`);
    } catch (error) {
      console.error(
        "Socket join conversation error:",
        error
      );
    }
  });

  socket.on("leave_conversation", conversationId => {
    socket.leave(`conversation:${conversationId}`);
  });

  socket.on("disconnect", reason => {
    console.log(
      `[VYBE SOCKET] disconnected: ${socket.user.username} (${reason})`
    );
  });
});

httpServer.listen(PORT, () => {
  console.log(`🔥 VYBE server running on port ${PORT}`);
});
