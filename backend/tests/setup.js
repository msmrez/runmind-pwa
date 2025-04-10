// backend/tests/setup.js

// Use require since db.js uses module.exports
const { pool, closePool } = require("../db.js");

// Function to clear specific tables before each test
const clearTables = async () => {
  // List all tables that your tests might insert data into
  const tables = [
    "activities",
    "coach_athlete_links",
    "goals",
    "diary_entries",
    "diet_logs",
    "users",
  ];
  console.log("[Test Setup] Clearing test database tables:", tables.join(", "));
  const client = await pool.connect(); // Get a client from the pool for transaction
  try {
    await client.query("BEGIN"); // Start transaction
    for (const table of tables) {
      // TRUNCATE is faster than DELETE and resets sequences with RESTART IDENTITY
      // CASCADE handles foreign key constraints correctly during truncation
      await client.query(
        `TRUNCATE TABLE public.${table} RESTART IDENTITY CASCADE;`
      );
    }
    await client.query("COMMIT"); // Commit transaction
    console.log("[Test Setup] Test database tables cleared successfully.");
  } catch (error) {
    await client.query("ROLLBACK"); // Rollback on error
    console.error("[Test Setup] Error clearing test database tables:", error);
    throw error; // Ensure Jest knows setup failed
  } finally {
    client.release(); // Release the client back to the pool
  }
};

// Run before each test function in a file
beforeEach(async () => {
  await clearTables();
  // You can add common seed data here if needed for multiple tests
  // e.g., create a default coach user needed for many auth tests
});

// Run after all tests in a file/suite have finished
afterAll(async () => {
  // Close the pool to allow Jest to exit cleanly
  await closePool();
});
