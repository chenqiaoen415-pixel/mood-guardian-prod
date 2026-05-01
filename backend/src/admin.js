const { config } = require("./config");

function requireAdmin(req, res, next) {
  const secret = req.headers["x-admin-secret"];
  if (!secret || secret !== config.adminSecret) {
    return res.status(403).json({ error: "Admin permission required" });
  }
  return next();
}

module.exports = { requireAdmin };
