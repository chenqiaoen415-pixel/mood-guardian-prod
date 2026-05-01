const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { config } = require("./config");

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      displayName: user.display_name || user.displayName
    },
    config.jwtSecret,
    { expiresIn: config.accessTokenExpiresIn }
  );
}

function createRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }
  const token = authHeader.slice("Bearer ".length);
  try {
    req.auth = verifyAccessToken(token);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = {
  signAccessToken,
  createRefreshToken,
  hashToken,
  requireAuth
};
