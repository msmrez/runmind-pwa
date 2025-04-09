// backend/routes/auth.js
const express = require("express");
const authController = require("../controllers/authController");
// Import middleware if needed for specific auth routes (e.g., /auth/me)
// const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
// Example protected route within auth:
// router.get('/me', authenticateToken, authController.getMe);

module.exports = router;
