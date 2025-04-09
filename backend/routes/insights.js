// backend/routes/insights.js
const express = require("express");
const insightController = require("../controllers/insightController");
const authenticateToken = require("../middleware/authenticateToken");
const router = express.Router();

router.use(authenticateToken); // Protect insights route

router.get("/", insightController.getInsights); // GET /api/insights

module.exports = router;
