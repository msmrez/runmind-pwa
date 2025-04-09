// backend/controllers/diaryController.js
const db = require("../db");

exports.getDiaryEntry = async (req, res, next) => {
  const userId = req.user.userId;
  const { date } = req.query;
  console.log(`[Diary Ctrl] GET /?date=${date} - User: ${userId}`);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res
      .status(400)
      .json({ message: "Invalid date format (YYYY-MM-DD)." });
  }
  try {
    const query = `SELECT entry_id, entry_date, notes, created_at, updated_at FROM diary_entries WHERE user_id = $1 AND entry_date = $2;`;
    const { rows } = await db.query(query, [userId, date]);
    res.status(200).json(rows.length > 0 ? rows[0] : null); // Return entry or null
  } catch (error) {
    next(error);
  }
};

exports.saveDiaryEntry = async (req, res, next) => {
  const userId = req.user.userId;
  const { entry_date, notes } = req.body;
  console.log(`[Diary Ctrl] POST / - User: ${userId}, Date: ${entry_date}`);
  if (!entry_date || !/^\d{4}-\d{2}-\d{2}$/.test(entry_date)) {
    return res
      .status(400)
      .json({ message: "Invalid date format (YYYY-MM-DD)." });
  }
  const notesToSave = notes ?? "";
  try {
    const query = `INSERT INTO diary_entries (user_id, entry_date, notes) VALUES ($1, $2, $3) ON CONFLICT (user_id, entry_date) DO UPDATE SET notes = EXCLUDED.notes, updated_at = NOW() RETURNING *;`;
    const values = [userId, entry_date, notesToSave];
    const { rows } = await db.query(query, values);
    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
};

exports.deleteDiaryEntry = async (req, res, next) => {
  const userId = req.user.userId;
  const { date } = req.query;
  console.log(`[Diary Ctrl] DELETE /?date=${date} - User: ${userId}`);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res
      .status(400)
      .json({ message: "Invalid date format (YYYY-MM-DD)." });
  }
  try {
    const query = `DELETE FROM diary_entries WHERE user_id = $1 AND entry_date = $2 RETURNING entry_id;`;
    const { rowCount } = await db.query(query, [userId, date]);
    if (rowCount === 0) {
      return res
        .status(404)
        .json({ message: "Entry not found for this date." });
    }
    res.status(200).json({ message: "Diary entry deleted." });
  } catch (error) {
    next(error);
  }
};
