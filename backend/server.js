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
        return res
          .status(401)
          .json({
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
      res
        .status(200)
        .json({
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
        return res
          .status(check.rowCount === 0 ? 404 : 403)
          .json({
            message:
              check.rowCount === 0
                ? "Activity not found."
                : "Permission denied.",
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
app.get("/api/insights", simpleAuthMiddleware, async (req, res) => {
  const userId = req.userId;
  console.log(`GET /api/insights - User: ${userId}`);
  try {
    const query = `SELECT distance, moving_time, average_heartrate, start_date_local, mental_mood FROM activities WHERE user_id = $1 AND type = 'Run' ORDER BY start_date_local DESC LIMIT 10;`;
    const { rows: runs } = await db.query(query, [userId]);
    if (runs.length < 2)
      return res
        .status(200)
        .json({ insights: ["Log more runs for insights!"] });

    const insights = [];
    const last = runs[0];
    const prev = runs.slice(1);
    const avgP = prev.reduce(
      (a, r) => {
        /* ... calculate averages (distance, hr, paceSeconds) ... */
        a.d += r.distance || 0;
        a.t += r.moving_time || 0;
        a.h += r.average_heartrate || 0;
        a.c++;
        const p = calculatePaceMinPerKm(r.distance, r.moving_time);
        if (p) {
          try {
            const ps =
              parseInt(p.split(":")[0]) * 60 + parseInt(p.split(":")[1]);
            a.ps += ps;
            a.pc++;
          } catch {}
        }
        return a;
      },
      { d: 0, t: 0, h: 0, c: 0, ps: 0, pc: 0 }
    );
    const avgD = avgP.c ? avgP.d / avgP.c : 0,
      avgH = avgP.c ? avgP.h / avgP.c : 0,
      avgPS = avgP.pc ? avgP.ps / avgP.pc : 0;
    let avgPF = null;
    if (avgPS > 0) {
      const m = Math.floor(avgPS / 60),
        s = Math.round(avgPS % 60);
      avgPF = `${m}:${s < 10 ? "0" + s : s} /km`;
    }
    const lastP = calculatePaceMinPerKm(last.distance, last.moving_time);
    let lastPS = null;
    if (lastP) {
      try {
        lastPS =
          parseInt(lastP.split(":")[0]) * 60 + parseInt(lastP.split(":")[1]);
      } catch {}
    }

    // Generate insights (Pace, Distance, Recovery, Mind-Body)
    if (lastP && avgPF && lastPS && avgPS > 0) {
      const d = lastPS - avgPS;
      if (d < -10)
        insights.push(`🚀 Pace: Faster (${lastP}) than avg (${avgPF}).`);
      else if (d > 10)
        insights.push(`📉 Pace: Slower (${lastP}) than avg (${avgPF}).`);
    }
    if (last.distance && avgD > 0) {
      const dP = ((last.distance - avgD) / avgD) * 100;
      if (dP > 25)
        insights.push(
          `🏃 Distance: Longer (${(last.distance / 1000).toFixed(
            1
          )}km) than avg (${(avgD / 1000).toFixed(1)}km).`
        );
      else if (dP < -25)
        insights.push(
          ` Short (${(last.distance / 1000).toFixed(1)}km) vs avg (${(
            avgD / 1000
          ).toFixed(1)}km).`
        );
    }
    const isLong = last.distance > avgD * 1.3,
      isHighH =
        last.average_heartrate &&
        avgH > 0 &&
        last.average_heartrate > avgH * 1.05;
    if (isLong && isHighH)
      insights.push(
        `🥵 Recovery: High effort & long run. Prioritize recovery.`
      );
    else if (isLong) insights.push(`👍 Recovery: Long run. Recover well.`);
    else if (isHighH)
      insights.push(`💓 Recovery: HR higher than usual. Listen to body.`);
    if (last.mental_mood && lastPS && avgPS > 0) {
      if (last.mental_mood >= 4 && lastPS < avgPS * 0.98)
        insights.push(
          `✨ Mind-Body: High mood (${last.mental_mood}/5) & faster pace!`
        );
      else if (last.mental_mood <= 2 && lastPS > avgPS * 1.02)
        insights.push(
          `🤔 Mind-Body: Lower mood (${last.mental_mood}/5) & slower pace.`
        );
    }
    if (insights.length === 0)
      insights.push("Keep logging runs & mood for more insights!");

    console.log(`[Insights] Generated ${insights.length} for user: ${userId}`);
    res.status(200).json({ insights });
  } catch (error) {
    console.error(`[Insights] Error user ${userId}:`, error);
    res
      .status(500)
      .json({ message: "Failed insight gen.", error: error.message });
  }
});

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
