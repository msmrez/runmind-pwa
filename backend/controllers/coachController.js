// backend/controllers/coachController.js
const db = require("../db"); // Adjust path if needed

// POST /api/coaches/link/request (Athlete initiates)
exports.requestLink = async (req, res, next) => {
  const athleteUserId = req.user.userId; // Athlete making the request
  const { coachEmail } = req.body;

  console.log(
    `Link Request: Athlete ${athleteUserId} -> Coach Email ${coachEmail}`
  );
  if (!coachEmail) {
    return res.status(400).json({ message: "Coach email is required." });
  }
  if (req.user.role !== "runner") {
    return res
      .status(403)
      .json({ message: "Only runners can request to link with coaches." });
  }

  try {
    // Find the coach by email
    const findCoachQuery =
      "SELECT user_id FROM users WHERE email = $1 AND role = 'coach'";
    const coachResult = await db.query(findCoachQuery, [
      coachEmail.toLowerCase(),
    ]);

    if (coachResult.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Coach not found with that email." });
    }
    const coachUserId = coachResult.rows[0].user_id;

    if (coachUserId === athleteUserId) {
      return res.status(400).json({ message: "Cannot link with yourself." });
    }

    // Check if link already exists (any status)
    const checkLinkQuery =
      "SELECT link_id, status FROM coach_athlete_links WHERE coach_user_id = $1 AND athlete_user_id = $2";
    const existingLink = await db.query(checkLinkQuery, [
      coachUserId,
      athleteUserId,
    ]);

    if (existingLink.rows.length > 0) {
      // Handle existing link (e.g., already pending, accepted, or previously declined/revoked)
      const { link_id, status } = existingLink.rows[0];
      console.log(
        `Link Request: Link already exists (ID: ${link_id}, Status: ${status})`
      );
      if (status === "pending")
        return res.status(409).json({ message: "Request already pending." });
      if (status === "accepted")
        return res
          .status(409)
          .json({ message: "Already linked with this coach." });
      // Potentially allow re-request if declined/revoked? Or require coach action.
      // For now, just block re-request if any link exists.
      return res.status(409).json({
        message: `A previous link attempt exists (status: ${status}).`,
      });
    }

    // Create new pending request
    const insertQuery = `
            INSERT INTO coach_athlete_links (coach_user_id, athlete_user_id, status, requested_by)
            VALUES ($1, $2, 'pending', 'athlete')
            RETURNING *;
        `;
    const { rows } = await db.query(insertQuery, [coachUserId, athleteUserId]);
    console.log("Link Request: Pending request created successfully.", rows[0]);
    res
      .status(201)
      .json({ message: "Link request sent successfully.", link: rows[0] });
  } catch (error) {
    console.error("[Request Link] Error:", error);
    if (error.code === "23505")
      return res.status(409).json({
        message: "Link request conflict (possibly simultaneous attempt?).",
      }); // Unique constraint
    next(error);
  }
};

// GET /api/coaches/link/requests?status=pending (Coach views)
exports.getPendingRequests = async (req, res, next) => {
  const coachUserId = req.user.userId;
  // Defaulting status to pending, but could allow other statuses via query param if needed
  const status = req.query.status || "pending";
  if (status !== "pending") {
    return res.status(400).json({
      message: "Only status=pending is currently supported for requests.",
    });
  }

  console.log(`Get Pending Requests: Coach ${coachUserId}`);
  try {
    // Fetch pending requests FOR this coach, include athlete details
    const query = `
            SELECT l.link_id, l.athlete_user_id, l.status, l.requested_by, l.created_at,
                   u.first_name as athlete_first_name, u.last_name as athlete_last_name, u.email as athlete_email
            FROM coach_athlete_links l
            JOIN users u ON l.athlete_user_id = u.user_id
            WHERE l.coach_user_id = $1 AND l.status = $2
            ORDER BY l.created_at ASC;
        `;
    const { rows } = await db.query(query, [coachUserId, status]);
    console.log(`Get Pending Requests: Found ${rows.length} requests.`);
    res.status(200).json(rows);
  } catch (error) {
    console.error("[Get Pending Requests] Error:", error);
    next(error);
  }
};

// PUT /api/coaches/link/requests/:linkId (Coach accepts/declines)
exports.updateRequestStatus = async (req, res, next) => {
  const coachUserId = req.user.userId;
  const { linkId } = req.params;
  const { status } = req.body; // Expecting 'accepted' or 'declined'

  const linkIdInt = parseInt(linkId, 10);
  if (isNaN(linkIdInt))
    return res.status(400).json({ message: "Invalid Link ID." });
  if (!["accepted", "declined"].includes(status)) {
    return res
      .status(400)
      .json({ message: "Invalid status. Must be 'accepted' or 'declined'." });
  }

  console.log(
    `Update Request Status: Coach ${coachUserId}, Link ${linkId}, New Status ${status}`
  );
  try {
    // Update status only if link is 'pending' and belongs to this coach
    const query = `
             UPDATE coach_athlete_links
             SET status = $1, updated_at = NOW()
             WHERE link_id = $2 AND coach_user_id = $3 AND status = 'pending'
             RETURNING *;
         `;
    const { rows, rowCount } = await db.query(query, [
      status,
      linkIdInt,
      coachUserId,
    ]);

    if (rowCount === 0) {
      // Check why update failed (not found, wrong coach, wrong status)
      const check = await db.query(
        "SELECT status, coach_user_id FROM coach_athlete_links WHERE link_id = $1",
        [linkIdInt]
      );
      if (check.rowCount === 0)
        return res.status(404).json({ message: "Link request not found." });
      if (check.rows[0].coach_user_id !== coachUserId)
        return res.status(403).json({ message: "Permission denied." });
      if (check.rows[0].status !== "pending")
        return res.status(409).json({
          message: `Request is no longer pending (status: ${check.rows[0].status}).`,
        });
      return res.status(500).json({ message: "Failed to update request." }); // Should not happen if checks pass
    }

    console.log(`Update Request Status: Success for Link ${linkId}`);
    res.status(200).json({ message: `Request ${status}.`, link: rows[0] });
  } catch (error) {
    console.error("[Update Request Status] Error:", error);
    next(error);
  }
};

// GET /api/coaches/athletes?status=accepted (Coach views)
exports.getLinkedAthletes = async (req, res, next) => {
  const coachUserId = req.user.userId;
  const status = req.query.status || "accepted"; // Default to accepted
  if (!["accepted", "pending", "declined", "revoked"].includes(status)) {
    return res.status(400).json({ message: "Invalid status filter." });
  }

  console.log(`Get Linked Athletes: Coach ${coachUserId}, Status ${status}`);
  try {
    // Fetch athletes linked TO this coach with the specified status
    const query = `
            SELECT l.link_id, l.athlete_user_id, l.status, l.requested_by, l.created_at as link_created_at,
                   u.user_id, u.first_name, u.last_name, u.email, u.profile_picture_url, u.strava_id
            FROM coach_athlete_links l
            JOIN users u ON l.athlete_user_id = u.user_id
            WHERE l.coach_user_id = $1 AND l.status = $2
            ORDER BY u.last_name, u.first_name;
        `;
    const { rows } = await db.query(query, [coachUserId, status]);
    console.log(
      `Get Linked Athletes: Found ${rows.length} athletes with status ${status}.`
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error("[Get Linked Athletes] Error:", error);
    next(error);
  }
};

// GET /api/athletes/mycoaches (Athlete views - Optional Example)
exports.getMyCoaches = async (req, res, next) => {
  const athleteUserId = req.user.userId;
  const status = req.query.status || "accepted"; // Default to accepted
  if (!["accepted", "pending", "declined", "revoked"].includes(status)) {
    return res.status(400).json({ message: "Invalid status filter." });
  }

  console.log(`Get My Coaches: Athlete ${athleteUserId}, Status ${status}`);
  try {
    // Fetch coaches linked TO this athlete
    const query = `
             SELECT l.link_id, l.coach_user_id, l.status, l.requested_by, l.created_at as link_created_at,
                    u.user_id, u.first_name, u.last_name, u.email, u.profile_picture_url
             FROM coach_athlete_links l
             JOIN users u ON l.coach_user_id = u.user_id
             WHERE l.athlete_user_id = $1 AND l.status = $2
             ORDER BY u.last_name, u.first_name;
         `;
    const { rows } = await db.query(query, [athleteUserId, status]);
    console.log(
      `Get My Coaches: Found ${rows.length} coaches with status ${status}.`
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error("[Get My Coaches] Error:", error);
    next(error);
  }
};

// DELETE /api/coaches/link/:linkId (Coach or Athlete revokes)
exports.revokeLink = async (req, res, next) => {
  const requestingUserId = req.user.userId;
  const { linkId } = req.params;
  const linkIdInt = parseInt(linkId, 10);
  if (isNaN(linkIdInt))
    return res.status(400).json({ message: "Invalid Link ID." });

  console.log(`Revoke Link: User ${requestingUserId}, Link ${linkId}`);
  try {
    // Delete the link if the requesting user is either the coach or athlete in that link
    // We could also change status to 'revoked' instead of deleting
    const query = `
             DELETE FROM coach_athlete_links
             WHERE link_id = $1 AND (coach_user_id = $2 OR athlete_user_id = $2)
             RETURNING link_id;
         `;
    const { rowCount } = await db.query(query, [linkIdInt, requestingUserId]);

    if (rowCount === 0) {
      // Check if link exists but user wasn't part of it
      const check = await db.query(
        "SELECT 1 FROM coach_athlete_links WHERE link_id=$1",
        [linkIdInt]
      );
      return res.status(check.rowCount === 0 ? 404 : 403).json({
        message:
          check.rowCount === 0 ? "Link not found." : "Permission denied.",
      });
    }

    console.log(
      `Revoke Link: Success for Link ${linkId} by User ${requestingUserId}`
    );
    res.status(200).json({ message: "Link revoked successfully." });
  } catch (error) {
    console.error("[Revoke Link] Error:", error);
    next(error);
  }
};

// REPLACE/ADD THIS FUNCTION in backend/controllers/coachController.js

/**
 * @desc    Get activities for a specific linked athlete
 * @route   GET /api/coaches/athletes/:athleteId/activities
 * @access  Private/Coach
 */
exports.getAthleteActivities = async (req, res, next) => {
  const coachUserId = req.user.userId; // Coach making the request (from auth middleware)
  const { athleteId } = req.params; // Athlete whose activities are requested (from URL param)

  const athleteIdInt = parseInt(athleteId, 10);
  if (isNaN(athleteIdInt)) {
    return res.status(400).json({ message: "Invalid Athlete ID provided." });
  }

  console.log(
    `[Ctrl-getAthleteActivities] Coach ${coachUserId} requesting activities for Athlete ${athleteIdInt}`
  );

  try {
    // 1. Security Check: Verify the coach is linked and the link is 'accepted'
    const linkCheckQuery = `
            SELECT 1 FROM coach_athlete_links
            WHERE coach_user_id = $1 AND athlete_user_id = $2 AND status = 'accepted';
        `;
    const linkCheck = await db.query(linkCheckQuery, [
      coachUserId,
      athleteIdInt,
    ]);

    if (linkCheck.rowCount === 0) {
      console.warn(
        `[Ctrl-getAthleteActivities] Auth Failure: Coach ${coachUserId} not linked/accepted for Athlete ${athleteIdInt}`
      );
      return res
        .status(403) // Forbidden - correct status code for authorization failure
        .json({ message: "Not authorized to view this athlete's activities." });
    }
    console.log(
      `[Ctrl-getAthleteActivities] Authorization successful for Coach ${coachUserId} -> Athlete ${athleteIdInt}`
    );

    // 2. Fetch Activities for the specified athlete from the 'activities' table
    const activitiesQuery = `
            SELECT
                activity_id,          -- Primary Key
                user_id,              -- Belongs to this athlete
                strava_activity_id,   -- Original Strava ID
                name,                 -- Activity name
                type,                 -- Run, Ride, etc.
                start_date_local,     -- Local time activity started
                timezone,             -- Timezone of the activity
                distance,             -- In meters (as 'real')
                moving_time,          -- In seconds (as 'integer')
                elapsed_time,         -- In seconds (as 'integer')
                total_elevation_gain, -- In meters (as 'real')
                average_speed,        -- Meters/second (as 'real')
                max_speed,            -- Meters/second (as 'real')
                average_heartrate,    -- BPM (as 'real')
                max_heartrate,        -- BPM (as 'real')
                calories,             -- (Assuming this column exists, wasn't explicitly in dump but is common)
                mental_mood,          -- 1-5 integer
                mental_focus,         -- 1-5 integer
                mental_stress,        -- 1-5 integer
                mental_notes          -- Text notes
                -- description was not in the schema, removed it
            FROM activities
            WHERE user_id = $1        -- Filter by the athlete's user_id
            ORDER BY start_date_local DESC; -- Show most recent first
        `;
    const { rows: activities } = await db.query(activitiesQuery, [
      athleteIdInt,
    ]);
    console.log(
      `[Ctrl-getAthleteActivities] Found ${activities.length} activities for Athlete ${athleteIdInt}`
    );

    // 3. Process/Format Data for Frontend Consistency (Optional but recommended)
    //    This adds useful derived/formatted fields like pace and formatted times.
    const processedActivities = activities.map((act) => {
      // Helper to format time in seconds to H:MM:SS or MM:SS string
      const formatTime = (seconds) => {
        if (seconds === null || seconds === undefined || isNaN(seconds))
          return "N/A";
        const totalSeconds = Math.round(seconds);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        let timeString = "";
        if (h > 0) timeString += `${h}h `;
        timeString += `${m.toString().padStart(h > 0 ? 2 : 1, "0")}m `; // Pad minutes if hours exist
        timeString += `${s.toString().padStart(2, "0")}s`;
        return timeString.trim(); // Remove trailing space if only seconds
      };

      // Calculate distance in km
      const distanceKm =
        act.distance !== null && !isNaN(act.distance)
          ? (act.distance / 1000).toFixed(2)
          : null;

      // Calculate pace (minutes per kilometer)
      let pacePerKm = "N/A";
      if (
        act.moving_time > 0 &&
        act.distance > 0 &&
        !isNaN(act.moving_time) &&
        !isNaN(act.distance)
      ) {
        const paceDecimal = act.moving_time / 60 / (act.distance / 1000);
        const paceMinutes = Math.floor(paceDecimal);
        const paceSeconds = Math.round((paceDecimal - paceMinutes) * 60);
        pacePerKm = `${paceMinutes}:${paceSeconds
          .toString()
          .padStart(2, "0")} /km`;
      }

      // Format average heart rate (if available)
      const avgHrFormatted =
        act.average_heartrate !== null && !isNaN(act.average_heartrate)
          ? `${act.average_heartrate.toFixed(0)} bpm`
          : "N/A";

      return {
        ...act, // Include all original fields from the DB query
        distance_km: distanceKm ? parseFloat(distanceKm) : null, // Add distance in km as a number
        moving_time_formatted: formatTime(act.moving_time), // Add formatted moving time string
        elapsed_time_formatted: formatTime(act.elapsed_time), // Add formatted elapsed time string
        pace_per_km: pacePerKm, // Add formatted pace string
        average_heartrate_formatted: avgHrFormatted, // Add formatted HR string
        // Keep raw numeric values as well if needed for charts etc.
      };
    });

    // 4. Send the processed activities back to the client
    res.status(200).json(processedActivities);
  } catch (error) {
    console.error("[Ctrl-getAthleteActivities] Error:", error);
    next(error); // Pass error to the centralized error handler
  }
};
