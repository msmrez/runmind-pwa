// backend/controllers/dietController.js
const db = require("../db");

exports.getDietLogs = async (req, res, next) => {
  const userId = req.user.userId;
  const { date } = req.query;
  console.log(`[Diet Ctrl] GET /?date=${date} - User: ${userId}`);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ message: "Invalid date format." });
  }
  try {
    const query = `SELECT log_id, log_date, meal_type, description, estimated_calories, estimated_protein, estimated_carbs, estimated_fat, created_at FROM diet_logs WHERE user_id = $1 AND log_date = $2 ORDER BY created_at ASC;`;
    const { rows } = await db.query(query, [userId, date]);
    res.status(200).json(rows);
  } catch (error) {
    next(error);
  }
};

exports.addDietLog = async (req, res, next) => {
  const userId = req.user.userId;
  const {
    log_date,
    meal_type,
    description,
    estimated_calories = null,
    estimated_protein = null,
    estimated_carbs = null,
    estimated_fat = null,
  } = req.body;
  console.log(`[Diet Ctrl] POST / - User: ${userId}, Date: ${log_date}`);
  // Basic validation (add more as needed)
  if (
    !log_date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(log_date) ||
    !description ||
    !meal_type
  ) {
    return res
      .status(400)
      .json({ message: "Date, meal type, and description required." });
  }
  const isNullOrPositiveInt = (v) =>
    v === null || (Number.isInteger(Number(v)) && Number(v) >= 0);
  if (
    !isNullOrPositiveInt(estimated_calories) ||
    !isNullOrPositiveInt(estimated_protein) ||
    !isNullOrPositiveInt(estimated_carbs) ||
    !isNullOrPositiveInt(estimated_fat)
  ) {
    return res
      .status(400)
      .json({
        message: "Nutritional values must be positive numbers or null.",
      });
  }
  try {
    const query = `INSERT INTO diet_logs (user_id, log_date, meal_type, description, estimated_calories, estimated_protein, estimated_carbs, estimated_fat) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;`;
    const values = [
      userId,
      log_date,
      meal_type.trim(),
      description.trim(),
      estimated_calories === null ? null : Number(estimated_calories),
      estimated_protein === null ? null : Number(estimated_protein),
      estimated_carbs === null ? null : Number(estimated_carbs),
      estimated_fat === null ? null : Number(estimated_fat),
    ];
    const { rows } = await db.query(query, values);
    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
};

exports.updateDietLog = async (req, res, next) => {
  const userId = req.user.userId;
  const { logId } = req.params;
  const logIdInt = parseInt(logId, 10);
  console.log(`[Diet Ctrl] PUT /${logId} - User: ${userId}`);
  if (isNaN(logIdInt)) {
    return res.status(400).json({ message: "Invalid Log ID." });
  }
  const {
    meal_type,
    description,
    estimated_calories,
    estimated_protein,
    estimated_carbs,
    estimated_fat,
  } = req.body;
  // Build update fields dynamically (similar logic to original server.js)
  const fields = {};
  // ... (populate fields based on what's provided in req.body, including validation) ...
  const fieldKeys = Object.keys(fields);
  if (fieldKeys.length === 0) {
    return res.status(400).json({ message: "No valid fields to update." });
  }
  fields.updated_at = "NOW()";
  const setClauses = Object.keys(fields)
    .map((key, i) => `"${key}" = $${i + 1}`)
    .join(", ");
  const values = [...Object.values(fields), logIdInt, userId];
  try {
    const query = `UPDATE diet_logs SET ${setClauses} WHERE log_id = $${
      values.length - 1
    } AND user_id = $${values.length} RETURNING *;`;
    const { rows, rowCount } = await db.query(query, values);
    if (rowCount === 0) {
      const check = await db.query("SELECT 1 FROM diet_logs WHERE log_id=$1", [
        logIdInt,
      ]);
      return res
        .status(check.rowCount === 0 ? 404 : 403)
        .json({
          message: check.rowCount === 0 ? "Not found." : "Permission denied.",
        });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    next(error);
  }
};

exports.deleteDietLog = async (req, res, next) => {
  const userId = req.user.userId;
  const { logId } = req.params;
  const logIdInt = parseInt(logId, 10);
  console.log(`[Diet Ctrl] DELETE /${logId} - User: ${userId}`);
  if (isNaN(logIdInt)) {
    return res.status(400).json({ message: "Invalid Log ID." });
  }
  try {
    const query = `DELETE FROM diet_logs WHERE log_id = $1 AND user_id = $2 RETURNING log_id;`;
    const { rowCount } = await db.query(query, [logIdInt, userId]);
    if (rowCount === 0) {
      const check = await db.query("SELECT 1 FROM diet_logs WHERE log_id=$1", [
        logIdInt,
      ]);
      return res
        .status(check.rowCount === 0 ? 404 : 403)
        .json({
          message: check.rowCount === 0 ? "Not found." : "Permission denied.",
        });
    }
    res.status(200).json({ message: "Diet log deleted." });
  } catch (error) {
    next(error);
  }
};
