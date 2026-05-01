const express = require("express");
const { db } = require("../db");
const { requireAuth } = require("../auth");

const router = express.Router();

router.get("/me", requireAuth, async (req, res) => {
  const userId = Number(req.auth.sub);
  const result = await db.query(
    `SELECT id, email, display_name AS "displayName", created_at AS "createdAt"
     FROM users
     WHERE id = $1`,
    [userId]
  );
  if (result.rowCount === 0) {
    return res.status(404).json({ error: "User not found" });
  }
  return res.json(result.rows[0]);
});

module.exports = { userRouter: router };
