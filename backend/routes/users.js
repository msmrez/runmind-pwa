// backend/routes/users.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController.js"); // Assuming controller file name
const authenticateToken = require("../middleware/authenticateToken.js");
const checkRole = require("../middleware/checkRole.js");

// ... other user routes (like getting profile, etc.) ...

// --- Training Notes Route ---
// GET /api/users/training_notes
router.get(
  "/training_notes", // The specific path relative to the base '/api/users'
  authenticateToken,
  checkRole(["runner"]), // Check for runner role
  userController.getMyTrainingNotes // Check if this matches the exported function name
);

module.exports = router;
