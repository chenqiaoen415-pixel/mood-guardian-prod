require("dotenv").config();

const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 8787),
  dbUrl:
    process.env.DATABASE_URL ||
    "postgresql://mood_guardian:mood_guardian@localhost:5432/mood_guardian",
  jwtSecret: process.env.JWT_SECRET || "replace-me-in-production",
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",
  refreshTokenExpiresInDays: Number(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS || 30),
  adminSecret: process.env.ADMIN_SECRET || "replace-admin-secret"
};

module.exports = { config };
