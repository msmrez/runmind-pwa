// backend/routes/diary.js
const express = require("express");
const diaryController = require("../controllers/diaryController");
const authenticateToken = require("../middleware/authenticateToken");
const router = express.Router();

router.use(authenticateToken); // Protect all diary routes

router.get("/", diaryController.getDiaryEntry); // GET /api/diary?date=...
router.post("/", diaryController.saveDiaryEntry); // POST /api/diary
router.delete("/", diaryController.deleteDiaryEntry); // DELETE /api/diary?date=...

module.exports = router;
