// backend/routes/strava.js
const express = require("express");
const stravaController = require("../controllers/stravaController");
const authenticateToken = require("../middleware/authenticateToken");

const oauthRouter = express.Router(); // For non-API, browser-redirect routes
const apiRouter = express.Router(); // For API routes called by frontend

// --- OAuth Flow Routes (No token required initially) ---
oauthRouter.get("/authorize", stravaController.authorize);
oauthRouter.post("/token", stravaController.handleCallback); // Frontend sends code here

// --- API Routes (Token required) ---
apiRouter.post("/sync", authenticateToken, stravaController.syncActivities);

module.exports = {
  oauthRouter, // Exported for paths like /strava/authorize
  apiRouter, // Exported for paths like /api/strava/sync
};
