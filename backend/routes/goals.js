// backend/routes/goals.js
const express = require("express");
const goalController = require("../controllers/goalController");
const authenticateToken = require("../middleware/authenticateToken");
const router = express.Router();

router.use(authenticateToken); // Protect all goal routes

router.get("/", goalController.getGoals); // GET /api/goals?status=...
router.post("/", goalController.addGoal); // POST /api/goals
router.put("/:goalId/status", goalController.updateGoalStatus); // PUT /api/goals/:goalId/status
router.delete("/:goalId", goalController.deleteGoal); // DELETE /api/goals/:goalId

module.exports = router;
