// backend/controllers/activityController.js
const db = require("../db");
const analyticsService = require("../services/analyticsService"); // For pace calculation

// GET /api/activities
exports.getActivities = async (req, res, next) => {
  const userId = req.user.userId; // From authenticateToken middleware
  console.log(`[Activity Ctrl] GET / - User: ${userId}`);
  try {
    const query = `SELECT activity_id, strava_activity_id, name, distance, moving_time, elapsed_time, total_elevation_gain, type, start_date_local, timezone, average_speed, max_speed, average_heartrate, max_heartrate, mental_mood, mental_focus, mental_stress, mental_notes FROM activities WHERE user_id = $1 ORDER BY start_date_local DESC;`;
    const { rows } = await db.query(query, [userId]);
    const activitiesFormatted = rows.map((act) => ({
      ...act,
      distance_km: act.distance ? (act.distance / 1000).toFixed(2) : "0.00",
      moving_time_formatted: act.moving_time
        ? new Date(act.moving_time * 1000).toISOString().slice(11, 19)
        : "00:00:00",
      pace_per_km: analyticsService.calculatePaceMinPerKm(
        act.distance,
        act.moving_time
      ), // Use service
      mental_mood: act.mental_mood ?? null,
      mental_focus: act.mental_focus ?? null,
      mental_stress: act.mental_stress ?? null,
      mental_notes: act.mental_notes ?? null,
    }));
    res.status(200).json(activitiesFormatted);
  } catch (error) {
    next(error);
  }
};

// GET /api/activities/:activityId
exports.getActivityDetail = async (req, res, next) => {
  const userId = req.user.userId;
  const { activityId } = req.params;
  const activityIdInt = parseInt(activityId, 10);
  console.log(`[Activity Ctrl] GET /${activityId} - User: ${userId}`);

  if (isNaN(activityIdInt)) {
    return res.status(400).json({ message: "Invalid Activity ID." });
  }

  try {
    const query = `SELECT activity_id, strava_activity_id, name, distance, moving_time, elapsed_time, total_elevation_gain, type, start_date, start_date_local, timezone, average_speed, max_speed, average_heartrate, max_heartrate, mental_mood, mental_focus, mental_stress, mental_notes FROM activities WHERE activity_id = $1 AND user_id = $2;`;
    const { rows } = await db.query(query, [activityIdInt, userId]);
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Activity not found or permission denied." });
    }

    const activity = rows[0];
    const activityFormatted = {
      /* ... format data like in getActivities ... */ ...activity,
      distance_km: activity.distance
        ? (activity.distance / 1000).toFixed(2)
        : "0.00",
      moving_time_formatted: activity.moving_time
        ? new Date(activity.moving_time * 1000).toISOString().slice(11, 19)
        : "00:00:00",
      pace_per_km: analyticsService.calculatePaceMinPerKm(
        activity.distance,
        activity.moving_time
      ),
      mental_mood: activity.mental_mood ?? null,
      mental_focus: activity.mental_focus ?? null,
      mental_stress: activity.mental_stress ?? null,
      mental_notes: activity.mental_notes ?? null,
    };
    res.status(200).json(activityFormatted);
  } catch (error) {
    next(error);
  }
};

// POST /api/activities/:activityId/mental_state
exports.saveMentalState = async (req, res, next) => {
  const userId = req.user.userId;
  const { activityId } = req.params;
  const { mood, focus, stress, notes } = req.body;
  const activityIdInt = parseInt(activityId, 10);
  console.log(
    `[Activity Ctrl] POST /${activityId}/mental_state - User: ${userId}`
  );

  if (isNaN(activityIdInt)) {
    return res.status(400).json({ message: "Invalid Activity ID." });
  }
  const isValidScale = (v) =>
    v === null || v === undefined || (Number.isInteger(v) && v >= 1 && v <= 5);
  if (!isValidScale(mood) || !isValidScale(focus) || !isValidScale(stress)) {
    return res
      .status(400)
      .json({ message: "Invalid scale value (1-5 or null)." });
  }

  try {
    const query = `UPDATE activities SET mental_mood=$1, mental_focus=$2, mental_stress=$3, mental_notes=$4, updated_at=NOW() WHERE activity_id=$5 AND user_id=$6 RETURNING activity_id, mental_mood, mental_focus, mental_stress, mental_notes;`;
    const values = [
      mood ?? null,
      focus ?? null,
      stress ?? null,
      notes ?? null,
      activityIdInt,
      userId,
    ];
    const { rows, rowCount } = await db.query(query, values);
    if (rowCount === 0) {
      const check = await db.query(
        "SELECT 1 FROM activities WHERE activity_id=$1",
        [activityIdInt]
      );
      return res
        .status(check.rowCount === 0 ? 404 : 403)
        .json({
          message:
            check.rowCount === 0 ? "Activity not found." : "Permission denied.",
        });
    }
    res.status(200).json({ message: "Updated.", updatedState: rows[0] });
  } catch (error) {
    next(error);
  }
};
