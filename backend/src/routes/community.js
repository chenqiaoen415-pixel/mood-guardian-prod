const express = require("express");
const { z } = require("zod");
const { db } = require("../db");
const { requireAuth } = require("../auth");

const router = express.Router();

const createPostSchema = z.object({
  userId: z.number().int().positive(),
  type: z.enum(["story", "win", "question", "music", "photo"]),
  topic: z.string().min(1).max(60),
  content: z.string().min(1).max(1000),
  mediaUrl: z.string().url().optional()
});

const createCommentSchema = z.object({
  userId: z.number().int().positive(),
  content: z.string().min(1).max(500)
});

router.post("/posts", requireAuth, async (req, res) => {
  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }
  const { userId, type, topic, content, mediaUrl } = parsed.data;
  if (Number(req.auth.sub) !== userId) {
    return res.status(403).json({ error: "Cannot create post for another user" });
  }
  const result = await db.query(
    `INSERT INTO posts (user_id, type, topic, content, media_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, type, topic, content, mediaUrl ?? null]
  );
  return res.status(201).json({ id: result.rows[0].id });
});

router.get("/posts", async (req, res) => {
  const type = req.query.type;
  const sql =
    type && typeof type === "string" && type !== "all"
      ? `SELECT id, user_id AS "userId", type, topic, content, media_url AS "mediaUrl", likes, hidden, created_at AS "createdAt" FROM posts WHERE type = $1 ORDER BY id DESC`
      : `SELECT id, user_id AS "userId", type, topic, content, media_url AS "mediaUrl", likes, hidden, created_at AS "createdAt" FROM posts ORDER BY id DESC`;
  const items = type && typeof type === "string" && type !== "all"
    ? (await db.query(sql, [type])).rows
    : (await db.query(sql)).rows;
  return res.json({ items });
});

router.post("/posts/:postId/like", requireAuth, async (req, res) => {
  const postId = Number(req.params.postId);
  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ error: "Invalid postId" });
  }
  await db.query("UPDATE posts SET likes = likes + 1 WHERE id = $1", [postId]);
  return res.json({ ok: true });
});

router.post("/posts/:postId/comments", requireAuth, async (req, res) => {
  const postId = Number(req.params.postId);
  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ error: "Invalid postId" });
  }
  const parsed = createCommentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }
  const { userId, content } = parsed.data;
  if (Number(req.auth.sub) !== userId) {
    return res.status(403).json({ error: "Cannot create comment for another user" });
  }
  const result = await db.query(
    `INSERT INTO comments (post_id, user_id, content)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [postId, userId, content]
  );
  return res.status(201).json({ id: result.rows[0].id });
});

router.get("/posts/:postId/comments", async (req, res) => {
  const postId = Number(req.params.postId);
  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ error: "Invalid postId" });
  }
  const result = await db.query(
    `SELECT id, post_id AS "postId", user_id AS "userId", content, created_at AS "createdAt"
     FROM comments
     WHERE post_id = $1
     ORDER BY id ASC`,
    [postId]
  );
  return res.json({ items: result.rows });
});

module.exports = { communityRouter: router };
