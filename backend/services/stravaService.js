// backend/services/stravaService.js
const axios = require("axios");
const db = require("../db"); // Adjust path if needed

/**
 * Refreshes the Strava access token for a given user.
 * Updates the database with the new tokens and expiry time.
 * @param {number} userId The internal user ID from your 'users' table.
 * @returns {Promise<string>} The new, valid access token.
 * @throws {Error} If refreshing fails or user data is missing.
 */
async function refreshStravaToken(userId) {
  console.log(
    `[Strava Service] Attempting token refresh for user ID: ${userId}`
  );
  const client = await db.pool.connect();
  try {
    const tokenQuery = `SELECT strava_refresh_token FROM users WHERE user_id = $1;`;
    const { rows } = await client.query(tokenQuery, [userId]);
    if (rows.length === 0) throw new Error(`User not found for ID: ${userId}`);
    if (!rows[0].strava_refresh_token)
      throw new Error(`Missing refresh token for user ID: ${userId}`);

    const currentRefreshToken = rows[0].strava_refresh_token;
    const stravaClientId = process.env.STRAVA_CLIENT_ID;
    const stravaClientSecret = process.env.STRAVA_CLIENT_SECRET;
    const tokenUrl = "https://www.strava.com/oauth/token";

    if (!stravaClientId || !stravaClientSecret)
      throw new Error("Strava client ID or secret missing.");

    console.log(
      `[Strava Service] Requesting refresh from Strava for user ID: ${userId}...`
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
    console.log(`[Strava Service] Success for user ID: ${userId}.`);

    const updateQuery = `UPDATE users SET strava_access_token=$1, strava_refresh_token=$2, strava_token_expires_at=$3, updated_at=NOW() WHERE user_id=$4;`;
    await client.query(updateQuery, [
      access_token,
      newRefreshToken,
      expires_at,
      userId,
    ]);
    console.log(`[Strava Service] DB updated for user ID: ${userId}.`);
    return access_token;
  } catch (error) {
    console.error(
      `[Strava Service] Token Refresh Error for user ID ${userId}:`,
      error.message
    );
    throw error; // Re-throw to be handled by controller
  } finally {
    client.release();
  }
}

module.exports = {
  refreshStravaToken,
};
