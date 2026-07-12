const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({
      status: "ERROR",
      message: "Authentication required"
    });
  }

  const token = header.substring(7);

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({
      status: "ERROR",
      message: "Invalid or expired token"
    });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        status: "ERROR",
        message: "Insufficient permission"
      });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  requireRole
};