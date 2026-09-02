const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.vybe_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Authentication required"
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.id,
      username: decoded.username
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: "Invalid or expired authentication"
    });
  }
}

/*
 * Optional authentication.
 * Public requests are allowed.
 * If a valid VYBE cookie exists, req.user is populated.
 */
function optionalAuth(req, res, next) {
  try {
    const token = req.cookies?.vybe_token;

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.id,
      username: decoded.username
    };
  } catch (error) {
    // Invalid/expired optional auth should not block public requests.
    req.user = null;
  }

  next();
}

module.exports = {
  requireAuth,
  optionalAuth
};
