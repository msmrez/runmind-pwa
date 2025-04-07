// backend/server.js

require("dotenv").config(); // Load environment variables from .env file first
console.log("Attempting to load environment variables..."); // Debug log
console.log(
  "Loaded STRAVA_CLIENT_ID:",
  process.env.STRAVA_CLIENT_ID ? "Found" : "Missing!"
); // Verify .env loading
console.log("Loaded DB_USER:", process.env.DB_USER ? "Found" : "Missing!"); // Verify DB user is loaded

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const db = require("./db"); // Import the database connection module (pool)

const app = express();
const port = process.env.PORT || 5001;

// --- Middleware ---
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Middleware to parse JSON request bodies

// --- Helper Functions ---

/**
 * Refreshes the Strava access token for a given user.
 * Updates the database with the new tokens and expiry time.
 *
 * @param {number} userId The internal user ID from your 'users' table.
 * @returns {Promise<string>} The new, valid access token.
 * @throws {Error} If refreshing fails or user data is missing.
 */
async function refreshStravaToken(userId) {
  console.log(`[refreshStravaToken] Attempting for user ID: ${userId}`);
  const client = await db.pool.connect();
  try {
    // 1. Get current refresh token
    const tokenQuery = `
            SELECT strava_refresh_token, strava_token_expires_at
            FROM users
            WHERE user_id = $1;
        `;
    const { rows } = await client.query(tokenQuery, [userId]);

    if (rows.length === 0) {
      throw new Error(`User not found for ID: ${userId}`);
    }
    if (!rows[0].strava_refresh_token) {
      throw new Error(`Missing refresh token for user ID: ${userId}`);
    }

    const currentRefreshToken = rows[0].strava_refresh_token;

    // 2. Call Strava OAuth token endpoint for refresh
    const stravaClientId = process.env.STRAVA_CLIENT_ID;
    const stravaClientSecret = process.env.STRAVA_CLIENT_SECRET;
    const tokenUrl = "https://www.strava.com/oauth/token";

    if (!stravaClientId || !stravaClientSecret) {
      throw new Error("Strava client ID or secret missing in server config.");
    }

    console.log(
      `[refreshStravaToken] Requesting refreshed tokens from Strava for user ID: ${userId}...`
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
    console.log(
      `[refreshStravaToken] Successfully refreshed for user ID: ${userId}. New expiry: ${new Date(
        expires_at * 1000
      )}`
    );

    // 3. Update the user's record in the database with new tokens
    const updateQuery = `
            UPDATE users
            SET strava_access_token = $1,
                strava_refresh_token = $2,
                strava_token_expires_at = $3, -- Store as BIGINT (epoch seconds)
                updated_at = NOW()
            WHERE user_id = $4;
        `;
    await client.query(updateQuery, [
      access_token,
      newRefreshToken,
      expires_at,
      userId,
    ]);
    console.log(
      `[refreshStravaToken] Database updated with new tokens for user ID: ${userId}.`
    );

    return access_token; // Return the new access token
  } catch (error) {
    console.error(
      `[refreshStravaToken] Error for user ID ${userId}:`,
      error.response?.data || error.message
    );
    // Decide how to handle specific errors, e.g., invalid refresh token means user needs to re-authenticate
    if (error.response?.data?.message === "Invalid Refresh Token") {
      console.error(
        `[refreshStravaToken] User ${userId} has an invalid refresh token. Needs to re-authenticate.`
      );
      // Consider clearing tokens or marking the user account
      // await client.query("UPDATE users SET strava_access_token=NULL, strava_refresh_token=NULL, strava_token_expires_at=NULL WHERE user_id=$1", [userId]);
    }
    // Re-throw a generic error or the specific one to be caught by the calling route handler
    throw new Error(`Failed to refresh Strava token: ${error.message}`);
  } finally {
    client.release(); // Ensure client is always released
  }
}

// --- Authentication Middleware Placeholder ---
// !! IMPORTANT !! Replace this with proper JWT/Session authentication for production.
// This current implementation is INSECURE as user IDs can be easily spoofed.
const simpleAuthMiddleware = (req, res, next) => {
  // Try header first, then body, then query param as examples
  const userId =
    req.headers["x-user-id"] || req.body.userId || req.query.userId;
  console.log(
    `[SimpleAuth] Received User ID via ${
      req.headers["x-user-id"] ? "header" : req.body.userId ? "body" : "query"
    }: ${userId}`
  );

  if (!userId) {
    console.warn("[SimpleAuth] User ID missing in request.");
    return res
      .status(401)
      .json({ message: "User ID missing. Authentication required." });
  }

  // Validate and attach user ID to request object
  const parsedUserId = parseInt(userId, 10);
  if (isNaN(parsedUserId)) {
    console.warn(`[SimpleAuth] Invalid User ID format received: ${userId}`);
    return res.status(400).json({ message: "Invalid User ID format." });
  }

  req.userId = parsedUserId; // Attach the validated & parsed user ID
  console.log(`[SimpleAuth] Authenticated request for user ID: ${req.userId}`);
  next(); // Proceed to the next middleware or route handler
};

// --- Routes ---

// Route to initiate Strava OAuth flow
app.get("/strava/authorize", (req, res) => {
  console.log("GET /strava/authorize route hit");
  const stravaClientId = process.env.STRAVA_CLIENT_ID;
  const stravaRedirectUri = process.env.STRAVA_REDIRECT_URI;

  if (!stravaClientId || !stravaRedirectUri) {
    console.error(
      "Strava Client ID or Redirect URI missing in .env for /strava/authorize"
    );
    return res
      .status(500)
      .send("Server configuration error: Strava credentials missing.");
  }

  // Define the scopes your application needs
  const scope = "read_all,profile:read_all,activity:read_all";
  const authorizationUrl = `https://www.strava.com/oauth/authorize?client_id=${stravaClientId}&redirect_uri=${encodeURIComponent(
    stravaRedirectUri
  )}&response_type=code&approval_prompt=auto&scope=${scope}`;

  console.log(
    `Redirecting user to Strava authorization URL: ${authorizationUrl}`
  );
  res.redirect(authorizationUrl);
});

// Strava Token Exchange Route (Handles the callback from Strava)
app.post("/strava/token", async (req, res) => {
  const { code } = req.body;

  console.log("POST /strava/token route hit");

  if (!code) {
    console.log("Authorization code missing in request to /strava/token");
    return res.status(400).json({ message: "Authorization code is missing" });
  }

  console.log("Received authorization code from frontend:", code);

  const stravaClientId = process.env.STRAVA_CLIENT_ID;
  const stravaClientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!stravaClientId || !stravaClientSecret) {
    console.error(
      "Strava Client ID or Secret missing in .env for token exchange"
    );
    return res
      .status(500)
      .json({ message: "Server configuration error during token exchange." });
  }

  const tokenUrl = "https://www.strava.com/oauth/token";
  const tokenParams = {
    client_id: stravaClientId,
    client_secret: stravaClientSecret,
    code: code,
    grant_type: "authorization_code",
  };

  let client; // DB client, declared outside try for finally block

  try {
    console.log("Requesting access tokens from Strava...");
    // 1. Exchange code for tokens with Strava
    const response = await axios.post(tokenUrl, null, { params: tokenParams });
    const { access_token, refresh_token, expires_at, athlete } = response.data;

    console.log("Successfully received tokens and athlete data from Strava.");
    console.log("Strava Athlete ID:", athlete.id);
    console.log("Access Token Expires At:", new Date(expires_at * 1000));

    // 2. Database Interaction within a Transaction
    client = await db.pool.connect();
    console.log("Acquired DB client, beginning transaction...");

    try {
      await client.query("BEGIN");

      // Check if user exists based on Strava ID
      const findUserQuery = "SELECT user_id FROM users WHERE strava_id = $1";
      const { rows } = await client.query(findUserQuery, [athlete.id]);
      let userRecord; // Will hold the user data after insert/update

      if (rows.length > 0) {
        // User Exists: Update
        const existingUserId = rows[0].user_id;
        console.log(
          `User found in DB (user_id: ${existingUserId}, strava_id: ${athlete.id}). Updating tokens and profile info.`
        );
        const updateUserQuery = `
          UPDATE users
          SET strava_access_token = $1,
              strava_refresh_token = $2,
              strava_token_expires_at = $3, -- Store as BIGINT (epoch seconds)
              first_name = $4,
              last_name = $5,
              username = $6,
              profile_picture_url = $7,
              city = $8,
              state = $9,
              country = $10,
              updated_at = NOW()
          WHERE strava_id = $11
          RETURNING user_id, strava_id, first_name, last_name, username, profile_picture_url, city, state, country;
        `;
        const updateValues = [
          access_token,
          refresh_token,
          expires_at, // Raw epoch seconds
          athlete.firstname,
          athlete.lastname,
          athlete.username,
          athlete.profile,
          athlete.city,
          athlete.state,
          athlete.country,
          athlete.id,
        ];
        const updatedResult = await client.query(updateUserQuery, updateValues);
        userRecord = updatedResult.rows[0];
        console.log(
          `User record updated successfully (user_id: ${userRecord.user_id}).`
        );
      } else {
        // User Doesn't Exist: Insert
        console.log(
          `User not found in DB (strava_id: ${athlete.id}). Creating new user record.`
        );
        const insertUserQuery = `
          INSERT INTO users (
              strava_id, first_name, last_name, username, profile_picture_url,
              city, state, country,
              strava_access_token, strava_refresh_token, strava_token_expires_at -- Column is BIGINT
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) -- Pass raw epoch seconds for $11
          RETURNING user_id, strava_id, first_name, last_name, username, profile_picture_url, city, state, country;
        `;
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
          expires_at, // Raw epoch seconds
        ];
        const insertedResult = await client.query(
          insertUserQuery,
          insertValues
        );
        userRecord = insertedResult.rows[0];
        console.log(
          `New user record created successfully (user_id: ${userRecord.user_id}).`
        );
      }

      await client.query("COMMIT");
      console.log("Transaction committed successfully.");

      // Respond to frontend with essential data, INCLUDING appUserId
      res.json({
        message:
          "Successfully authenticated with Strava and user data saved/updated!",
        athlete: {
          id: userRecord.strava_id, // Strava ID
          appUserId: userRecord.user_id, // <<< Your internal App User ID
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
      console.error("Database transaction failed. Rolling back.", dbError);
      // Re-throw to be caught by outer catch, more specific message
      throw new Error(`Database operation failed: ${dbError.message}`);
    } finally {
      client.release(); // Release client back to pool
      console.log("DB client released after transaction attempt.");
    }
  } catch (error) {
    // Catches errors from Strava API call, DB connection, or re-thrown DB errors
    console.error(
      "Error during Strava token exchange or DB operation:",
      error.response?.data || error.message,
      error.stack
    );
    res.status(500).json({
      message:
        "Failed to process Strava authentication due to an internal error.",
      error_details: error.message, // Provide clearer error details
    });
  }
});

// Route to fetch activities from Strava and store/update them in our DB
app.post("/api/strava/sync", simpleAuthMiddleware, async (req, res) => {
  const userId = req.userId; // Get user ID attached by middleware
  console.log(`POST /api/strava/sync - Starting for user ID: ${userId}`);

  let client; // DB client for this operation

  try {
    client = await db.pool.connect();
    console.log(`[Sync] Acquired DB client for user ID: ${userId}`);

    // 1. Get User's Tokens and Expiry from DB
    const userQuery = `
            SELECT user_id, strava_access_token, strava_refresh_token, strava_token_expires_at
            FROM users
            WHERE user_id = $1;
        `;
    const userResult = await client.query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      console.warn(`[Sync] User not found in DB for ID: ${userId}`);
      // Release client before sending response
      client.release();
      return res.status(404).json({ message: "User not found." });
    }

    let { strava_access_token, strava_refresh_token, strava_token_expires_at } =
      userResult.rows[0];

    if (!strava_access_token || !strava_refresh_token) {
      console.warn(`[Sync] User ${userId} missing Strava tokens.`);
      client.release();
      return res.status(401).json({
        message: "User not fully authenticated with Strava. Please reconnect.",
      });
    }

    // 2. Check if Access Token is Expired and Refresh if Needed
    const nowSeconds = Math.floor(Date.now() / 1000);
    const bufferSeconds = 300; // 5-minute buffer before actual expiry

    if (strava_token_expires_at <= nowSeconds + bufferSeconds) {
      // Check against future expiry
      console.log(
        `[Sync] Token expired or nearing expiry for user ID: ${userId}. Refreshing...`
      );
      try {
        // refreshStravaToken handles DB update internally
        strava_access_token = await refreshStravaToken(userId);
      } catch (refreshError) {
        console.error(
          `[Sync] Token refresh failed for user ${userId}:`,
          refreshError
        );
        client.release();
        return res.status(401).json({
          message:
            "Failed to refresh Strava token. Please try reconnecting Strava.",
          error: refreshError.message, // Pass refresh error message
        });
      }
    } else {
      console.log(`[Sync] Token is valid for user ID: ${userId}.`);
    }

    // 3. Fetch Recent Activities from Strava API using the valid token
    const stravaActivitiesUrl =
      "https://www.strava.com/api/v3/athlete/activities";
    const activitiesPerPage = 50; // Adjust as needed, max 200 for Strava
    let page = 1;
    let allActivities = [];
    let activitiesFetchedInThisPage;

    console.log(
      `[Sync] Fetching Strava activities page ${page} for user ID: ${userId}...`
    );
    // Fetching only the first page for simplicity now. Implement pagination loop if needed.
    const stravaResponse = await axios.get(stravaActivitiesUrl, {
      headers: { Authorization: `Bearer ${strava_access_token}` },
      params: {
        page: page,
        per_page: activitiesPerPage,
        // Optional: Fetch activities after the last stored activity's start_date
        // after: lastSyncTimestamp
      },
    });

    activitiesFetchedInThisPage = stravaResponse.data;
    allActivities = allActivities.concat(activitiesFetchedInThisPage);
    console.log(
      `[Sync] Fetched ${activitiesFetchedInThisPage.length} activities from Strava.`
    );

    if (allActivities.length === 0) {
      console.log(
        `[Sync] No new activities found on Strava for user ID: ${userId}.`
      );
      client.release();
      return res.status(200).json({
        message: "No new Strava activities found.",
        activitiesStored: 0,
      });
    }

    // 4. Store/Update Activities in Database (Upsert within Transaction)
    let activitiesStoredCount = 0;
    try {
      await client.query("BEGIN"); // Start transaction

      for (const activity of allActivities) {
        // Optional: Filter for specific types like 'Run'
        // if (activity.type !== 'Run') continue;

        const insertQuery = `
                  INSERT INTO activities (
                      user_id, strava_activity_id, name, distance, moving_time,
                      elapsed_time, total_elevation_gain, type, start_date,
                      start_date_local, timezone, average_speed, max_speed,
                      average_heartrate, max_heartrate
                  )
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                  ON CONFLICT (strava_activity_id) DO UPDATE SET
                      name = EXCLUDED.name,
                      distance = EXCLUDED.distance,
                      moving_time = EXCLUDED.moving_time,
                      elapsed_time = EXCLUDED.elapsed_time,
                      total_elevation_gain = EXCLUDED.total_elevation_gain,
                      type = EXCLUDED.type,
                      start_date = EXCLUDED.start_date,
                      start_date_local = EXCLUDED.start_date_local,
                      timezone = EXCLUDED.timezone,
                      average_speed = EXCLUDED.average_speed,
                      max_speed = EXCLUDED.max_speed,
                      average_heartrate = EXCLUDED.average_heartrate,
                      max_heartrate = EXCLUDED.max_heartrate,
                      updated_at = NOW(); -- Important: Update timestamp on conflict update
                `;
        const values = [
          userId,
          activity.id,
          activity.name || "Unnamed Activity", // Handle potential null names
          activity.distance,
          activity.moving_time,
          activity.elapsed_time,
          activity.total_elevation_gain,
          activity.type,
          activity.start_date,
          activity.start_date_local,
          activity.timezone,
          activity.average_speed,
          activity.max_speed,
          activity.average_heartrate,
          activity.max_heartrate,
        ];

        const result = await client.query(insertQuery, values);
        // rowCount tells if INSERT or UPDATE happened
        if (result.rowCount > 0) {
          activitiesStoredCount++;
        }
      }

      await client.query("COMMIT"); // Commit transaction
      console.log(
        `[Sync] Transaction committed. Stored/Updated ${activitiesStoredCount} activities for user ID: ${userId}.`
      );
      res.status(200).json({
        message: `Successfully synced ${activitiesStoredCount} activities.`,
        activitiesStored: activitiesStoredCount,
      });
    } catch (dbError) {
      await client.query("ROLLBACK");
      console.error(
        `[Sync] Database error during activity storage for user ${userId}. Rolling back.`,
        dbError
      );
      res.status(500).json({
        message: "Database error during activity sync.",
        error: dbError.message,
      });
    } finally {
      // Ensure client is released if DB transaction block finishes (success or error)
      client.release();
      console.log(
        `[Sync] DB client released after storage attempt for user ID: ${userId}.`
      );
    }
  } catch (error) {
    // Catch errors from steps before DB transaction (getting user, token check, Strava API call)
    console.error(
      `[Sync] Error for user ID ${userId}:`,
      error.response?.data || error.message,
      error.stack
    );
    // Ensure client is released if acquired before the error occurred
    if (client) {
      client.release();
      console.log(
        `[Sync] DB client released after error for user ID: ${userId}.`
      );
    }

    if (error.response?.status === 401) {
      // Unauthorized from Strava API call
      res.status(401).json({
        message:
          "Strava authorization failed (API call). Please try reconnecting Strava.",
        error: error.response?.data || error.message,
      });
    } else {
      res.status(500).json({
        message: "Failed to sync Strava activities due to an internal error.",
        error: error.message,
      });
    }
  }
});

// Basic root route (Good for health checks)
app.get("/", (req, res) => {
  console.log("GET / route hit");
  res.send("RunMind Backend is running and accessible!");
});

// --- Start Server ---
app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
  // Verify DB connection is attempted when pool is created (from db.js)
});

// --- Graceful Shutdown Handling ---
process.on("SIGINT", async () => {
  console.log("\nSIGINT signal received: closing HTTP server and DB pool...");
  // Add server.close() logic here if needed, requires access to the server instance
  // e.g., const server = app.listen(...) then server.close(...)
  try {
    await db.pool.end(); // Close all connections in the pool
    console.log("DB pool closed successfully.");
  } catch (err) {
    console.error("Error closing DB pool:", err);
  }
  process.exit(0); // Exit process
});

process.on("SIGTERM", async () => {
  console.log("\nSIGTERM signal received: closing HTTP server and DB pool...");
  // Add server.close() logic here if needed
  try {
    await db.pool.end();
    console.log("DB pool closed successfully.");
  } catch (err) {
    console.error("Error closing DB pool:", err);
  }
  process.exit(0);
});
