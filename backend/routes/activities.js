// backend/routes/activities.js
const express = require("express");
const activityController = require("../controllers/activityController");
const authenticateToken = require("../middleware/authenticateToken");
const router = express.Router();

// Apply middleware to all routes in this file
router.use(authenticateToken);

// Define routes
router.get("/", activityController.getActivities);
router.get("/:activityId", activityController.getActivityDetail);
router.post("/:activityId/mental_state", activityController.saveMentalState);

module.exports = router;
