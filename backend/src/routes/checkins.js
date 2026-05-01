const express = require("express");
const { z } = require("zod");
const { db } = require("../db");
const { requireAuth } = require("../auth");

const router = express.Router();

const createCheckinSchema = z.object({
  userId: z.number().int().positive(),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  moodScore: z.number().int().min(1).max(10).optional()
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = createCheckinSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const { userId, dateKey, moodScore } = parsed.data;
  if (Number(req.auth.sub) !== userId) {
    return res.status(403).json({ error: "Cannot write check-in for another user" });
  }
  try {
    await db.query(
      `INSERT INTO checkins (user_id, date_key, mood_score)
       VALUES ($1, $2, $3)`,
      [userId, dateKey, moodScore ?? null]
    );
    return res.status(201).json({ ok: true });
  } catch {
    return res.status(409).json({ error: "Check-in already exists for this date" });
  }
});

router.get("/:userId", requireAuth, async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: "Invalid userId" });
  }
  if (Number(req.auth.sub) !== userId) {
    return res.status(403).json({ error: "Cannot read check-in for another user" });
  }

  const rows = await db.query(
    `SELECT id, date_key AS "dateKey", mood_score AS "moodScore", created_at AS "createdAt"
     FROM checkins
     WHERE user_id = $1
     ORDER BY date_key DESC`,
    [userId]
  );
  return res.json({ items: rows.rows });
});

module.exports = { checkinRouter: router };
