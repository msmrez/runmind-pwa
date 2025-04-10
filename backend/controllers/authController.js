// backend/controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db"); // Adjust path if needed
const JWT_SECRET =
  process.env.JWT_SECRET || "YOUR_REALLY_STRONG_SECRET_KEY_HERE";

exports.register = async (req, res) => {
  const { email, password, firstName, lastName, role = "runner" } = req.body;
  const allowedRoles = ["runner", "coach"];
  console.log(`[Auth Ctrl] Register attempt: ${email}, role=${role}`);
  if (!email || !password || !firstName) {
    return res
      .status(400)
      .json({ message: "Email, password, and first name required." });
  }
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({
      message: "Invalid role specified. Must be 'runner' or 'coach'.",
    });
  }
  try {
    const findUserQuery = "SELECT user_id FROM users WHERE email = $1";
    const existingUser = await db.query(findUserQuery, [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: "Email already in use." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const insertQuery = `
    INSERT INTO users (email, password, first_name, last_name, role, is_premium)
    VALUES ($1, $2, $3, $4, $5, FALSE)
    RETURNING user_id, email, first_name, last_name, role, is_premium;
`;
    const values = [
      email.toLowerCase(),
      hashedPassword,
      firstName,
      lastName || null,
      role,
    ];
    const { rows } = await db.query(insertQuery, values);
    const newUser = rows[0];

    console.log(
      `[Auth Ctrl] Register success: ${newUser.email}, ID: ${newUser.user_id}, Role: ${newUser.role}`
    );
    res
      .status(201)
      .json({ message: "User registered successfully!", user: newUser });
  } catch (error) {
    console.error("[Auth Ctrl] Register Error:", error);
    res
      .status(500)
      .json({ message: "Registration failed.", error: error.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  console.log(`[Auth Ctrl] Login attempt: ${email}`);
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required." });
  }
  try {
    const findUserQuery =
      "SELECT user_id, email, password, first_name, last_name, role, is_premium, strava_id FROM users WHERE email = $1"; // Added last_name
    const { rows } = await db.query(findUserQuery, [email.toLowerCase()]);
    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials." });
    }
    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const payload = {
      userId: user.user_id,
      email: user.email,
      role: user.role,
      isPremium: user.is_premium,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

    console.log(
      `[Auth Ctrl] Login success: ${user.email}, ID: ${user.user_id}, Role: ${user.role}`
    );
    res.status(200).json({
      message: "Login successful!",
      token: token,
      user: {
        appUserId: user.user_id,
        email: user.email,
        firstname: user.first_name,
        lastname: user.last_name,
        role: user.role,
        isPremium: user.is_premium,
        isStravaConnected: !!user.strava_id
      },
    }); // Added lastname
  } catch (error) {
    console.error("[Auth Ctrl] Login Error:", error);
    res.status(500).json({ message: "Login failed.", error: error.message });
  }
};
