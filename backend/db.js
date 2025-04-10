// backend/db.js
const { Pool } = require("pg");
require("dotenv").config(); // Ensure environment variables are loaded

// Determine database name based on environment
const isTestEnvironment = process.env.NODE_ENV === "test";
const dbName = isTestEnvironment
  ? process.env.TEST_DB_NAME || "runmind_test_db" // Use TEST_DB_NAME from .env or default
  : process.env.DB_DATABASE; // Use regular DB name otherwise (from .env)

console.log(`[DB Config] NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`[DB Config] Using database: ${dbName}`);

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: dbName, // <-- Use the determined database name
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  // Optional: SSL config
});

pool.on("connect", () => {
  // Log which DB it connected to for clarity
  console.log(
    `Connected to the Database: ${pool.options.database} on ${pool.options.host}!`
  );
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

// Add a function to cleanly close the pool (useful for test teardown)
const closePool = async () => {
  console.log(`[DB] Closing connection pool for ${pool.options.database}...`);
  await pool.end();
  console.log(`[DB] Pool for ${pool.options.database} closed.`);
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool: pool, // Export the pool itself
  closePool: closePool, // <-- Export the close function
};
