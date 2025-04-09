// backend/server.js

require("dotenv").config(); // Load environment variables from .env file first
console.log("Attempting to load environment variables...");
console.log(
  "Loaded STRAVA_CLIENT_ID:",
  process.env.STRAVA_CLIENT_ID ? "Found" : "Missing!"
);
console.log("Loaded DB_USER:", process.env.DB_USER ? "Found" : "Missing!");

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const db = require("./db"); // Import the database connection module (pool)

const app = express();
const port = process.env.PORT || 5001;

// --- Middleware ---
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Middleware to parse JSON request bodies - MUST BE BEFORE ROUTES USING req.body

// --- Helper Functions ---

/**
 * Calculates average pace in minutes per kilometer.
 */
function calculatePaceMinPerKm(distanceMeters, movingTimeSeconds) {
  if (
    !distanceMeters ||
    distanceMeters <= 0 ||
    !movingTimeSeconds ||
    movingTimeSeconds <= 0
  )
    return null;
  try {
    const distanceKm = distanceMeters / 1000;
    if (distanceKm === 0) return null;
    const paceSecondsPerKm = movingTimeSeconds / distanceKm;
    const minutes = Math.floor(paceSecondsPerKm / 60);
    const seconds = Math.round(paceSecondsPerKm % 60);
    const formattedSeconds = seconds < 10 ? `0${seconds}` : seconds;
    return `${minutes}:${formattedSeconds} /km`;
  } catch (e) {
    console.error("[calculatePaceMinPerKm] Error:", e);
    return null;
  }
}

/**
 * Refreshes the Strava access token for a given user.
 */
async function refreshStravaToken(userId) {
  /* ... same as previous version ... */
  console.log(`[refreshStravaToken] Attempting for user ID: ${userId}`);
  const client = await db.pool.connect();
  try {
    const tokenQuery = `SELECT strava_refresh_token FROM users WHERE user_id = $1;`;
    const { rows } = await client.query(tokenQuery, [userId]);
    if (rows.length === 0) throw new Error(`User not found for ID: ${userId}`);
    if (!rows[0].strava_refresh_token)
      throw new Error(`Missing refresh token for user ID: ${userId}`);
    const currentRefreshToken = rows[0].strava_refresh_token;
    const stravaClientId = process.env.STRAVA_CLIENT_ID,
      stravaClientSecret = process.env.STRAVA_CLIENT_SECRET;
    const tokenUrl = "https://www.strava.com/oauth/token";
    if (!stravaClientId || !stravaClientSecret)
      throw new Error("Strava client ID or secret missing.");
    console.log(
      `[refreshStravaToken] Requesting refresh from Strava for user ID: ${userId}...`
    );
    const refreshResponse = await axios.post(tokenUrl, null, {
      params: {
        client_id: stravaClientId,
        client_secret: stravaClientSecret,
        grant_type: "refresh_token",
        refresh_token: currentRefreshToken,
      },
    });
    const {
      access_token,
      expires_at,
      refresh_token: newRefreshToken,
    } = refreshResponse.data;
    console.log(`[refreshStravaToken] Success for user ID: ${userId}.`);
    const updateQuery = `UPDATE users SET strava_access_token=$1, strava_refresh_token=$2, strava_token_expires_at=$3, updated_at=NOW() WHERE user_id=$4;`;
    await client.query(updateQuery, [
      access_token,
      newRefreshToken,
      expires_at,
      userId,
    ]);
    console.log(`[refreshStravaToken] DB updated for user ID: ${userId}.`);
    return access_token;
  } catch (error) {
    console.error(
      `[refreshStravaToken] Error for user ID ${userId}:`,
      error.message
    );
    throw error;
  } finally {
    // Rethrow original error
    client.release();
  }
}

// --- Authentication Middleware (Corrected) ---
// !! IMPORTANT !! Replace with proper JWT/Session authentication for production.
const simpleAuthMiddleware = (req, res, next) => {
  // Safely access properties, default to undefined if parent object doesn't exist
  const headerId = req.headers ? req.headers["x-user-id"] : undefined;
  const bodyId = req.body ? req.body.userId : undefined; // Check req.body first
  const queryId = req.query ? req.query.userId : undefined; // Check req.query first

  // Determine userId using the safe values
  const userId = headerId || bodyId || queryId;

  // Update console log to use the safe variables
  console.log(
    `[SimpleAuth] Checking request for User ID (Header: ${headerId}, Body: ${bodyId}, Query: ${queryId}) -> Found: ${userId}`
  );

  if (!userId) {
    console.warn("[SimpleAuth] User ID missing in request.");
    return res
      .status(401)
      .json({ message: "User ID missing. Authentication required." });
  }

  const parsedUserId = parseInt(userId, 10);
  if (isNaN(parsedUserId)) {
    console.warn(`[SimpleAuth] Invalid User ID format received: ${userId}`);
    return res.status(400).json({ message: "Invalid User ID format." });
  }

  req.userId = parsedUserId; // Attach the validated & parsed user ID
  console.log(`[SimpleAuth] Authenticated request for user ID: ${req.userId}`);
  next(); // Proceed to the next middleware or route handler
};
// --- End Authentication Middleware ---

// --- Routes ---

// Route to initiate Strava OAuth flow
app.get("/strava/authorize", (req, res) => {
  console.log("GET /strava/authorize route hit");
  const stravaClientId = process.env.STRAVA_CLIENT_ID;
  const stravaRedirectUri = process.env.STRAVA_REDIRECT_URI;
  if (!stravaClientId || !stravaRedirectUri) {
    console.error("[Authorize] Strava Client ID or Redirect URI missing");
    return res.status(500).send("Server config error.");
  }
  const scope = "read_all,profile:read_all,activity:read_all";
  const authorizationUrl = `https://www.strava.com/oauth/authorize?client_id=${stravaClientId}&redirect_uri=${encodeURIComponent(
    stravaRedirectUri
  )}&response_type=code&approval_prompt=auto&scope=${scope}`;
  console.log(`[Authorize] Redirecting user to Strava`);
  res.redirect(authorizationUrl);
});

// --- NEW ROUTE: Get Single Activity Details ---
app.get(
  "/api/activities/:activityId",
  simpleAuthMiddleware,
  async (req, res) => {
    const userId = req.userId;
    const { activityId } = req.params; // Get activity ID from URL parameter
    console.log(
      `GET /api/activities/${activityId} - Request for user ID: ${userId}`
    );

    const activityIdInt = parseInt(activityId, 10);
    if (isNaN(activityIdInt)) {
      return res.status(400).json({ message: "Invalid Activity ID format." });
    }

    try {
      // Query to get the specific activity, ensuring it belongs to the requesting user
      const query = `
          SELECT
              activity_id, strava_activity_id, name, distance, moving_time, elapsed_time,
              total_elevation_gain, type, start_date, start_date_local, timezone,
              average_speed, max_speed, average_heartrate, max_heartrate,
              mental_mood, mental_focus, mental_stress, mental_notes
          FROM activities
          WHERE activity_id = $1 AND user_id = $2;
      `;
      const { rows } = await db.query(query, [activityIdInt, userId]);

      if (rows.length === 0) {
        console.warn(
          `[Activity Detail] Activity ID ${activityIdInt} not found for user ${userId}.`
        );
        return res.status(404).json({
          message: "Activity not found or you do not have permission.",
        });
      }

      const activity = rows[0];

      // Add calculated fields just like in the list view
      const activityFormatted = {
        ...activity,
        distance_km: activity.distance
          ? (activity.distance / 1000).toFixed(2)
          : "0.00",
        moving_time_formatted: activity.moving_time
          ? new Date(activity.moving_time * 1000).toISOString().slice(11, 19)
          : "00:00:00",
        pace_per_km: calculatePaceMinPerKm(
          activity.distance,
          activity.moving_time
        ),
        mental_mood: activity.mental_mood ?? null,
        mental_focus: activity.mental_focus ?? null,
        mental_stress: activity.mental_stress ?? null,
        mental_notes: activity.mental_notes ?? null,
      };

      console.log(
        `[Activity Detail] Found activity ${activityIdInt} for user ${userId}.`
      );
      res.status(200).json(activityFormatted); // Send the single formatted activity
    } catch (error) {
      console.error(
        `[Activity Detail] Error fetching activity ${activityIdInt} for user ${userId}:`,
        error
      );
      res.status(500).json({
        message: "Failed to fetch activity details.",
        error: error.message,
      });
    }
  }
);

app.get("/api/diary", simpleAuthMiddleware, async (req, res) => {
  const userId = req.userId;
  const { date } = req.query; // Get date from query parameter

  console.log(`GET /api/diary - User: ${userId}, Date: ${date}`);

  // Validate date format (YYYY-MM-DD) - Basic check
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({
      message:
        "Invalid or missing date query parameter. Use YYYY-MM-DD format.",
    });
  }

  try {
    const query = `
          SELECT entry_id, entry_date, notes, created_at, updated_at
          FROM diary_entries
          WHERE user_id = $1 AND entry_date = $2;
      `;
    const { rows } = await db.query(query, [userId, date]);

    if (rows.length > 0) {
      console.log(`[Diary GET] Found entry for User: ${userId}, Date: ${date}`);
      res.status(200).json(rows[0]); // Return the single entry object
    } else {
      console.log(
        `[Diary GET] No entry found for User: ${userId}, Date: ${date}`
      );
      // Return null or an empty object to indicate no entry exists for that date
      res.status(200).json(null);
      // Or use status 404: res.status(404).json({ message: "No diary entry found for this date." });
    }
  } catch (error) {
    console.error(
      `[Diary GET] Error fetching entry for User: ${userId}, Date: ${date}:`,
      error
    );
    res
      .status(500)
      .json({ message: "Failed to fetch diary entry.", error: error.message });
  }
});

// POST (Create or Update) Diary Entry for a specific date
// Uses UPSERT logic based on the UNIQUE constraint (user_id, entry_date)
app.post("/api/diary", simpleAuthMiddleware, async (req, res) => {
  const userId = req.userId;
  const { entry_date, notes } = req.body; // Get date and notes from request body

  console.log(`POST /api/diary - User: ${userId}, Date: ${entry_date}`);

  // Validate date format and presence of notes
  if (!entry_date || !/^\d{4}-\d{2}-\d{2}$/.test(entry_date)) {
    return res.status(400).json({
      message: "Invalid or missing entry_date. Use YYYY-MM-DD format.",
    });
  }
  // Allow empty notes, but ensure it's treated correctly (e.g., as null or empty string)
  const notesToSave = notes ?? ""; // Default to empty string if null/undefined

  try {
    // Use INSERT ... ON CONFLICT to handle create or update in one query
    const query = `
          INSERT INTO diary_entries (user_id, entry_date, notes)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, entry_date) DO UPDATE SET
              notes = EXCLUDED.notes,
              updated_at = NOW()
          RETURNING entry_id, entry_date, notes, created_at, updated_at;
      `;
    const values = [userId, entry_date, notesToSave];

    const { rows } = await db.query(query, values);

    console.log(
      `[Diary POST] Successfully saved/updated entry for User: ${userId}, Date: ${entry_date}`
    );
    res.status(201).json(rows[0]); // Return the created/updated entry
  } catch (error) {
    console.error(
      `[Diary POST] Error saving entry for User: ${userId}, Date: ${entry_date}:`,
      error
    );
    res
      .status(500)
      .json({ message: "Failed to save diary entry.", error: error.message });
  }
});

// DELETE Diary Entry for a specific date
// Example: DELETE /api/diary?date=2024-04-08
app.delete("/api/diary", simpleAuthMiddleware, async (req, res) => {
  const userId = req.userId;
  const { date } = req.query; // Get date from query parameter

  console.log(`DELETE /api/diary - User: ${userId}, Date: ${date}`);

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({
      message:
        "Invalid or missing date query parameter. Use YYYY-MM-DD format.",
    });
  }

  try {
    const query = `
          DELETE FROM diary_entries
          WHERE user_id = $1 AND entry_date = $2
          RETURNING entry_id; -- Return ID to confirm deletion
      `;
    const { rowCount } = await db.query(query, [userId, date]);

    if (rowCount > 0) {
      console.log(
        `[Diary DELETE] Successfully deleted entry for User: ${userId}, Date: ${date}`
      );
      res.status(200).json({ message: "Diary entry deleted successfully." }); // Success message
      // Or use 204 No Content: res.status(204).send();
    } else {
      console.log(
        `[Diary DELETE] No entry found to delete for User: ${userId}, Date: ${date}`
      );
      res
        .status(404)
        .json({ message: "No diary entry found for this date to delete." });
    }
  } catch (error) {
    console.error(
      `[Diary DELETE] Error deleting entry for User: ${userId}, Date: ${date}:`,
      error
    );
    res
      .status(500)
      .json({ message: "Failed to delete diary entry.", error: error.message });
  }
});

app.get("/api/diet", simpleAuthMiddleware, async (req, res) => {
  const userId = req.userId;
  const { date } = req.query; // Get date from query parameter

  console.log(`GET /api/diet - User: ${userId}, Date: ${date}`);

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({
      message:
        "Invalid or missing date query parameter. Use YYYY-MM-DD format.",
    });
  }

  try {
    const query = `
          SELECT
              log_id, log_date, meal_type, description,
              estimated_calories, estimated_protein, estimated_carbs, estimated_fat, created_at
          FROM diet_logs
          WHERE user_id = $1 AND log_date = $2
          ORDER BY created_at ASC; -- Order by creation time within the day
      `;
    const { rows } = await db.query(query, [userId, date]);

    console.log(
      `[Diet GET] Found ${rows.length} entries for User: ${userId}, Date: ${date}`
    );
    res.status(200).json(rows); // Return array of log entries
  } catch (error) {
    console.error(
      `[Diet GET] Error fetching entries for User: ${userId}, Date: ${date}:`,
      error
    );
    res
      .status(500)
      .json({ message: "Failed to fetch diet logs.", error: error.message });
  }
});

// POST (Create) a new Diet Log Entry
app.post("/api/diet", simpleAuthMiddleware, async (req, res) => {
  const userId = req.userId;
  // Destructure expected fields, providing defaults for optional numerics
  const {
    log_date,
    meal_type,
    description,
    estimated_calories = null,
    estimated_protein = null,
    estimated_carbs = null,
    estimated_fat = null,
  } = req.body;

  console.log(`POST /api/diet - User: ${userId}, Date: ${log_date}`);

  // Validation
  if (!log_date || !/^\d{4}-\d{2}-\d{2}$/.test(log_date)) {
    return res
      .status(400)
      .json({ message: "Invalid or missing log_date. Use YYYY-MM-DD format." });
  }
  if (
    !description ||
    typeof description !== "string" ||
    description.trim().length === 0
  ) {
    return res.status(400).json({ message: "Description is required." });
  }
  if (
    !meal_type ||
    typeof meal_type !== "string" ||
    meal_type.trim().length === 0
  ) {
    return res.status(400).json({ message: "Meal type is required." });
  }
  // Optional: Add validation for numeric types if provided
  const isNullOrPositiveInt = (val) =>
    val === null || (Number.isInteger(Number(val)) && Number(val) >= 0);
  if (
    !isNullOrPositiveInt(estimated_calories) ||
    !isNullOrPositiveInt(estimated_protein) ||
    !isNullOrPositiveInt(estimated_carbs) ||
    !isNullOrPositiveInt(estimated_fat)
  ) {
    return res.status(400).json({
      message:
        "Estimated nutritional values must be non-negative numbers or omitted.",
    });
  }

  try {
    const query = `
          INSERT INTO diet_logs (
              user_id, log_date, meal_type, description, estimated_calories,
              estimated_protein, estimated_carbs, estimated_fat
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *; -- Return the full created entry
      `;
    // Ensure null is passed if value wasn't provided or was invalid before check
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

    console.log(
      `[Diet POST] Successfully created entry ID: ${rows[0].log_id} for User: ${userId}, Date: ${log_date}`
    );
    res.status(201).json(rows[0]); // Return the newly created log entry
  } catch (error) {
    console.error(
      `[Diet POST] Error creating entry for User: ${userId}, Date: ${log_date}:`,
      error
    );
    // Check for specific DB errors like check constraint if needed
    if (error.code === "23514") {
      // Check constraint violation
      return res.status(400).json({
        message: "Estimated nutritional values failed DB check (must be >= 0).",
      });
    }
    res.status(500).json({
      message: "Failed to create diet log entry.",
      error: error.message,
    });
  }
});

// PUT (Update) an existing Diet Log Entry
// Example: PUT /api/diet/123 (where 123 is log_id)
app.put("/api/diet/:logId", simpleAuthMiddleware, async (req, res) => {
  const userId = req.userId;
  const { logId } = req.params;
  const logIdInt = parseInt(logId, 10);

  // Get potential fields to update from body
  const {
    meal_type,
    description,
    estimated_calories,
    estimated_protein,
    estimated_carbs,
    estimated_fat,
  } = req.body;

  console.log(`PUT /api/diet/${logId} - User: ${userId}`);

  if (isNaN(logIdInt)) {
    return res.status(400).json({ message: "Invalid Log ID format." });
  }

  // --- Build SET clause dynamically based on provided fields ---
  const fieldsToUpdate = {};
  if (meal_type !== undefined) fieldsToUpdate.meal_type = meal_type.trim();
  if (description !== undefined)
    fieldsToUpdate.description = description.trim();
  // Validate and add numeric fields if present and valid
  const isNullOrPositiveInt = (val) =>
    val === null ||
    val === undefined ||
    val === "" ||
    (Number.isInteger(Number(val)) && Number(val) >= 0);
  if (estimated_calories !== undefined) {
    if (!isNullOrPositiveInt(estimated_calories))
      return res.status(400).json({ message: "Invalid calories." });
    fieldsToUpdate.estimated_calories =
      estimated_calories === "" ? null : Number(estimated_calories);
  }
  if (estimated_protein !== undefined) {
    if (!isNullOrPositiveInt(estimated_protein))
      return res.status(400).json({ message: "Invalid protein." });
    fieldsToUpdate.estimated_protein =
      estimated_protein === "" ? null : Number(estimated_protein);
  }
  // Add similar checks/assignments for carbs and fat...
  if (estimated_carbs !== undefined) {
    /* ... check and assign ... */ fieldsToUpdate.estimated_carbs =
      estimated_carbs === "" ? null : Number(estimated_carbs);
  }
  if (estimated_fat !== undefined) {
    /* ... check and assign ... */ fieldsToUpdate.estimated_fat =
      estimated_fat === "" ? null : Number(estimated_fat);
  }

  // Check if any valid fields were provided for update
  const fieldKeys = Object.keys(fieldsToUpdate);
  if (fieldKeys.length === 0) {
    return res
      .status(400)
      .json({ message: "No valid fields provided for update." });
  }

  // Construct the SET part of the SQL query
  fieldsToUpdate.updated_at = "NOW()"; // Always update timestamp
  const setClauses = fieldKeys
    .map((key, index) => `"${key}" = $${index + 1}`)
    .join(", ");
  const queryValues = Object.values(fieldsToUpdate);

  // Add logId and userId to the end of the values array for the WHERE clause
  queryValues.push(logIdInt); // This will be placeholder $(fieldKeys.length + 1)
  queryValues.push(userId); // This will be placeholder $(fieldKeys.length + 2)

  try {
    const query = `
          UPDATE diet_logs
          SET ${setClauses}
          WHERE log_id = $${fieldKeys.length + 1} AND user_id = $${
      fieldKeys.length + 2
    }
          RETURNING *; -- Return the updated entry
      `;

    const { rows, rowCount } = await db.query(query, queryValues);

    if (rowCount === 0) {
      // Check if the log exists but belongs to another user or doesn't exist
      const checkQuery = "SELECT user_id FROM diet_logs WHERE log_id = $1";
      const checkResult = await db.query(checkQuery, [logIdInt]);
      if (checkResult.rowCount === 0) {
        console.warn(`[Diet PUT] Log ID ${logIdInt} not found.`);
        return res.status(404).json({ message: "Diet log entry not found." });
      } else {
        console.warn(
          `[Diet PUT] User ${userId} attempted to update log ${logIdInt} owned by user ${checkResult.rows[0].user_id}.`
        );
        return res.status(403).json({
          message: "You do not have permission to update this entry.",
        });
      }
    }

    console.log(
      `[Diet PUT] Successfully updated log ID: ${logIdInt} for User: ${userId}`
    );
    res.status(200).json(rows[0]); // Return the updated log entry
  } catch (error) {
    console.error(
      `[Diet PUT] Error updating log ${logIdInt} for User: ${userId}:`,
      error
    );
    if (error.code === "23514") {
      return res
        .status(400)
        .json({ message: "Estimated values DB check failed (must be >= 0)." });
    }
    res.status(500).json({
      message: "Failed to update diet log entry.",
      error: error.message,
    });
  }
});

// DELETE a specific Diet Log Entry by its ID
// Example: DELETE /api/diet/123
app.delete("/api/diet/:logId", simpleAuthMiddleware, async (req, res) => {
  const userId = req.userId;
  const { logId } = req.params;
  const logIdInt = parseInt(logId, 10);

  console.log(`DELETE /api/diet/${logId} - User: ${userId}`);

  if (isNaN(logIdInt)) {
    return res.status(400).json({ message: "Invalid Log ID format." });
  }

  try {
    const query = `
          DELETE FROM diet_logs
          WHERE log_id = $1 AND user_id = $2
          RETURNING log_id; -- Return ID to confirm deletion
      `;
    const { rowCount } = await db.query(query, [logIdInt, userId]);

    if (rowCount > 0) {
      console.log(
        `[Diet DELETE] Successfully deleted log ID: ${logIdInt} for User: ${userId}`
      );
      res.status(200).json({ message: "Diet log entry deleted successfully." });
    } else {
      // Check if the log exists but belongs to another user or doesn't exist
      const checkQuery = "SELECT user_id FROM diet_logs WHERE log_id = $1";
      const checkResult = await db.query(checkQuery, [logIdInt]);
      if (checkResult.rowCount === 0) {
        console.warn(`[Diet DELETE] Log ID ${logIdInt} not found.`);
        return res.status(404).json({ message: "Diet log entry not found." });
      } else {
        console.warn(
          `[Diet DELETE] User ${userId} attempted to delete log ${logIdInt} owned by user ${checkResult.rows[0].user_id}.`
        );
        return res.status(403).json({
          message: "You do not have permission to delete this entry.",
        });
      }
    }
  } catch (error) {
    console.error(
      `[Diet DELETE] Error deleting log ${logIdInt} for User: ${userId}:`,
      error
    );
    res.status(500).json({
      message: "Failed to delete diet log entry.",
      error: error.message,
    });
  }
});

app.get("/api/goals", simpleAuthMiddleware, async (req, res) => {
  const userId = req.userId;
  const { status } = req.query; // Optional status filter (e.g., 'active')

  console.log(`GET /api/goals - User: ${userId}, Status Filter: ${status}`);

  let query = `
      SELECT goal_id, type, target_value, start_date, end_date, status, name, created_at
      FROM goals
      WHERE user_id = $1
  `;
  const queryParams = [userId];

  if (status && ["active", "completed", "abandoned"].includes(status)) {
    query += ` AND status = $2`;
    queryParams.push(status);
  } else if (status) {
    return res.status(400).json({
      message:
        "Invalid status filter. Use 'active', 'completed', or 'abandoned'.",
    });
  }

  query += ` ORDER BY end_date DESC, start_date DESC;`; // Show goals ending soonest first

  try {
    const { rows: goals } = await db.query(query, queryParams);

    // --- Calculate Progress for Active Goals ---
    const goalsWithProgress = [];
    const now = new Date(); // Use server time for consistency

    for (const goal of goals) {
      let currentProgress = null;
      let progressQuery = "";
      let progressParams = [userId, goal.start_date, goal.end_date];

      // Only calculate for active goals that haven't ended yet
      // Add a buffer (e.g., one day) to include runs on the end date itself
      const goalEndDate = new Date(goal.end_date);
      goalEndDate.setDate(goalEndDate.getDate() + 1); // Make end date inclusive

      if (goal.status === "active" && goalEndDate >= now) {
        console.log(
          `[Goals GET] Calculating progress for active goal ${goal.goal_id} (Ends: ${goal.end_date})`
        );
        switch (goal.type) {
          case "weekly_distance":
          case "monthly_distance":
            progressQuery = `
                          SELECT COALESCE(SUM(distance), 0) as current_value
                          FROM activities
                          WHERE user_id = $1 AND type = 'Run' AND start_date_local BETWEEN $2 AND $3;
                      `;
            break;
          case "weekly_runs":
          case "monthly_runs":
            progressQuery = `
                          SELECT COUNT(activity_id) as current_value
                          FROM activities
                          WHERE user_id = $1 AND type = 'Run' AND start_date_local BETWEEN $2 AND $3;
                       `;
            break;
          // Add cases for other goal types later
        }

        if (progressQuery) {
          try {
            const progressResult = await db.query(
              progressQuery,
              progressParams
            );
            currentProgress = parseFloat(
              progressResult.rows[0]?.current_value || 0
            );
            // Convert distance progress to km if goal is distance based
            if (goal.type.includes("distance")) {
              currentProgress /= 1000; // Convert meters to km
            }
            console.log(
              `[Goals GET] Goal ${goal.goal_id} progress: ${currentProgress}`
            );
          } catch (progressError) {
            console.error(
              `[Goals GET] Error calculating progress for goal ${goal.goal_id}:`,
              progressError
            );
            // Proceed without progress if calculation fails
          }
        }
      }

      goalsWithProgress.push({
        ...goal,
        // Format dates for frontend consistency if needed
        start_date: goal.start_date.toISOString().split("T")[0],
        end_date: goal.end_date.toISOString().split("T")[0],
        current_progress: currentProgress, // Will be null if not calculated
        // Calculate percentage (handle division by zero)
        progress_percent:
          goal.target_value > 0 && currentProgress !== null
            ? Math.min(
                100,
                Math.round((currentProgress / goal.target_value) * 100)
              )
            : 0,
      });
    }
    // --- End Progress Calculation ---

    console.log(
      `[Goals GET] Found ${goalsWithProgress.length} goals for User: ${userId}`
    );
    res.status(200).json(goalsWithProgress); // Return goals, potentially with progress
  } catch (error) {
    console.error(
      `[Goals GET] Error fetching goals for User: ${userId}:`,
      error
    );
    res
      .status(500)
      .json({ message: "Failed to fetch goals.", error: error.message });
  }
});

// POST (Create) a new Goal
app.post("/api/goals", simpleAuthMiddleware, async (req, res) => {
  const userId = req.userId;
  const { type, target_value, start_date, end_date, name } = req.body;

  console.log(`POST /api/goals - User: ${userId}, Type: ${type}`);

  // Basic Validation
  if (
    !type ||
    ![
      "weekly_distance",
      "weekly_runs",
      "monthly_distance",
      "monthly_runs",
    ].includes(type)
  ) {
    return res.status(400).json({ message: "Invalid or missing goal type." });
  }
  const target = parseFloat(target_value);
  if (isNaN(target) || target <= 0) {
    return res
      .status(400)
      .json({ message: "Invalid or missing target value (must be > 0)." });
  }
  if (
    !start_date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(start_date) ||
    !end_date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end_date)
  ) {
    return res
      .status(400)
      .json({ message: "Invalid or missing dates (YYYY-MM-DD)." });
  }
  if (new Date(end_date) < new Date(start_date)) {
    return res
      .status(400)
      .json({ message: "End date cannot be before start date." });
  }

  try {
    const query = `
          INSERT INTO goals (user_id, type, target_value, start_date, end_date, name, status)
          VALUES ($1, $2, $3, $4, $5, $6, 'active') -- Default status to active
          RETURNING *; -- Return the full created goal
      `;
    const values = [userId, type, target, start_date, end_date, name || null]; // Allow optional name

    const { rows } = await db.query(query, values);

    console.log(
      `[Goals POST] Successfully created goal ID: ${rows[0].goal_id} for User: ${userId}`
    );
    // Format dates before sending back
    const createdGoal = {
      ...rows[0],
      start_date: rows[0].start_date.toISOString().split("T")[0],
      end_date: rows[0].end_date.toISOString().split("T")[0],
    };
    res.status(201).json(createdGoal);
  } catch (error) {
    console.error(
      `[Goals POST] Error creating goal for User: ${userId}:`,
      error
    );
    // Check specific errors like CHECK constraint violation (e.g., target_value <= 0)
    if (error.code === "23514") {
      return res.status(400).json({
        message:
          "Database validation failed (e.g., target > 0, end_date >= start_date).",
      });
    }
    res
      .status(500)
      .json({ message: "Failed to create goal.", error: error.message });
  }
});

// PUT (Update) an existing Goal (e.g., change status)
// Example: PUT /api/goals/45/status Body: { "status": "completed" }
app.put("/api/goals/:goalId/status", simpleAuthMiddleware, async (req, res) => {
  const userId = req.userId;
  const { goalId } = req.params;
  const { status } = req.body; // Expecting { "status": "..." } in body
  const goalIdInt = parseInt(goalId, 10);

  console.log(
    `PUT /api/goals/${goalId}/status - User: ${userId}, New Status: ${status}`
  );

  if (isNaN(goalIdInt)) {
    return res.status(400).json({ message: "Invalid Goal ID." });
  }
  // Validate the new status
  if (!status || !["active", "completed", "abandoned"].includes(status)) {
    return res.status(400).json({
      message:
        "Invalid status value provided. Use 'active', 'completed', or 'abandoned'.",
    });
  }

  try {
    const query = `
           UPDATE goals
           SET status = $1, updated_at = NOW()
           WHERE goal_id = $2 AND user_id = $3
           RETURNING *;
       `;
    const { rows, rowCount } = await db.query(query, [
      status,
      goalIdInt,
      userId,
    ]);

    if (rowCount === 0) {
      // Check if goal exists but doesn't belong to user
      const check = await db.query("SELECT 1 FROM goals WHERE goal_id=$1", [
        goalIdInt,
      ]);
      return res.status(check.rowCount === 0 ? 404 : 403).json({
        message:
          check.rowCount === 0 ? "Goal not found." : "Permission denied.",
      });
    }

    console.log(
      `[Goals PUT Status] Updated status for Goal ID: ${goalIdInt}, User: ${userId}`
    );
    const updatedGoal = {
      // Format dates before sending back
      ...rows[0],
      start_date: rows[0].start_date.toISOString().split("T")[0],
      end_date: rows[0].end_date.toISOString().split("T")[0],
    };
    res.status(200).json(updatedGoal);
  } catch (error) {
    console.error(
      `[Goals PUT Status] Error updating Goal ID: ${goalIdInt}, User: ${userId}:`,
      error
    );
    res
      .status(500)
      .json({ message: "Failed to update goal status.", error: error.message });
  }
});

// DELETE a Goal
// Example: DELETE /api/goals/45
app.delete("/api/goals/:goalId", simpleAuthMiddleware, async (req, res) => {
  const userId = req.userId;
  const { goalId } = req.params;
  const goalIdInt = parseInt(goalId, 10);

  console.log(`DELETE /api/goals/${goalId} - User: ${userId}`);

  if (isNaN(goalIdInt)) {
    return res.status(400).json({ message: "Invalid Goal ID." });
  }

  try {
    const query = `DELETE FROM goals WHERE goal_id = $1 AND user_id = $2 RETURNING goal_id;`;
    const { rowCount } = await db.query(query, [goalIdInt, userId]);

    if (rowCount === 0) {
      // Check if goal exists but doesn't belong to user
      const check = await db.query("SELECT 1 FROM goals WHERE goal_id=$1", [
        goalIdInt,
      ]);
      return res.status(check.rowCount === 0 ? 404 : 403).json({
        message:
          check.rowCount === 0 ? "Goal not found." : "Permission denied.",
      });
    }

    console.log(
      `[Goals DELETE] Deleted Goal ID: ${goalIdInt} for User: ${userId}`
    );
    res.status(200).json({ message: "Goal deleted successfully." });
  } catch (error) {
    console.error(
      `[Goals DELETE] Error deleting Goal ID: ${goalIdInt}, User: ${userId}:`,
      error
    );
    res
      .status(500)
      .json({ message: "Failed to delete goal.", error: error.message });
  }
});

// Strava Token Exchange Route
app.post("/strava/token", async (req, res) => {
  /* ... same as previous version ... */
  const { code } = req.body;
  console.log("POST /strava/token route hit");
  if (!code) {
    console.log("[Token] Auth code missing");
    return res.status(400).json({ message: "Auth code missing" });
  }
  const stravaClientId = process.env.STRAVA_CLIENT_ID,
    stravaClientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!stravaClientId || !stravaClientSecret) {
    console.error("[Token] Strava config missing");
    return res.status(500).json({ message: "Server config error." });
  }
  const tokenUrl = "https://www.strava.com/oauth/token",
    tokenParams = {
      client_id: stravaClientId,
      client_secret: stravaClientSecret,
      code: code,
      grant_type: "authorization_code",
    };
  let client;
  try {
    const response = await axios.post(tokenUrl, null, { params: tokenParams });
    const { access_token, refresh_token, expires_at, athlete } = response.data;
    console.log("[Token] Tokens received. Athlete ID:", athlete.id);
    client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      const findUserQuery = "SELECT user_id FROM users WHERE strava_id = $1";
      const { rows } = await client.query(findUserQuery, [athlete.id]);
      let userRecord;
      if (rows.length > 0) {
        // Update
        const updateUserQuery = `UPDATE users SET strava_access_token=$1, strava_refresh_token=$2, strava_token_expires_at=$3, first_name=$4, last_name=$5, username=$6, profile_picture_url=$7, city=$8, state=$9, country=$10, updated_at=NOW() WHERE strava_id=$11 RETURNING *;`;
        const updateValues = [
          access_token,
          refresh_token,
          expires_at,
          athlete.firstname,
          athlete.lastname,
          athlete.username,
          athlete.profile,
          athlete.city,
          athlete.state,
          athlete.country,
          athlete.id,
        ];
        userRecord = (await client.query(updateUserQuery, updateValues))
          .rows[0];
      } else {
        // Insert
        const insertUserQuery = `INSERT INTO users (strava_id, first_name, last_name, username, profile_picture_url, city, state, country, strava_access_token, strava_refresh_token, strava_token_expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *;`;
        const insertValues = [
          athlete.id,
          athlete.firstname,
          athlete.lastname,
          athlete.username,
          athlete.profile,
          athlete.city,
          athlete.state,
          athlete.country,
          access_token,
          refresh_token,
          expires_at,
        ];
        userRecord = (await client.query(insertUserQuery, insertValues))
          .rows[0];
      }
      await client.query("COMMIT");
      console.log("[Token] DB Commit OK. User ID:", userRecord.user_id);
      res.json({
        message: "Success",
        athlete: {
          id: userRecord.strava_id,
          appUserId: userRecord.user_id,
          username: userRecord.username,
          firstname: userRecord.first_name,
          lastname: userRecord.last_name,
          city: userRecord.city,
          state: userRecord.state,
          country: userRecord.country,
          profile: userRecord.profile_picture_url,
        },
      });
    } catch (dbError) {
      await client.query("ROLLBACK");
      throw dbError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[Token] Error:", error.message);
    if (client) client.release();
    res.status(500).json({ message: "Failed.", error_details: error.message });
  }
});

// Sync activities from Strava
app.post("/api/strava/sync", simpleAuthMiddleware, async (req, res) => {
  /* ... same as previous version ... */
  const userId = req.userId;
  console.log(`POST /api/strava/sync - User: ${userId}`);
  let client;
  try {
    client = await db.pool.connect();
    const userQuery = `SELECT user_id, strava_access_token, strava_refresh_token, strava_token_expires_at FROM users WHERE user_id = $1;`;
    const userResult = await client.query(userQuery, [userId]);
    if (userResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ message: "User not found." });
    }
    let { strava_access_token, strava_refresh_token, strava_token_expires_at } =
      userResult.rows[0];
    if (!strava_access_token || !strava_refresh_token) {
      client.release();
      return res.status(401).json({ message: "User not fully authenticated." });
    }
    const nowSeconds = Math.floor(Date.now() / 1000),
      bufferSeconds = 300;
    if (strava_token_expires_at <= nowSeconds + bufferSeconds) {
      try {
        strava_access_token = await refreshStravaToken(userId);
      } catch (refreshError) {
        client.release();
        return res.status(401).json({
          message: "Failed to refresh token.",
          error: refreshError.message,
        });
      }
    }
    const stravaApiUrl = "https://www.strava.com/api/v3/athlete/activities";
    const stravaResponse = await axios.get(stravaApiUrl, {
      headers: { Authorization: `Bearer ${strava_access_token}` },
      params: { page: 1, per_page: 50 },
    });
    const activities = stravaResponse.data || [];
    if (activities.length === 0) {
      client.release();
      return res
        .status(200)
        .json({ message: "No new activities on Strava.", activitiesStored: 0 });
    }
    let count = 0;
    try {
      await client.query("BEGIN");
      for (const act of activities) {
        const query = `INSERT INTO activities (user_id, strava_activity_id, name, distance, moving_time, elapsed_time, total_elevation_gain, type, start_date, start_date_local, timezone, average_speed, max_speed, average_heartrate, max_heartrate) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (strava_activity_id) DO UPDATE SET name=EXCLUDED.name, distance=EXCLUDED.distance, moving_time=EXCLUDED.moving_time, elapsed_time=EXCLUDED.elapsed_time, total_elevation_gain=EXCLUDED.total_elevation_gain, type=EXCLUDED.type, start_date=EXCLUDED.start_date, start_date_local=EXCLUDED.start_date_local, timezone=EXCLUDED.timezone, average_speed=EXCLUDED.average_speed, max_speed=EXCLUDED.max_speed, average_heartrate=EXCLUDED.average_heartrate, max_heartrate=EXCLUDED.max_heartrate, updated_at=NOW();`;
        const values = [
          userId,
          act.id,
          act.name || "Unnamed",
          act.distance,
          act.moving_time,
          act.elapsed_time,
          act.total_elevation_gain,
          act.type,
          act.start_date,
          act.start_date_local,
          act.timezone,
          act.average_speed,
          act.max_speed,
          act.average_heartrate,
          act.max_heartrate,
        ];
        if ((await client.query(query, values)).rowCount > 0) count++;
      }
      await client.query("COMMIT");
      console.log(
        `[Sync] DB Commit OK for user ${userId}. Processed: ${count}`
      );
      res.status(200).json({
        message: `Synced ${count} activities.`,
        activitiesStored: count,
      });
    } catch (dbError) {
      await client.query("ROLLBACK");
      throw dbError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`[Sync] Error for user ${userId}:`, error.message);
    if (client) client.release();
    res.status(500).json({ message: "Failed sync.", error: error.message });
  }
});

// GET stored activities from our database
app.get("/api/activities", simpleAuthMiddleware, async (req, res) => {
  const userId = req.userId;
  console.log(`GET /api/activities - User: ${userId}`);
  try {
    const query = `SELECT activity_id, strava_activity_id, name, distance, moving_time, elapsed_time, total_elevation_gain, type, start_date_local, timezone, average_speed, max_speed, average_heartrate, max_heartrate, mental_mood, mental_focus, mental_stress, mental_notes FROM activities WHERE user_id = $1 ORDER BY start_date_local DESC;`;
    const { rows } = await db.query(query, [userId]);
    const activitiesFormatted = rows.map((act) => ({
      ...act,
      distance_km: act.distance ? (act.distance / 1000).toFixed(2) : "0.00",
      moving_time_formatted: act.moving_time
        ? new Date(act.moving_time * 1000).toISOString().slice(11, 19)
        : "00:00:00",
      pace_per_km: calculatePaceMinPerKm(act.distance, act.moving_time),
      mental_mood: act.mental_mood ?? null,
      mental_focus: act.mental_focus ?? null,
      mental_stress: act.mental_stress ?? null,
      mental_notes: act.mental_notes ?? null,
    }));
    res.status(200).json(activitiesFormatted);
  } catch (error) {
    console.error(`[Activities GET] Error user ${userId}:`, error);
    res.status(500).json({ message: "Failed fetch.", error: error.message });
  }
});

// POST mental state for a specific activity
app.post(
  "/api/activities/:activityId/mental_state",
  simpleAuthMiddleware,
  async (req, res) => {
    const userId = req.userId;
    const { activityId } = req.params;
    const { mood, focus, stress, notes } = req.body;
    console.log(
      `POST /api/activities/${activityId}/mental_state - User: ${userId}, Data:`,
      req.body
    );
    const activityIdInt = parseInt(activityId, 10);
    if (isNaN(activityIdInt))
      return res.status(400).json({ message: "Invalid Activity ID." });
    const isValidScale = (v) =>
      v === null ||
      v === undefined ||
      (Number.isInteger(v) && v >= 1 && v <= 5);
    if (!isValidScale(mood) || !isValidScale(focus) || !isValidScale(stress))
      return res
        .status(400)
        .json({ message: "Invalid scale value (1-5 or null)." });
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
        return res.status(check.rowCount === 0 ? 404 : 403).json({
          message:
            check.rowCount === 0 ? "Activity not found." : "Permission denied.",
        });
      }
      console.log(
        `[Mental State] Updated OK for Activity: ${activityIdInt}, User: ${userId}`
      );
      res.status(200).json({ message: "Updated.", updatedState: rows[0] });
    } catch (error) {
      console.error(
        `[Mental State] Error user ${userId}, activity ${activityIdInt}:`,
        error
      );
      res.status(500).json({ message: "Failed update.", error: error.message });
    }
  }
);

// GET calculated insights
// Route to GET calculated insights based on recent activities, diary, diet
// backend/server.js
// ... (Existing requires, helpers, middleware, other routes) ...

// Route to GET calculated insights based on recent activities, diary, diet
app.get("/api/insights", simpleAuthMiddleware, async (req, res) => {
  const userId = req.userId;
  const numberOfRunsToAnalyze = 10;
  console.log(
    `GET /api/insights - User: ${userId}, analyzing last ${numberOfRunsToAnalyze} runs.`
  );

  let client;
  try {
    client = await db.pool.connect();
    console.log("[Insights] DB Client connected.");

    // 1. Fetch recent runs
    const recentRunsQuery = `SELECT activity_id, distance, moving_time, average_heartrate, start_date_local, mental_mood, mental_focus, mental_stress FROM activities WHERE user_id = $1 AND type = 'Run' ORDER BY start_date_local DESC LIMIT $2;`;
    const { rows: recentRuns } = await client.query(recentRunsQuery, [
      userId,
      numberOfRunsToAnalyze,
    ]);
    console.log(`[Insights] Fetched ${recentRuns.length} recent runs.`);
    if (recentRuns.length < 2) {
      client.release();
      return res
        .status(200)
        .json({ insights: ["Log more runs (at least 2) for trends!"] });
    }

    // Date range
    const oldestRunDate = recentRuns[recentRuns.length - 1].start_date_local
      .toISOString()
      .split("T")[0];
    const latestRunDate = recentRuns[0].start_date_local
      .toISOString()
      .split("T")[0];
    console.log(`[Insights] Date range: ${oldestRunDate} to ${latestRunDate}`);

    // 2. Fetch Diary Entries
    const diaryQuery = `SELECT entry_date, notes FROM diary_entries WHERE user_id = $1 AND entry_date BETWEEN $2 AND $3;`;
    const { rows: diaryEntries } = await client.query(diaryQuery, [
      userId,
      oldestRunDate,
      latestRunDate,
    ]);
    const diaryMap = new Map(
      diaryEntries.map((entry) => [
        entry.entry_date.toISOString().split("T")[0],
        entry.notes,
      ])
    );
    console.log(`[Insights] Found ${diaryMap.size} diary entries.`);

    // 3. Fetch Diet Logs (Aggregated Calories)
    const dietQuery = `SELECT log_date, SUM(estimated_calories) as total_calories FROM diet_logs WHERE user_id = $1 AND log_date BETWEEN $2 AND $3 GROUP BY log_date;`;
    const { rows: dietLogs } = await client.query(dietQuery, [
      userId,
      oldestRunDate,
      latestRunDate,
    ]);
    const dietMap = new Map(
      dietLogs.map((log) => [
        log.log_date.toISOString().split("T")[0],
        parseInt(log.total_calories || 0, 10),
      ])
    );
    console.log(`[Insights] Found ${dietMap.size} diet log days.`);

    // --- Analysis Logic ---
    console.log("[Insights Analysis] Starting analysis block...");
    const insights = []; // Initialize empty array for insights
    const lastRun = recentRuns[0];
    const previousRuns = recentRuns.slice(1);
    console.log(
      "[Insights Analysis] lastRun ID:",
      lastRun?.activity_id,
      "previousRuns count:",
      previousRuns.length
    );

    // --- Averages Calculation ---
    console.log("[Insights Analysis] Calculating averages...");
    const avgPrevious = previousRuns.reduce(
      (acc, run, index) => {
        console.log(
          `[Insights Reduce ${index}] Processing Run ID: ${run?.activity_id}`
        ); // Log processing
        acc.distance += run?.distance || 0;
        acc.moving_time += run?.moving_time || 0;
        acc.heartrate += run?.average_heartrate || 0;
        acc.count++;
        const pace = calculatePaceMinPerKm(run?.distance, run?.moving_time);
        if (pace) {
          try {
            const ps =
              parseInt(pace.split(/[:\s/]/)[0]) * 60 +
              parseInt(pace.split(/[:\s/]/)[1]);
            if (!isNaN(ps)) {
              acc.totalPaceSeconds += ps;
              acc.paceCount++;
            }
          } catch (e) {
            console.error(`[Insights Reduce ${index}] Pace calc error:`, e);
          }
        }
        return acc;
      },
      {
        distance: 0,
        moving_time: 0,
        heartrate: 0,
        count: 0,
        totalPaceSeconds: 0,
        paceCount: 0,
      }
    );
    console.log("[Insights Analysis] Averages calculated raw:", avgPrevious);

    const avgDistance = avgPrevious.count
      ? avgPrevious.distance / avgPrevious.count
      : 0;
    const avgHeartrate = avgPrevious.count
      ? avgPrevious.heartrate / avgPrevious.count
      : 0;
    const avgPaceSeconds = avgPrevious.paceCount
      ? avgPrevious.totalPaceSeconds / avgPrevious.paceCount
      : 0;
    let avgPaceFormatted = null;
    if (avgPaceSeconds > 0) {
      const m = Math.floor(avgPaceSeconds / 60),
        s = Math.round(avgPaceSeconds % 60);
      avgPaceFormatted = `${m}:${s < 10 ? "0" + s : s} /km`;
    }
    console.log(
      `[Insights Analysis] Avg Values: Dist=${avgDistance.toFixed(
        0
      )}m, HR=${avgHeartrate.toFixed(1)}, PaceSec=${avgPaceSeconds.toFixed(
        1
      )}s/km (${avgPaceFormatted})`
    );

    // --- Generate Insight Strings ---
    console.log("[Insights Analysis] Calculating last run details...");
    const lastRunPace = calculatePaceMinPerKm(
      lastRun.distance,
      lastRun.moving_time
    );
    let lastRunPaceSeconds = null;
    if (lastRunPace) {
      try {
        lastRunPaceSeconds =
          parseInt(lastRunPace.split(/[:\s/]/)[0]) * 60 +
          parseInt(lastRunPace.split(/[:\s/]/)[1]);
        if (isNaN(lastRunPaceSeconds)) lastRunPaceSeconds = null;
      } catch {
        lastRunPaceSeconds = null;
      }
    }
    let lastRunDateStr = "N/A";
    try {
      lastRunDateStr = lastRun.start_date_local.toISOString().split("T")[0];
    } catch (e) {
      console.error(
        "[Insights Analysis] Error getting last run date string:",
        e
      );
    }
    console.log(
      `[Insights Analysis] Last Run (${lastRunDateStr}): Pace=${lastRunPace} (${lastRunPaceSeconds}s/km), Mood=${lastRun.mental_mood}`
    );

    // --- Start Insight Checks ---

    // a) Pace Trend Check
    console.log("[Insights Check] Starting Pace Trend...");
    if (
      lastRunPace &&
      avgPaceFormatted &&
      lastRunPaceSeconds !== null &&
      avgPaceSeconds > 0
    ) {
      // Check lastRunPaceSeconds !== null
      const paceDiff = lastRunPaceSeconds - avgPaceSeconds;
      const paceDiffThreshold = 10; // +/- 10 seconds
      console.log(
        `[Insights Check - Pace] Diff: ${paceDiff.toFixed(
          1
        )}s (Threshold: ${paceDiffThreshold}s)`
      );
      if (paceDiff < -paceDiffThreshold) {
        insights.push(
          `🚀 Pace Trend: Your last run (${lastRunPace}) was significantly faster than your recent average (${avgPaceFormatted}).`
        );
        console.log("[Insights Check - Pace] Faster insight ADDED.");
      } else if (paceDiff > paceDiffThreshold) {
        insights.push(
          `📉 Pace Trend: Your last run (${lastRunPace}) was slower than your recent average (${avgPaceFormatted}). Consider factors like terrain, effort, or recovery.`
        );
        console.log("[Insights Check - Pace] Slower insight ADDED.");
      } else {
        console.log(
          "[Insights Check - Pace] Pace difference within threshold."
        );
      }
    } else {
      console.log(
        `[Insights Check - Pace] Skipping: Insufficient pace data (Last: ${lastRunPace}, Avg: ${avgPaceFormatted}, LastSec: ${lastRunPaceSeconds}, AvgSec: ${avgPaceSeconds})`
      );
    }
    console.log("[Insights Check] Finished Pace Trend.");

    // b) Distance Trend Check
    console.log("[Insights Check] Starting Distance Trend...");
    if (lastRun.distance && avgDistance > 0) {
      const distDiffPercent =
        ((lastRun.distance - avgDistance) / avgDistance) * 100;
      const distThresholdPercent = 25; // +/- 25%
      console.log(
        `[Insights Check - Distance] Diff: ${distDiffPercent.toFixed(
          1
        )}% (Threshold: ${distThresholdPercent}%)`
      );
      if (distDiffPercent > distThresholdPercent) {
        insights.push(
          `🏃 Distance Trend: Ran significantly farther (${(
            lastRun.distance / 1000
          ).toFixed(1)} km) than average (${(avgDistance / 1000).toFixed(
            1
          )} km).`
        );
        console.log("[Insights Check - Distance] Longer insight ADDED.");
      } else if (distDiffPercent < -distThresholdPercent) {
        insights.push(
          ` Short distance (${(lastRun.distance / 1000).toFixed(
            1
          )} km) compared to average (${(avgDistance / 1000).toFixed(1)} km).`
        );
        console.log("[Insights Check - Distance] Shorter insight ADDED.");
      } else {
        console.log(
          "[Insights Check - Distance] Distance difference within threshold."
        );
      }
    } else {
      console.log(
        `[Insights Check - Distance] Skipping: Insufficient distance data (Last: ${lastRun.distance}, Avg: ${avgDistance})`
      );
    }
    console.log("[Insights Check] Finished Distance Trend.");

    // c) Recovery Suggestion Check
    console.log("[Insights Check] Starting Recovery Suggestion...");
    const longRunThresholdFactor = 1.3; // >30% longer
    const highHRThresholdFactor = 1.05; // >5% higher HR
    // Ensure avgDistance and avgHeartrate are numbers > 0 for meaningful comparison
    const isLongRun =
      avgDistance > 0 &&
      lastRun.distance > avgDistance * longRunThresholdFactor;
    const isHighHeartRate =
      lastRun.average_heartrate &&
      avgHeartrate > 0 &&
      lastRun.average_heartrate > avgHeartrate * highHRThresholdFactor;
    console.log(
      `[Insights Check - Recovery] IsLong: ${isLongRun} (Dist=${lastRun.distance?.toFixed(
        0
      )}, Avg=${avgDistance?.toFixed(
        0
      )}*${longRunThresholdFactor}), IsHighHR: ${isHighHeartRate} (HR=${lastRun.average_heartrate?.toFixed(
        1
      )}, Avg=${avgHeartrate?.toFixed(1)}*${highHRThresholdFactor})`
    );
    if (isLongRun && isHighHeartRate) {
      insights.push(
        `🥵 Recovery: High effort & long distance run detected. Prioritize recovery (rest/sleep/nutrition).`
      );
      console.log(
        "[Insights Check - Recovery] High effort/long insight ADDED."
      );
    } else if (isLongRun) {
      insights.push(`👍 Recovery: Long run logged. Ensure adequate recovery.`);
      console.log("[Insights Check - Recovery] Long run insight ADDED.");
    } else if (isHighHeartRate) {
      insights.push(
        `💓 Recovery: Heart rate was higher than usual. Listen to your body before the next hard session.`
      );
      console.log("[Insights Check - Recovery] High HR insight ADDED.");
    } else {
      console.log(
        "[Insights Check - Recovery] No specific recovery suggestion triggered."
      );
    }
    console.log("[Insights Check] Finished Recovery Suggestion.");

    // e) Diet Correlation Check
    console.log("[Insights Check] Starting Diet Correlation...");
    const caloriesOnRunDay = dietMap.get(lastRunDateStr);
    const typicalAvgCalories = 2500; // Example baseline
    console.log(
      `[Insights Check - Diet] CalsToday=${caloriesOnRunDay}, LastRunPaceSec=${lastRunPaceSeconds}, AvgPaceSec=${avgPaceSeconds}`
    );
    if (
      caloriesOnRunDay !== undefined &&
      lastRunPaceSeconds !== null &&
      avgPaceSeconds > 0
    ) {
      const highCalThreshold = typicalAvgCalories * 1.1;
      const lowCalThreshold = typicalAvgCalories * 0.8;
      const fasterPaceThreshold = avgPaceSeconds * 0.98; // 2% faster
      const slowerPaceThreshold = avgPaceSeconds * 1.02; // 2% slower
      console.log(
        `[Insights Check - Diet] Thresholds: HighCal=${highCalThreshold.toFixed(
          0
        )}, LowCal=${lowCalThreshold.toFixed(
          0
        )}, FasterPace=${fasterPaceThreshold.toFixed(
          1
        )}, SlowerPace=${slowerPaceThreshold.toFixed(1)}`
      );
      if (
        caloriesOnRunDay > highCalThreshold &&
        lastRunPaceSeconds < fasterPaceThreshold
      ) {
        insights.push(
          `⚡️ Fuel Factor: You logged higher calories (~${caloriesOnRunDay} kcal) on your last run day, and your pace was faster than average!`
        );
        console.log("[Insights Check - Diet] High cal/faster insight ADDED.");
      } else if (
        caloriesOnRunDay < lowCalThreshold &&
        lastRunPaceSeconds > slowerPaceThreshold
      ) {
        insights.push(
          `⛽ Fuel Factor: Your pace was slower than average on your last run, and you logged lower calories (~${caloriesOnRunDay} kcal) that day. Ensure adequate fueling!`
        );
        console.log("[Insights Check - Diet] Low cal/slower insight ADDED.");
      } else {
        console.log(
          "[Insights Check - Diet] Conditions for specific calorie/pace correlation not met."
        );
      }
    } else if (caloriesOnRunDay !== undefined) {
      insights.push(
        `🍽️ Diet Logged: ~${caloriesOnRunDay} kcal logged on run day. Keep logging consistently to see performance correlations.`
      ); // More specific generic message
      console.log(
        "[Insights Check - Diet] Generic 'diet logged' insight ADDED."
      );
    } else {
      console.log(
        "[Insights Check - Diet] Skipping: No calorie data found for last run date."
      );
    }
    console.log("[Insights Check] Finished Diet Correlation.");

    // f) Diary Correlation Check
    console.log("[Insights Check] Starting Diary Correlation...");
    const diaryNotesOnRunDay = diaryMap.get(lastRunDateStr);
    // Use Optional Chaining for safer access to lastRun.mental_mood
    const lastRunMood = lastRun?.mental_mood ?? null;
    console.log(
      `[Insights Check - Diary] Notes found: ${!!diaryNotesOnRunDay}, LastRunMood: ${lastRunMood}`
    );
    if (diaryNotesOnRunDay) {
      const lowerCaseNotes = diaryNotesOnRunDay.toLowerCase();
      let diaryInsightAdded = false;
      const positiveRegex =
        /\b(great|good|strong|energized|awesome|easy|felt good)\b/; // Added 'felt good'
      const negativeRegex = /\b(tired|sore|struggled|tough|heavy|bad|rough)\b/; // Added 'rough'
      const moodThresholdHigh = 4;
      const moodThresholdLow = 2;
      console.log(
        `[Insights Check - Diary] Positive keywords test: ${positiveRegex.test(
          lowerCaseNotes
        )}, Negative keywords test: ${negativeRegex.test(lowerCaseNotes)}`
      );

      // Check requires notes AND mood to be logged
      if (lastRunMood !== null) {
        if (
          positiveRegex.test(lowerCaseNotes) &&
          lastRunMood >= moodThresholdHigh
        ) {
          insights.push(
            `😊 Mind Notes: Your diary notes & logged mood (${lastRunMood}/5) suggest you felt positive on your last run day!`
          );
          diaryInsightAdded = true;
          console.log(
            "[Insights Check - Diary] Positive correlation insight ADDED."
          );
        } else if (
          negativeRegex.test(lowerCaseNotes) &&
          lastRunMood <= moodThresholdLow
        ) {
          insights.push(
            `😟 Mind Notes: Your diary notes & logged mood (${lastRunMood}/5) indicate you might have found the last run challenging.`
          );
          diaryInsightAdded = true;
          console.log(
            "[Insights Check - Diary] Negative correlation insight ADDED."
          );
        }
      } else {
        console.log(
          "[Insights Check - Diary] Skipping mood correlation: Mood not logged for last run."
        );
      }

      // Add generic insight if notes exist but correlation conditions not met
      if (!diaryInsightAdded && diaryNotesOnRunDay.length > 10) {
        insights.push(
          `📝 Diary Notes logged for ${lastRunDateStr}. Correlate with mood & performance.`
        );
        console.log(
          "[Insights Check - Diary] Generic 'notes logged' insight ADDED."
        );
      } else if (!diaryInsightAdded) {
        console.log(
          "[Insights Check - Diary] Conditions for specific keyword/mood correlation not met or notes too short."
        );
      }
    } else {
      console.log(
        "[Insights Check - Diary] Skipping: No diary notes found for last run date."
      );
    }
    console.log("[Insights Check] Finished Diary Correlation.");

    // --- End Insight Checks ---

    // Default message if no specific insights generated
    if (insights.length === 0) {
      console.log(
        "[Insights Result] No specific insights generated, adding default message."
      );
      insights.push(
        "Keep logging runs, diet, diary & mood to unlock more detailed insights!"
      );
    } else {
      console.log(
        `[Insights Result] Generated ${insights.length} specific insights.`
      );
    }

    console.log("[Insights] Sending response.");
    res.status(200).json({ insights });
  } catch (error) {
    console.error(
      `[Insights] Top-Level Error generating insights for user ID ${userId}:`,
      error
    );
    // Ensure client is released even if error happens before finally (e.g., during query)
    if (client) {
      try {
        client.release();
      } catch (e) {
        console.error("Error releasing client after error:", e);
      }
    }
    res
      .status(500)
      .json({ message: "Failed to generate insights.", error: error.message });
  } finally {
    // Ensure client is released if the main try block completed (successfully or with caught error)
    if (client && !client.release) {
      // Check if client might already be released by error handler
      try {
        client.release();
        console.log("[Insights] Releasing DB client in finally.");
      } catch (e) {
        console.error("Error releasing client in finally:", e);
      }
    } else if (client) {
      console.log("[Insights] DB client likely already released.");
    } else {
      console.log("[Insights] No DB client to release in finally.");
    }
  }
});

// ... (rest of server.js: other routes, listen, shutdown) ...

// Basic root route
app.get("/", (req, res) => {
  console.log("GET / route hit");
  res.send("RunMind Backend is running and accessible!");
});

// --- Start Server ---
app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});

// --- Graceful Shutdown Handling ---
const shutdown = async (signal) => {
  console.log(`\n${signal} received: closing server & DB pool...`);
  try {
    await db.pool.end();
    console.log("DB pool closed.");
    process.exit(0);
  } catch (err) {
    console.error("Error closing DB pool:", err);
    process.exit(1);
  }
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
