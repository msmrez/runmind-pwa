// backend/routes/activities.js
const express = require("express");
const activityController = require("../controllers/activityController");
const commentController = require("../controllers/commentController"); // <<< Make sure this path is correct
const authenticateToken = require("../middleware/authenticateToken");
// Remove checkRole import if not used directly here (checks are in controller)
// const checkRole = require("../middleware/checkRole");
const router = express.Router();

// Apply authentication middleware to ALL activity-related routes
router.use(authenticateToken);

// --- Existing Activity Routes ---
// GET /api/activities (get user's own activities)
router.get("/", activityController.getActivities);

// GET /api/activities/:activityId (get specific activity details)
router.get("/:activityId", activityController.getActivityDetail);

// POST /api/activities/:activityId/mental_state (save mental state for an activity)
router.post("/:activityId/mental_state", activityController.saveMentalState);

// --- <<< START: New Comment Routes for Activities >>> ---

// GET /api/activities/:activityId/comments (Get comments for this activity)
router.get(
  "/:activityId/comments",
  // authenticateToken is already applied by router.use()
  // Role/permission check happens inside commentController.getActivityComments
  commentController.getActivityComments
);

// POST /api/activities/:activityId/comments (Add a comment to this activity)
router.post(
  "/:activityId/comments",
  // authenticateToken is already applied by router.use()
  // Role/permission check happens inside commentController.addCommentToActivity
  commentController.addCommentToActivity
);

// Optional: DELETE route for comments could go here or in a separate /api/comments route
// Example: router.delete('/:activityId/comments/:commentId', ...);
// Or: router.delete('/comments/:commentId', ...); // (Would need a separate comments router)

// --- <<< END: New Comment Routes >>> ---

module.exports = router;
