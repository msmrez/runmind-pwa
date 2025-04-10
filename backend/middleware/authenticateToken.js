// backend/middleware/authenticateToken.js
const jwt = require("jsonwebtoken");
const JWT_SECRET =
  process.env.JWT_SECRET || "YOUR_REALLY_STRONG_SECRET_KEY_HERE"; // Load from .env!

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  // console.log("[VerifyToken] Checking for token..."); // Keep logs minimal or remove later

  if (token == null) {
    // console.log("[VerifyToken] No token found.");
    return res.status(401).json({ message: "Authentication token required." });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error("[VerifyToken] Token verification failed:", err.message);
      return res.status(403).json({ message: "Invalid or expired token." });
    }
    // Attach decoded payload to request (contains userId, email, etc.)
    req.user = decoded; // Standard practice to attach to req.user
    console.log(
      `[VerifyToken] Token valid for user ID: ${req.user.userId}, Email: ${req.user.email}, Role: ${req.user.role}`
    );
    next();
  });
};

module.exports = authenticateToken; // Export the middleware function
