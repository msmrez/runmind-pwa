// backend/routes/diet.js
const express = require("express");
const dietController = require("../controllers/dietController");
const authenticateToken = require("../middleware/authenticateToken");
const router = express.Router();

router.use(authenticateToken); // Protect all diet routes

router.get("/", dietController.getDietLogs); // GET /api/diet?date=...
router.post("/", dietController.addDietLog); // POST /api/diet
router.put("/:logId", dietController.updateDietLog); // PUT /api/diet/:logId
router.delete("/:logId", dietController.deleteDietLog); // DELETE /api/diet/:logId

module.exports = router;
