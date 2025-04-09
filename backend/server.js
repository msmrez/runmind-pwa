// backend/server.js

require("dotenv").config();
console.log("Starting RunMind Backend...");

const express = require("express");
const cors = require("cors");
const db = require("./db"); // Ensure DB pool is initialized early

// --- Route Imports ---
const authRoutes = require("./routes/auth");
const stravaRoutes = require("./routes/strava");
const activityRoutes = require("./routes/activities");
const diaryRoutes = require("./routes/diary");
const dietRoutes = require("./routes/diet");
const goalRoutes = require("./routes/goals");
const insightRoutes = require("./routes/insights");
// --- End Route Imports ---

const app = express();
const port = process.env.PORT || 5001;

// --- Core Middleware ---
app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // Parse JSON request bodies
// --- End Core Middleware ---

// --- API Route Mounting ---
console.log("Mounting routes...");
app.use("/auth", authRoutes); // Mount auth routes (e.g., /auth/login)
app.use("/strava", stravaRoutes.oauthRouter); // Mount Strava OAuth routes (e.g., /strava/authorize) - Assuming separate router in strava.js
app.use("/api/strava", stravaRoutes.apiRouter); // Mount Strava API routes (e.g., /api/strava/sync) - Assuming separate router
app.use("/api/activities", activityRoutes); // Mount activity routes (e.g., /api/activities/)
app.use("/api/diary", diaryRoutes); // Mount diary routes (e.g., /api/diary)
app.use("/api/diet", dietRoutes); // Mount diet routes (e.g., /api/diet)
app.use("/api/goals", goalRoutes); // Mount goal routes (e.g., /api/goals)
app.use("/api/insights", insightRoutes); // Mount insight routes (e.g., /api/insights)
console.log("Routes mounted.");
// --- End API Route Mounting ---

// --- Basic Root Route ---
app.get("/", (req, res) => {
  res.send("RunMind Backend API is running!");
});

// --- Global Error Handler (Optional but recommended) ---
// Catches errors passed via next(error)
app.use((err, req, res, next) => {
  console.error("Global Error Handler Caught:", err.stack || err);
  res.status(err.status || 500).json({
    message: err.message || "An unexpected server error occurred.",
    // Optionally include stack in development:
    // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// --- Start Server ---
const server = app.listen(port, () => {
  console.log(`RunMind Backend server listening on http://localhost:${port}`);
});

// --- Graceful Shutdown Handling ---
const shutdown = async (signal) => {
  console.log(`\n${signal} received: closing HTTP server and DB pool...`);
  server.close(async () => {
    // Close HTTP server first
    console.log("HTTP server closed.");
    try {
      await db.pool.end(); // Close all DB connections
      console.log("DB pool closed successfully.");
      process.exit(0); // Exit cleanly
    } catch (err) {
      console.error("Error closing DB pool:", err);
      process.exit(1); // Exit with error code
    }
  });
  // Force close server after a timeout if graceful shutdown fails
  setTimeout(() => {
    console.error("Could not close connections gracefully, forcing shutdown.");
    process.exit(1);
  }, 10000); // 10 second timeout
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
// --- End Graceful Shutdown ---
