// backend/middleware/checkRole.js

/**
 * Middleware to check if authenticated user has one of the allowed roles.
 * Assumes authenticateToken middleware has run first and set req.user.
 * @param {string[]} allowedRoles Array of role strings (e.g., ['coach', 'admin'])
 */
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      console.warn(
        "[CheckRole] User or role missing from request. Ensure authenticateToken runs first."
      );
      return res
        .status(403)
        .json({ message: "Permission denied: Role information missing." });
    }

    const hasRole = allowedRoles.includes(req.user.role);
    console.log(
      `[CheckRole] User role: ${req.user.role}. Allowed: ${allowedRoles.join(
        ","
      )}. HasRole: ${hasRole}`
    );

    if (!hasRole) {
      return res
        .status(403)
        .json({
          message: `Permission denied: Requires one of roles [${allowedRoles.join(
            ", "
          )}]`,
        });
    }

    next(); // User has the required role
  };
};

module.exports = checkRole;
