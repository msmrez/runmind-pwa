// backend/routes/diary.js
const express = require("express");
const diaryController = require("../controllers/diaryController");
const authenticateToken = require("../middleware/authenticateToken");
const router = express.Router();
const commentController = require("../controllers/commentController");

router.use(authenticateToken); // Protect all diary routes

router.get("/", diaryController.getDiaryEntry); // GET /api/diary?date=...
router.post("/", diaryController.saveDiaryEntry); // POST /api/diary
router.delete("/", diaryController.deleteDiaryEntry); // DELETE /api/diary?date=...

// GET /api/diary/:entryId/comments (Get comments for this entry)
router.get(
  "/:entryId/comments",
  // Auth middleware already applied
  // Permission check is inside commentController.getDiaryEntryComments
  commentController.getDiaryEntryComments
);

// POST /api/diary/:entryId/comments (Add comment to this entry)
router.post(
  "/:entryId/comments",
  // Auth middleware already applied
  // Permission check is inside commentController.addCommentToDiaryEntry
  commentController.addCommentToDiaryEntry
);

module.exports = router;
