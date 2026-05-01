const express = require("express");
const { z } = require("zod");
const { db } = require("../db");
const { requireAuth } = require("../auth");
const { requireAdmin } = require("../admin");

const router = express.Router();

const createReportSchema = z.object({
  postId: z.number().int().positive(),
  reason: z.string().min(4).max(300)
});

const reviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reviewerUserId: z.number().int().positive()
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = createReportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }
  const reporterUserId = Number(req.auth.sub);
  const { postId, reason } = parsed.data;

  const result = await db.query(
    `INSERT INTO reports (post_id, reporter_user_id, reason)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [postId, reporterUserId, reason]
  );
  return res.status(201).json({ id: result.rows[0].id });
});

router.get("/pending", requireAdmin, async (_req, res) => {
  const result = await db.query(
    `SELECT id, post_id AS "postId", reporter_user_id AS "reporterUserId", reason, status, created_at AS "createdAt"
     FROM reports
     WHERE status = 'pending'
     ORDER BY id ASC`
  );
  return res.json({ items: result.rows });
});

router.post("/:id/review", requireAdmin, async (req, res) => {
  const reportId = Number(req.params.id);
  if (!Number.isInteger(reportId) || reportId <= 0) {
    return res.status(400).json({ error: "Invalid report id" });
  }
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }
  const { action, reviewerUserId } = parsed.data;
  const nextStatus = action === "approve" ? "approved" : "rejected";

  const updated = await db.query(
    `UPDATE reports
     SET status = $1, reviewed_by = $2, reviewed_at = NOW()
     WHERE id = $3
     RETURNING id, post_id`,
    [nextStatus, reviewerUserId, reportId]
  );
  if (updated.rowCount === 0) {
    return res.status(404).json({ error: "Report not found" });
  }
  if (action === "approve") {
    await db.query(`UPDATE posts SET hidden = TRUE WHERE id = $1`, [updated.rows[0].post_id]);
  }
  return res.json({ ok: true, status: nextStatus });
});

module.exports = { reportRouter: router };
