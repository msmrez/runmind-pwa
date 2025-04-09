// backend/controllers/stravaController.js
const axios = require("axios");
const db = require("../db");
const jwt = require("jsonwebtoken"); // For handleCallback JWT generation

// JWT Secret (Should match the one used in authController.js and be in .env)
const JWT_SECRET =
  process.env.JWT_SECRET || "YOUR_REALLY_STRONG_SECRET_KEY_HERE";
if (JWT_SECRET === "YOUR_REALLY_STRONG_SECRET_KEY_HERE") {
  console.warn("!!! WARNING: Using default JWT_SECRET in stravaController !!!");
}

// --- Helper Function: Refresh Strava Token ---
// (Defined within this controller, managing its own DB connection)
async function refreshStravaTokenForController(userId) {
  console.log(
    `%c[Strava Helper] Refresh Token: Attempting for user ID: ${userId}`,
    "color: blue"
  );
  let client; // Scoped to this function
  try {
    client = await db.pool.connect();
    const tokenQuery = `SELECT strava_refresh_token FROM users WHERE user_id = $1;`;
    const { rows } = await client.query(tokenQuery, [userId]);
    if (rows.length === 0) throw new Error(`User ${userId} not found`);
    if (!rows[0].strava_refresh_token)
      throw new Error(`Missing refresh token for user ${userId}`);
    const currentRefreshToken = rows[0].strava_refresh_token;

    const stravaClientId = process.env.STRAVA_CLIENT_ID,
      stravaClientSecret = process.env.STRAVA_CLIENT_SECRET;
    const tokenUrl = "https://www.strava.com/oauth/token";
    if (!stravaClientId || !stravaClientSecret)
      throw new Error("Strava config missing.");

    console.log(
      `[Strava Helper] Refresh Token: Requesting refresh from Strava for user ${userId}...`
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
    console.log(`[Strava Helper] Refresh Token: Success for user ${userId}.`);

    const updateQuery = `UPDATE users SET strava_access_token=$1, strava_refresh_token=$2, strava_token_expires_at=$3, updated_at=NOW() WHERE user_id=$4;`;
    await client.query(updateQuery, [
      access_token,
      newRefreshToken,
      expires_at,
      userId,
    ]);
    console.log(
      `[Strava Helper] Refresh Token: DB updated for user ${userId}.`
    );
    return access_token; // Return the new access token
  } catch (error) {
    console.error(
      `[Strava Helper] Refresh Token: Error for user ${userId}:`,
      error.message
    );
    throw error; // Re-throw the original error
  } finally {
    if (client) {
      client.release();
      console.log(
        `[Strava Helper] Refresh Token: DB client released for user ${userId}.`
      );
    }
  }
}
// --- End Helper Function ---

// --- Controller: Authorize (Initial Redirect) ---
exports.authorize = (req, res, next) => {
  // Added next for consistency
  console.log("[Strava Ctrl] GET /authorize hit");
  try {
    const stravaClientId = process.env.STRAVA_CLIENT_ID;
    const stravaRedirectUri = process.env.STRAVA_REDIRECT_URI;

    if (!stravaClientId || !stravaRedirectUri) {
      console.error(
        "[Strava Ctrl Authorize] Strava Client ID or Redirect URI missing"
      );
      // Send a proper error response
      return res.status(500).json({
        message: "Server configuration error: Strava credentials missing.",
      });
    }

    const scope = "read_all,profile:read_all,activity:read_all";
    const authorizationUrl = `https://www.strava.com/oauth/authorize?client_id=${stravaClientId}&redirect_uri=${encodeURIComponent(
      stravaRedirectUri
    )}&response_type=code&approval_prompt=auto&scope=${scope}`;

    console.log(
      `[Strava Ctrl Authorize] Redirecting user to Strava URL: ${authorizationUrl}`
    );
    // Perform the redirect
    res.redirect(authorizationUrl);
    // Log after calling redirect (may not always execute if redirect is immediate)
    console.log("[Strava Ctrl Authorize] res.redirect() called.");
  } catch (error) {
    console.error("[Strava Ctrl Authorize] Unexpected error:", error);
    next(error); // Pass to global error handler
  }
};
// --- End Authorize ---

// --- Controller: Handle Callback (Exchange Code, Login/Link User, Issue JWT) ---
exports.handleCallback = async (req, res, next) => {
  // Get code from query param (Strava redirect) OR body (frontend relay)
  const code = req.query.code || req.body.code;
  console.log("[Strava Ctrl] POST /token hit (handleCallback)");

  if (!code) {
    console.log("[Strava Ctrl Callback] Auth code missing");
    return res.status(400).json({ message: "Authorization code is missing" });
  }
  console.log("[Strava Ctrl Callback] Received code:", code);

  const stravaClientId = process.env.STRAVA_CLIENT_ID;
  const stravaClientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!stravaClientId || !stravaClientSecret) {
    console.error("[Strava Ctrl Callback] Strava client config missing");
    return next(
      new Error("Server configuration error: Strava client config missing")
    );
  }

  const tokenUrl = "https://www.strava.com/oauth/token";
  const tokenParams = {
    client_id: stravaClientId,
    client_secret: stravaClientSecret,
    code: code,
    grant_type: "authorization_code",
  };
  let client; // Define client outside try for potential release in outer catch

  try {
    console.log("[Strava Ctrl Callback] Requesting tokens from Strava...");
    const stravaResponse = await axios.post(tokenUrl, null, {
      params: tokenParams,
    });
    const { access_token, refresh_token, expires_at, athlete } =
      stravaResponse.data;
    console.log(
      "[Strava Ctrl Callback] Tokens received. Strava Athlete ID:",
      athlete.id
    );

    client = await db.pool.connect(); // Acquire DB client
    console.log("[Strava Ctrl Callback] DB Client acquired.");
    let userRecord; // Will hold the final DB user record

    try {
      // Inner try for DB transaction
      await client.query("BEGIN");

      // Find existing user by Strava ID, selecting all needed fields
      const findUserQuery = `SELECT * FROM users WHERE strava_id = $1`;
      const { rows } = await client.query(findUserQuery, [athlete.id]);

      if (rows.length > 0) {
        // User Found - Update
        userRecord = rows[0]; // Get existing record
        console.log(
          `[Strava Ctrl Callback] User found (ID: ${userRecord.user_id}). Updating Strava details...`
        );
        const updateQuery = `
                    UPDATE users SET
                        strava_access_token=$1, strava_refresh_token=$2, strava_token_expires_at=$3,
                        profile_picture_url=$4, first_name=$5, last_name=$6, city=$7, state=$8, country=$9, username=$10,
                        updated_at=NOW()
                    WHERE strava_id=$11 RETURNING *;`;
        const updateValues = [
          access_token,
          refresh_token,
          expires_at,
          athlete.profile || userRecord.profile_picture_url,
          athlete.firstname || userRecord.first_name,
          athlete.lastname || userRecord.last_name,
          athlete.city || userRecord.city,
          athlete.state || userRecord.state,
          athlete.country || userRecord.country,
          athlete.username || userRecord.username,
          athlete.id,
        ];
        const updateResult = await client.query(updateQuery, updateValues);
        userRecord = updateResult.rows[0]; // Get potentially updated full record
      } else {
        // User Not Found - Insert new user linked to Strava
        console.log(
          `[Strava Ctrl Callback] New Strava user. Creating record...`
        );
        const insertQuery = `
                    INSERT INTO users (strava_id, first_name, last_name, username, profile_picture_url, city, state, country, strava_access_token, strava_refresh_token, strava_token_expires_at, role, is_premium, email, password)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'runner', false, null, null)
                    RETURNING *;`; // Email/password are null initially
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
        userRecord = (await client.query(insertQuery, insertValues)).rows[0];
      }
      await client.query("COMMIT");
      console.log(
        `[Strava Ctrl Callback] DB Commit OK. User ID: ${userRecord.user_id}`
      );

      // --- Generate JWT for this user ---
      const payload = {
        userId: userRecord.user_id,
        email: userRecord.email,
        role: userRecord.role,
        isPremium: userRecord.is_premium,
      };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
      console.log(
        `[Strava Callback] Generated JWT for User ID: ${userRecord.user_id}`
      );

      // --- Respond with BOTH token and user info ---
      res.status(200).json({
        message: "Strava login successful!",
        token: token, // <<< SEND THE TOKEN
        user: {
          // Send info needed by frontend
          appUserId: userRecord.user_id,
          strava_id: userRecord.strava_id,
          email: userRecord.email,
          firstname: userRecord.first_name,
          lastname: userRecord.last_name,
          profile: userRecord.profile_picture_url,
          isPremium: userRecord.is_premium,
          role: userRecord.role,
        },
      });
      // --- End Response ---
    } catch (dbError) {
      // Catch DB errors
      console.error(
        "[Strava Ctrl Callback] DB Transaction Error. Rolling back.",
        dbError
      );
      // Attempt rollback, but don't await inside catch without another try/catch for rollback error
      try {
        await client.query("ROLLBACK");
        console.log("[Strava Ctrl Callback] Rollback successful.");
      } catch (rollbackErr) {
        console.error("[Strava Ctrl Callback] Rollback failed:", rollbackErr);
      }
      // IMPORTANT: Re-throw the original dbError so it's caught by the outer catch
      throw dbError;
    } finally {
      // Release client used for this transaction
      if (client) {
        client.release();
        console.log(
          "[Strava Ctrl Callback] DB Client released (inner finally)."
        );
      }
    }
    // --- End DB Logic ---
  } catch (error) {
    // Catches Axios errors or re-thrown DB errors
    console.error(
      "[Strava Ctrl Callback] Overall error:",
      error.response?.data || error.message
    );
    // No need to release client here IF the inner finally always runs correctly
    // Pass error to global handler
    next(error);
  }
  // No finally needed here if DB client release is handled reliably by inner finally
};
// --- End handleCallback ---

// --- Controller: Sync Activities ---
exports.syncActivities = async (req, res, next) => {
  // Get user ID from JWT payload attached by authenticateToken middleware
  const userId = req.user?.userId; // Use optional chaining for safety
  if (!userId) {
    return next(new Error("User ID not found in token payload during sync."));
  } // Should not happen if middleware works

  console.log(`[Strava Ctrl] POST /api/strava/sync - User: ${userId}`);
  let client;

  try {
    client = await db.pool.connect();
    console.log(`[Strava Sync] DB Client acquired for user ${userId}`);

    // 1. Get User Tokens & Check/Refresh
    console.log(`[Strava Sync] Fetching user tokens for user ${userId}...`);
    const userQuery = `SELECT user_id, strava_access_token, strava_refresh_token, strava_token_expires_at FROM users WHERE user_id = $1;`;
    const userResult = await client.query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    } // Early exit OK

    let { strava_access_token, strava_refresh_token, strava_token_expires_at } =
      userResult.rows[0];
    console.log(`[Strava Sync] User token data fetched for user ${userId}.`);

    if (!strava_access_token || !strava_refresh_token) {
      console.log(`[Strava Sync] User ${userId} missing Strava tokens.`);
      return res.status(400).json({
        message: "Strava account not connected.",
        code: "STRAVA_NOT_CONNECTED",
      }); // Use 400
    }

    const nowSeconds = Math.floor(Date.now() / 1000),
      bufferSeconds = 300;
    console.log(`[Strava Sync] Checking token expiry for user ${userId}.`);
    if (strava_token_expires_at <= nowSeconds + bufferSeconds) {
      console.log(
        `[Strava Sync] Token needs refresh for user ${userId}. Calling helper...`
      );
      try {
        strava_access_token = await refreshStravaTokenForController(userId); // Use helper
        console.log(
          `[Strava Sync] Token refresh successful for user ${userId}.`
        );
      } catch (refreshError) {
        throw new Error(`Strava token refresh failed: ${refreshError.message}`);
      } // Throw to outer catch
    } else {
      console.log(`[Strava Sync] Token is valid for user ${userId}.`);
    }
    console.log(`[Strava Sync] Using access token...`);

    // 2. Fetch Activities from Strava API
    console.log(
      `[Strava Sync] Fetching activities from Strava API for user ${userId}...`
    );
    const stravaApiUrl = "https://www.strava.com/api/v3/athlete/activities";
    let stravaResponse;
    try {
      stravaResponse = await axios.get(stravaApiUrl, {
        headers: { Authorization: `Bearer ${strava_access_token}` },
        params: { page: 1, per_page: 50 },
      });
      console.log(`[Strava Sync] Strava API call successful.`);
    } catch (axiosError) {
      throw new Error(
        `Failed to fetch Strava activities: ${
          axiosError.response?.data?.message || axiosError.message
        }`
      );
    } // Throw to outer catch

    const activities = stravaResponse.data || [];
    console.log(
      `[Strava Sync] Fetched ${activities.length} activities from Strava.`
    );
    if (activities.length === 0) {
      return res
        .status(200)
        .json({ message: "No new activities found.", activitiesStored: 0 });
    } // Early exit OK

    console.log(
      `[Strava Sync] Proceeding to database transaction for user ${userId}.`
    );

    // 3. Store/Update Activities in DB (Transaction)
    let count = 0;
    try {
      // Inner try for DB transaction
      await client.query("BEGIN");
      console.log(`[Strava Sync DB] Transaction STARTED for user ${userId}.`);
      const query = `INSERT INTO activities (user_id, strava_activity_id, name, distance, moving_time, elapsed_time, total_elevation_gain, type, start_date, start_date_local, timezone, average_speed, max_speed, average_heartrate, max_heartrate) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (strava_activity_id) DO UPDATE SET name=EXCLUDED.name, distance=EXCLUDED.distance, moving_time=EXCLUDED.moving_time, elapsed_time=EXCLUDED.elapsed_time, total_elevation_gain=EXCLUDED.total_elevation_gain, type=EXCLUDED.type, start_date=EXCLUDED.start_date, start_date_local=EXCLUDED.start_date_local, timezone=EXCLUDED.timezone, average_speed=EXCLUDED.average_speed, max_speed=EXCLUDED.max_speed, average_heartrate=EXCLUDED.average_heartrate, max_heartrate=EXCLUDED.max_heartrate, updated_at=NOW();`;
      for (const act of activities) {
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
        `[Strava Sync DB] Transaction COMMITTED. Processed: ${count}.`
      );
      res.status(200).json({
        message: `Synced ${count} activities.`,
        activitiesStored: count,
      }); // Send success response
    } catch (dbError) {
      // Catch only DB transaction errors
      console.error(`[Strava Sync DB] Error. Rolling back.`, dbError);
      try {
        await client.query("ROLLBACK");
      } catch (rbErr) {
        console.error("Rollback failed:", rbErr);
      }
      throw dbError; // Re-throw to outer catch
    }
    // No inner finally needed
  } catch (error) {
    // Catch errors from connect, token check/refresh, Strava API call, OR re-thrown DB error
    console.error(
      `[Strava Ctrl Sync] Overall error for user ${userId}:`,
      error.message
    );
    next(error); // Pass to global error handler
    return; // Explicit return after passing error
  } finally {
    // This block runs for success, errors caught by outer catch, or early returns
    if (client) {
      console.log(
        `[Strava Sync] Releasing DB client in finally block for user ${userId}.`
      );
      client.release(); // Release client once
    } else {
      console.log(
        `[Strava Sync] No client acquired, nothing to release for user ${userId}.`
      );
    }
  }
}; // End of syncActivities
// --- End Controller ---
