// backend/tests/trainingNotesRoutes.test.js
const request = require("supertest");
const { app } = require("../server.js"); // Import only app
const { pool } = require("../db.js"); // Import pool for setup (setup.js handles closing)
const jwt = require("jsonwebtoken");

// Load JWT Secret
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const JWT_SECRET =
  process.env.JWT_SECRET || "YOUR_REALLY_STRONG_SECRET_KEY_HERE";
if (JWT_SECRET === "YOUR_REALLY_STRONG_SECRET_KEY_HERE") {
  console.warn(
    "!!! WARNING: Using default JWT_SECRET in trainingNotes tests !!!"
  );
}

// --- Test Data Setup Variables ---
let coachUser, athleteUserLinked, athleteUserUnlinked, runnerUser;
let coachToken, runnerToken, athleteToken; // Need athlete token too
let linkId;
let noteId; // To store ID of created note

// beforeEach: Setup fresh data before EACH test case
// This ensures tests are independent
beforeEach(async () => {
  console.log("[Test trainingNotes] Setting up test data...");
  try {
    // Create Users
    const coachRes = await pool.query(
      "INSERT INTO users (email, password, role, first_name) VALUES ('coach-tn@test.com', 'pw', 'coach', 'CoachTN') RETURNING user_id, email, role"
    );
    coachUser = coachRes.rows[0];
    coachToken = jwt.sign(
      {
        userId: coachUser.user_id,
        email: coachUser.email,
        role: coachUser.role,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    const athleteLinkedRes = await pool.query(
      "INSERT INTO users (email, password, role, first_name) VALUES ('linked-tn@test.com', 'pw', 'runner', 'AthleteTN') RETURNING user_id, email, role"
    );
    athleteUserLinked = athleteLinkedRes.rows[0];
    athleteToken = jwt.sign(
      {
        userId: athleteUserLinked.user_id,
        email: athleteUserLinked.email,
        role: athleteUserLinked.role,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    const athleteUnlinkedRes = await pool.query(
      "INSERT INTO users (email, password, role, first_name) VALUES ('unlinked-tn@test.com', 'pw', 'runner', 'UnlinkedTN') RETURNING user_id, email, role"
    );
    athleteUserUnlinked = athleteUnlinkedRes.rows[0];

    // Create an 'accepted' link between coachUser and athleteUserLinked
    const linkRes = await pool.query(
      "INSERT INTO coach_athlete_links (coach_user_id, athlete_user_id, status, requested_by) VALUES ($1, $2, 'accepted', 'coach') RETURNING link_id",
      [coachUser.user_id, athleteUserLinked.user_id]
    );
    linkId = linkRes.rows[0].link_id;

    // Optional: Create a pre-existing note for GET tests
    const noteRes = await pool.query(
      "INSERT INTO training_notes (coach_user_id, athlete_user_id, note_date, instructions) VALUES ($1, $2, $3, $4) RETURNING note_id",
      [
        coachUser.user_id,
        athleteUserLinked.user_id,
        "2024-01-15",
        "Existing Note Text",
      ]
    );
    noteId = noteRes.rows[0].note_id;

    console.log("[Test trainingNotes] Setup complete.");
  } catch (error) {
    console.error("!!! Test trainingNotes setup failed !!!", error);
    throw error;
  }
});

// --- Test Suite ---

// == Tests for Coach Actions ==
describe("Training Notes API - Coach Actions", () => {
  // POST /api/coaches/athletes/:athleteId/training_notes
  describe("POST /api/coaches/athletes/:athleteId/training_notes", () => {
    it("should allow a linked coach to create a training note for their athlete", async () => {
      const noteData = {
        noteDate: "2024-01-16",
        instructions: "New test note",
      };
      const response = await request(app)
        .post(
          `/api/coaches/athletes/${athleteUserLinked.user_id}/training_notes`
        )
        .set("Authorization", `Bearer ${coachToken}`)
        .send(noteData);

      expect(response.statusCode).toBe(201);
      expect(response.body.message).toMatch(/created successfully/i);
      expect(response.body.note).toHaveProperty("note_id");
    });

    it("should return 400 if noteDate is missing", async () => {
      const noteData = { instructions: "Missing date" };
      const response = await request(app)
        .post(
          `/api/coaches/athletes/${athleteUserLinked.user_id}/training_notes`
        )
        .set("Authorization", `Bearer ${coachToken}`)
        .send(noteData);
      expect(response.statusCode).toBe(400);
      expect(response.body.message).toMatch(
        /date and instructions are required/i
      );
    });

    it("should return 400 if instructions are missing or empty", async () => {
      const noteData = { noteDate: "2024-01-17", instructions: "  " }; // Empty instructions
      const response = await request(app)
        .post(
          `/api/coaches/athletes/${athleteUserLinked.user_id}/training_notes`
        )
        .set("Authorization", `Bearer ${coachToken}`)
        .send(noteData);
      expect(response.statusCode).toBe(400);
      expect(response.body.message).toMatch(
        /date and instructions are required/i
      );
    });

    it("should return 403 if coach tries to create note for unlinked athlete", async () => {
      const noteData = { noteDate: "2024-01-18", instructions: "Should fail" };
      const response = await request(app)
        .post(
          `/api/coaches/athletes/${athleteUserUnlinked.user_id}/training_notes`
        ) // Use unlinked athlete ID
        .set("Authorization", `Bearer ${coachToken}`)
        .send(noteData);
      expect(response.statusCode).toBe(403);
      expect(response.body.message).toMatch(/Not authorized/i);
    });

    it("should return 403 if a runner tries to create a note via coach route", async () => {
      const noteData = {
        noteDate: "2024-01-19",
        instructions: "Runner cannot post",
      };
      const response = await request(app)
        .post(
          `/api/coaches/athletes/${athleteUserLinked.user_id}/training_notes`
        )
        .set("Authorization", `Bearer ${athleteToken}`) // Use athlete's token
        .send(noteData);
      expect(response.statusCode).toBe(403); // Expect checkRole to deny
      expect(response.body.message).toMatch(/Permission denied|role required/i);
    });
  });

  // GET /api/coaches/athletes/:athleteId/training_notes
  describe("GET /api/coaches/athletes/:athleteId/training_notes", () => {
    it("should allow a linked coach to view notes sent to their athlete", async () => {
      const response = await request(app)
        .get(
          `/api/coaches/athletes/${athleteUserLinked.user_id}/training_notes`
        )
        .set("Authorization", `Bearer ${coachToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThanOrEqual(1); // At least the one created in setup
      expect(response.body[0].note_id).toBe(noteId);
      expect(response.body[0].instructions).toBe("Existing Note Text");
    });

    it("should return 403 if coach tries to view notes for unlinked athlete", async () => {
      const response = await request(app)
        .get(
          `/api/coaches/athletes/${athleteUserUnlinked.user_id}/training_notes`
        )
        .set("Authorization", `Bearer ${coachToken}`);
      expect(response.statusCode).toBe(403);
    });

    it("should return 403 if a runner tries to view notes via coach route", async () => {
      const response = await request(app)
        .get(
          `/api/coaches/athletes/${athleteUserLinked.user_id}/training_notes`
        )
        .set("Authorization", `Bearer ${athleteToken}`);
      expect(response.statusCode).toBe(403);
    });

    it("should return an empty array if athlete is linked but has no notes from this coach", async () => {
      // Create another linked athlete with no notes from THIS coach
      const athleteNoNotesRes = await pool.query(
        "INSERT INTO users (email, password, role) VALUES ('nonotes@test.com', 'pw', 'runner') RETURNING user_id"
      );
      const athleteNoNotesId = athleteNoNotesRes.rows[0].user_id;
      await pool.query(
        "INSERT INTO coach_athlete_links (coach_user_id, athlete_user_id, status, requested_by) VALUES ($1, $2, 'accepted', 'coach')",
        [coachUser.user_id, athleteNoNotesId]
      );

      const response = await request(app)
        .get(`/api/coaches/athletes/${athleteNoNotesId}/training_notes`)
        .set("Authorization", `Bearer ${coachToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(0);
    });
  });
});

// == Tests for Athlete Actions ==
describe("Training Notes API - Athlete Actions", () => {
  // GET /api/users/training_notes
  describe("GET /api/users/training_notes", () => {
    it("should allow a runner to get their own training notes", async () => {
      const response = await request(app)
        .get("/api/users/training_notes") // Athlete's endpoint
        .set("Authorization", `Bearer ${athleteToken}`); // Use athlete's token

      expect(response.statusCode).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0].note_id).toBe(noteId);
      expect(response.body[0].instructions).toBe("Existing Note Text");
      expect(response.body[0]).toHaveProperty("coach_first_name"); // Check for joined coach data
    });

    it("should return 403 if a coach tries to use the athlete route", async () => {
      const response = await request(app)
        .get("/api/users/training_notes")
        .set("Authorization", `Bearer ${coachToken}`); // Use coach's token
      expect(response.statusCode).toBe(403); // checkRole should deny
    });

    it("should return an empty array if athlete has no notes", async () => {
      // Use the unlinked athlete's token (they have no notes sent to them)
      const unlinkedAthleteToken = jwt.sign(
        {
          userId: athleteUserUnlinked.user_id,
          email: athleteUserUnlinked.email,
          role: athleteUserUnlinked.role,
        },
        JWT_SECRET,
        { expiresIn: "1h" }
      );
      const response = await request(app)
        .get("/api/users/training_notes")
        .set("Authorization", `Bearer ${unlinkedAthleteToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(0);
    });
  });
});

// Note: afterAll is handled by tests/setup.js
