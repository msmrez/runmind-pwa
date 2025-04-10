// backend/controllers/userController.js

const db = require("../db"); // <<< --- ADD THIS LINE AT THE TOP --- >>>
// Assuming you might need asyncHandler or other imports later
const asyncHandler = require("express-async-handler"); // Optional but good practice
/**
 * @desc    Athlete gets training notes sent to them
 * @route   GET /api/users/training_notes (or /api/athletes/training_notes)
 * @access  Private/Runner
 */
exports.getMyTrainingNotes = async (req, res, next) => {
  const athleteUserId = req.user.userId; // Athlete making the request

  console.log(
    `[Ctrl-getMyTrainingNotes] Athlete ${athleteUserId} requesting notes.`
  );

  try {
    // Fetch training notes sent *to this athlete*
    const notesQuery = `
            SELECT tn.note_id, tn.note_date, tn.instructions, tn.created_at, tn.updated_at,
                   u.first_name as coach_first_name, u.last_name as coach_last_name, u.email as coach_email
            FROM training_notes tn
            JOIN users u ON tn.coach_user_id = u.user_id
            WHERE tn.athlete_user_id = $1
            ORDER BY tn.note_date DESC, tn.created_at DESC;
        `;
    const { rows: notes } = await db.query(notesQuery, [athleteUserId]);
    console.log(`[Ctrl-getMyTrainingNotes] Found ${notes.length} notes.`);
    res.status(200).json(notes);
  } catch (error) {
    console.error("[Ctrl-getMyTrainingNotes] Error:", error);
    next(error);
  }
};
