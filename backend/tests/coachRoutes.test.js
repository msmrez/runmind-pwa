// backend/tests/coachRoutes.test.js
const request = require("supertest");
const { app } = require("../server.js");
const { pool, closePool } = require("../db.js");
const jwt = require("jsonwebtoken");

require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const JWT_SECRET =
  process.env.JWT_SECRET || "YOUR_REALLY_STRONG_SECRET_KEY_HERE";
if (JWT_SECRET === "YOUR_REALLY_STRONG_SECRET_KEY_HERE") {
  console.warn("!!! WARNING: Using default JWT_SECRET in tests !!!");
}

// --- Test Data Setup Variables ---
// Declare them here, they will be assigned in beforeEach
let coachUser, athleteUserLinked, athleteUserUnlinked, runnerUser;
let coachToken, runnerToken;
let linkId;
let activityId;

// beforeAll: Could be used for one-time setup if needed (like connecting DB if not handled elsewhere)
// For now, we don't need anything specific here as setup.js handles pool closing.
// beforeAll(async () => { });

// beforeEach: Setup fresh data before EACH test case
beforeEach(async () => {
  console.log("[Test coachRoutes] Setting up test data for test case...");
  try {
    // --- Create Users ---
    const coachRes = await pool.query(
      "INSERT INTO users (email, password, role, first_name, last_name) VALUES ($1, $2, 'coach', $3, $4) RETURNING user_id, email, role",
      ["coach@test.com", "password123", "Coach", "Test"]
    );
    coachUser = coachRes.rows[0];

    const athleteLinkedRes = await pool.query(
      "INSERT INTO users (email, password, role, first_name, last_name) VALUES ($1, $2, 'runner', $3, $4) RETURNING user_id, email, role",
      ["linked@test.com", "password123", "Linked", "Athlete"]
    );
    athleteUserLinked = athleteLinkedRes.rows[0];

    const athleteUnlinkedRes = await pool.query(
      "INSERT INTO users (email, password, role, first_name, last_name) VALUES ($1, $2, 'runner', $3, $4) RETURNING user_id, email, role",
      ["unlinked@test.com", "password123", "Unlinked", "Athlete"]
    );
    athleteUserUnlinked = athleteUnlinkedRes.rows[0];

    const runnerRes = await pool.query(
      "INSERT INTO users (email, password, role, first_name, last_name) VALUES ($1, $2, 'runner', $3, $4) RETURNING user_id, email, role",
      ["runner@test.com", "password123", "Runner", "Test"]
    );
    runnerUser = runnerRes.rows[0];

    // --- Generate Tokens ---
    const coachPayload = {
      userId: coachUser.user_id,
      email: coachUser.email,
      role: coachUser.role,
    };
    coachToken = jwt.sign(coachPayload, JWT_SECRET, { expiresIn: "1h" });

    const runnerPayload = {
      userId: runnerUser.user_id,
      email: runnerUser.email,
      role: runnerUser.role,
    };
    runnerToken = jwt.sign(runnerPayload, JWT_SECRET, { expiresIn: "1h" });

    // --- Create 'accepted' Link for relevant tests ---
    const linkRes = await pool.query(
      "INSERT INTO coach_athlete_links (coach_user_id, athlete_user_id, status, requested_by) VALUES ($1, $2, 'accepted', 'athlete') RETURNING link_id",
      [coachUser.user_id, athleteUserLinked.user_id]
    );
    linkId = linkRes.rows[0].link_id;

    // --- Create Activity for linked athlete ---
    const activityRes = await pool.query(
      "INSERT INTO activities (user_id, strava_activity_id, name, type, distance, moving_time) VALUES ($1, $2, $3, 'Run', 5000, 1500) RETURNING activity_id",
      [athleteUserLinked.user_id, Date.now(), "Test Run"]
    );
    activityId = activityRes.rows[0].activity_id;

    console.log("[Test coachRoutes] Test data setup complete for test case.");
  } catch (error) {
    console.error("!!! Test data setup failed for test case !!!", error);
    throw error; // Stop the test if setup fails
  }
});

// afterAll: Handled by setup.js closing the pool.
// afterAll(async () => { });

// --- Test Suite ---
describe("GET /api/coaches/athletes/:athleteId/activities", () => {
  // Test cases remain the same

  // Test Case 1: Success
  it("should return 200 and activities for linked athlete", async () => {
    // Data is now freshly set up by beforeEach
    const response = await request(app)
      .get(`/api/coaches/athletes/${athleteUserLinked.user_id}/activities`)
      .set("Authorization", `Bearer ${coachToken}`);
    expect(response.statusCode).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBe(1);
    expect(response.body[0].activity_id).toBe(activityId);
    expect(response.body[0].name).toBe("Test Run");
    expect(response.body[0]).toHaveProperty("pace_per_km");
  });

  // Test Case 2: Fail - Incorrect Coach (uses unlinked athlete ID)
  it("should return 403 if coach not linked", async () => {
    const response = await request(app)
      .get(`/api/coaches/athletes/${athleteUserUnlinked.user_id}/activities`)
      .set("Authorization", `Bearer ${coachToken}`);
    expect(response.statusCode).toBe(403);
    expect(response.body.message).toMatch(/Not authorized/i);
  });

  // Test Case 3: Fail - Incorrect Role
  it("should return 403 if requested by a runner", async () => {
    const response = await request(app)
      .get(`/api/coaches/athletes/${athleteUserLinked.user_id}/activities`)
      .set("Authorization", `Bearer ${runnerToken}`);
    expect(response.statusCode).toBe(403);
    expect(response.body.message).toMatch(/Permission denied|role required/i);
  });

  // Test Case 4: Fail - No Token
  it("should return 401 if no token provided", async () => {
    const response = await request(app).get(
      `/api/coaches/athletes/${athleteUserLinked.user_id}/activities`
    );
    expect(response.statusCode).toBe(401);
  });

  // Test Case 5: Fail - Invalid ID
  it("should return 400 if athleteId is invalid", async () => {
    const response = await request(app)
      .get(`/api/coaches/athletes/invalid-id/activities`)
      .set("Authorization", `Bearer ${coachToken}`);
    expect(response.statusCode).toBe(400);
    expect(response.body.message).toMatch(/Invalid Athlete ID/i);
  });

  // Test Case 6: Success - Empty Array (Athlete linked, no activities)
  it("should return 200 and empty array if athlete has no activities", async () => {
    // Setup specific to this test: Create a different athlete with NO activities
    const athleteNoActsRes = await pool.query(
      "INSERT INTO users (email, password, role) VALUES ('noacts@test.com', 'pw', 'runner') RETURNING user_id"
    );
    const athleteNoActsId = athleteNoActsRes.rows[0].user_id;
    // Link this new athlete to the coach
    await pool.query(
      "INSERT INTO coach_athlete_links (coach_user_id, athlete_user_id, status, requested_by) VALUES ($1, $2, 'accepted', 'coach')",
      [coachUser.user_id, athleteNoActsId]
    );

    // Now make the request for this athlete
    const response = await request(app)
      .get(`/api/coaches/athletes/${athleteNoActsId}/activities`)
      .set("Authorization", `Bearer ${coachToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBe(0); // Expect empty array
  });
});
