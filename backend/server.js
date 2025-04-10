// backend/server.js

require("dotenv").config();
console.log("Starting RunMind Backend...");

const express = require("express");
const cors = require("cors");
// Assuming db.js exports { pool, query, closePool } as we discussed
const db = require("./db"); // Ensure DB pool is initialized early

// --- Route Imports ---
const authRoutes = require("./routes/auth");
const stravaRoutes = require("./routes/strava"); // Assuming this exports { oauthRouter, apiRouter }
const activityRoutes = require("./routes/activities");
const diaryRoutes = require("./routes/diary");
const dietRoutes = require("./routes/diet");
const goalRoutes = require("./routes/goals");
const insightRoutes = require("./routes/insights");
const coachRoutes = require("./routes/coaches");
const userRoutes = require("./routes/users");
// --- End Route Imports ---

const app = express();
const port = process.env.PORT || 5001;

// --- Core Middleware ---
app.use(cors());
app.use(express.json());
// --- End Core Middleware ---

// --- API Route Mounting ---
console.log("Mounting routes...");
app.use("/auth", authRoutes);
// Adjust based on actual exports from strava.js
if (stravaRoutes.oauthRouter) app.use("/strava", stravaRoutes.oauthRouter);
if (stravaRoutes.apiRouter) app.use("/api/strava", stravaRoutes.apiRouter);
app.use("/api/activities", activityRoutes);
app.use("/api/diary", diaryRoutes);
app.use("/api/diet", dietRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/insights", insightRoutes);
app.use("/api/coaches", coachRoutes); // <-- Your coaches routes
app.use("/api/users", userRoutes);
console.log("Routes mounted.");
// --- End API Route Mounting ---

// --- Basic Root Route ---
app.get("/", (req, res) => {
  res.send("RunMind Backend API is running!");
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
  console.error("Global Error Handler Caught:", err.stack || err);
  res.status(err.status || 500).json({
    message: err.message || "An unexpected server error occurred.",
    // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// --- Conditionally Start Server ---
let server;
if (require.main === module || process.env.NODE_ENV === "development") {
  // Start server if run directly OR in development mode
  server = app.listen(port, () => {
    console.log(`RunMind Backend server listening on http://localhost:${port}`);
  });

  // --- Graceful Shutdown Handling (Only when server is running) ---
  const shutdown = async (signal) => {
    console.log(`\n${signal} received: closing HTTP server and DB pool...`);
    server.close(async () => {
      console.log("HTTP server closed.");
      try {
        // Use the exported closePool function from db.js
        if (db.closePool) {
          await db.closePool();
        } else {
          // Fallback if closePool wasn't exported somehow
          await db.pool.end();
          console.log("DB pool closed (fallback).");
        }
        process.exit(0);
      } catch (err) {
        console.error("Error closing DB pool:", err);
        process.exit(1);
      }
    });
    // Force close
    setTimeout(() => {
      console.error(
        "Could not close connections gracefully, forcing shutdown."
      );
      process.exit(1);
    }, 10000);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  // --- End Graceful Shutdown ---
} else {
  console.log("[Server.js] Not starting listener, exporting app for import.");
}

// --- Export the app for testing ---
module.exports = { app }; // Export the Express app instance
