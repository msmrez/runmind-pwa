// backend/routes/coaches.js
const express = require("express");
const router = express.Router();
const coachController = require("../controllers/coachController"); // We'll create this next
const authenticateToken = require("../middleware/authenticateToken"); // Use the auth middleware
const checkRole = require("../middleware/checkRole"); // We'll create this next

// Athlete requests link with coach
// Any logged-in user (runner) can make this request
router.post("/link/request", authenticateToken, coachController.requestLink);

// Coach gets pending requests
// Only users with 'coach' role can access this
router.get(
  "/link/requests",
  authenticateToken,
  checkRole(["coach"]),
  coachController.getPendingRequests
);

// Coach accepts/declines a request
// Only 'coach' role
router.put(
  "/link/requests/:linkId",
  authenticateToken,
  checkRole(["coach"]),
  coachController.updateRequestStatus
);

// Coach gets list of accepted athletes
// Only 'coach' role
router.get(
  "/athletes",
  authenticateToken,
  checkRole(["coach"]),
  coachController.getLinkedAthletes
);

// Athlete gets list of their coaches (Optional)
router.get(
  "/mycoaches",
  authenticateToken,
  checkRole(["runner"]),
  coachController.getMyCoaches
); // Example for athlete

// GET /api/coaches/athletes/:athleteId/activities (Coach views specific athlete's runs)
router.get(
  "/athletes/:athleteId/activities",
  authenticateToken,
  checkRole(["coach"]), // Ensure only coaches can call this
  coachController.getAthleteActivities // Map to the new controller function
);

// Delete/Revoke link (can be done by coach or athlete)
// Authenticated user must be part of the link
router.delete("/link/:linkId", authenticateToken, coachController.revokeLink);

module.exports = router;
