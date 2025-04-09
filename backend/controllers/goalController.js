// backend/controllers/goalController.js
const db = require("../db");
const analyticsService = require("../services/analyticsService"); // For calculatePaceMinPerKm if needed

exports.getGoals = async (req, res, next) => {
  const userId = req.user.userId;
  const { status } = req.query;
  console.log(`[Goal Ctrl] GET / - User: ${userId}, Status: ${status}`);
  let query = `SELECT goal_id, type, target_value, start_date, end_date, status, name, created_at FROM goals WHERE user_id = $1`;
  const params = [userId];
  if (status && ["active", "completed", "abandoned"].includes(status)) {
    query += ` AND status = $2`;
    params.push(status);
  }
  query += ` ORDER BY end_date DESC, start_date DESC;`;
  try {
    const { rows: goals } = await db.query(query, params);
    // Calculate progress
    const goalsWithProgress = [];
    const now = new Date();
    for (const goal of goals) {
      let currentProgress = null;
      let progQuery = "";
      let progParams = [userId, goal.start_date, goal.end_date];
      const goalEndDate = new Date(goal.end_date);
      goalEndDate.setDate(goalEndDate.getDate() + 1);
      if (goal.status === "active" && goalEndDate >= now) {
        switch (goal.type) {
          case "weekly_distance":
          case "monthly_distance":
            progQuery = `SELECT COALESCE(SUM(distance), 0) as v FROM activities WHERE user_id=$1 AND type='Run' AND start_date_local BETWEEN $2 AND $3;`;
            break;
          case "weekly_runs":
          case "monthly_runs":
            progQuery = `SELECT COUNT(activity_id) as v FROM activities WHERE user_id=$1 AND type='Run' AND start_date_local BETWEEN $2 AND $3;`;
            break;
        }
        if (progQuery) {
          try {
            const r = await db.query(progQuery, progParams);
            currentProgress = parseFloat(r.rows[0]?.v || 0);
            if (goal.type.includes("distance")) currentProgress /= 1000;
          } catch (e) {
            console.error("Progress calc error:", e);
          }
        }
      }
      goalsWithProgress.push({
        ...goal,
        start_date: goal.start_date.toISOString().split("T")[0],
        end_date: goal.end_date.toISOString().split("T")[0],
        current_progress: currentProgress,
        progress_percent:
          goal.target_value > 0 && currentProgress !== null
            ? Math.min(
                100,
                Math.round((currentProgress / goal.target_value) * 100)
              )
            : 0,
      });
    }
    res.status(200).json(goalsWithProgress);
  } catch (error) {
    next(error);
  }
};

exports.addGoal = async (req, res, next) => {
  const userId = req.user.userId;
  const { type, target_value, start_date, end_date, name } = req.body;
  console.log(`[Goal Ctrl] POST / - User: ${userId}, Type: ${type}`);
  // Validation
  if (
    !type ||
    ![
      "weekly_distance",
      "weekly_runs",
      "monthly_distance",
      "monthly_runs",
    ].includes(type)
  )
    return res.status(400).json({ message: "Invalid type." });
  const target = parseFloat(target_value);
  if (isNaN(target) || target <= 0)
    return res.status(400).json({ message: "Invalid target." });
  if (
    !start_date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(start_date) ||
    !end_date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end_date)
  )
    return res.status(400).json({ message: "Invalid dates." });
  if (new Date(end_date) < new Date(start_date))
    return res.status(400).json({ message: "End date before start." });
  try {
    const query = `INSERT INTO goals (user_id, type, target_value, start_date, end_date, name, status) VALUES ($1, $2, $3, $4, $5, $6, 'active') RETURNING *;`;
    const values = [userId, type, target, start_date, end_date, name || null];
    const { rows } = await db.query(query, values);
    const newGoal = {
      ...rows[0],
      start_date: rows[0].start_date.toISOString().split("T")[0],
      end_date: rows[0].end_date.toISOString().split("T")[0],
    };
    res.status(201).json(newGoal);
  } catch (error) {
    next(error);
  }
};

exports.updateGoalStatus = async (req, res, next) => {
  const userId = req.user.userId;
  const { goalId } = req.params;
  const { status } = req.body;
  const goalIdInt = parseInt(goalId, 10);
  console.log(
    `[Goal Ctrl] PUT /${goalId}/status - User: ${userId}, Status: ${status}`
  );
  if (isNaN(goalIdInt))
    return res.status(400).json({ message: "Invalid Goal ID." });
  if (!status || !["active", "completed", "abandoned"].includes(status))
    return res.status(400).json({ message: "Invalid status." });
  try {
    const query = `UPDATE goals SET status = $1, updated_at = NOW() WHERE goal_id = $2 AND user_id = $3 RETURNING *;`;
    const { rows, rowCount } = await db.query(query, [
      status,
      goalIdInt,
      userId,
    ]);
    if (rowCount === 0) {
      const check = await db.query("SELECT 1 FROM goals WHERE goal_id=$1", [
        goalIdInt,
      ]);
      return res
        .status(check.rowCount === 0 ? 404 : 403)
        .json({
          message: check.rowCount === 0 ? "Not found." : "Permission denied.",
        });
    }
    const updatedGoal = {
      ...rows[0],
      start_date: rows[0].start_date.toISOString().split("T")[0],
      end_date: rows[0].end_date.toISOString().split("T")[0],
    };
    res.status(200).json(updatedGoal);
  } catch (error) {
    next(error);
  }
};

exports.deleteGoal = async (req, res, next) => {
  const userId = req.user.userId;
  const { goalId } = req.params;
  const goalIdInt = parseInt(goalId, 10);
  console.log(`[Goal Ctrl] DELETE /${goalId} - User: ${userId}`);
  if (isNaN(goalIdInt))
    return res.status(400).json({ message: "Invalid Goal ID." });
  try {
    const query = `DELETE FROM goals WHERE goal_id = $1 AND user_id = $2 RETURNING goal_id;`;
    const { rowCount } = await db.query(query, [goalIdInt, userId]);
    if (rowCount === 0) {
      const check = await db.query("SELECT 1 FROM goals WHERE goal_id=$1", [
        goalIdInt,
      ]);
      return res
        .status(check.rowCount === 0 ? 404 : 403)
        .json({
          message: check.rowCount === 0 ? "Not found." : "Permission denied.",
        });
    }
    res.status(200).json({ message: "Goal deleted." });
  } catch (error) {
    next(error);
  }
};
