// backend/db.js
const { Pool } = require('pg');
require('dotenv').config(); // Ensure environment variables are loaded

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    // Optional: Add SSL configuration if connecting to a remote DB securely
    // ssl: {
    //   rejectUnauthorized: false // Adjust as needed for your DB provider
    // }
});

pool.on('connect', () => {
    console.log('Connected to the Database!');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1); // Exit the process if the pool encounters a fatal error
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool: pool // Export the pool itself if needed for transactions etc.
};