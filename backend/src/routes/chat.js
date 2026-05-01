const express = require("express");
const { z } = require("zod");
const { db } = require("../db");
const { requireAuth } = require("../auth");

const router = express.Router();

const riskWords = ["自杀", "不想活", "伤害自己", "结束生命", "轻生"];

const sendSchema = z.object({
  userId: z.number().int().positive(),
  message: z.string().min(1).max(2000)
});

function buildReply(message) {
  const text = message.trim();
  if (riskWords.some((word) => text.includes(word))) {
    return {
      content:
        "我听到你现在非常痛苦。请立刻联系当地紧急服务与可信任的人；如果你愿意，我会继续陪你慢慢呼吸。",
      riskDetected: true
    };
  }
  if (text.includes("焦虑") || text.includes("紧张")) {
    return {
      content: "先做 4-2-6 呼吸 5 轮，再告诉我焦虑分值变化，我和你继续拆解压力源。",
      riskDetected: false
    };
  }
  if (text.includes("难过") || text.includes("伤心")) {
    return {
      content: "谢谢你说出来。愿意从“最刺痛的一句话”开始吗？我们先区分想法和事实。",
      riskDetected: false
    };
  }
  return {
    content: "我在认真听。你现在最希望先解决哪一件事？我们一步一步来。",
    riskDetected: false
  };
}

router.post("/send", requireAuth, async (req, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }
  const { userId, message } = parsed.data;
  if (Number(req.auth.sub) !== userId) {
    return res.status(403).json({ error: "Cannot send message for another user" });
  }

  await db.query(
    `INSERT INTO chat_messages (user_id, role, content, risk_detected)
     VALUES ($1, 'user', $2, FALSE)`,
    [userId, message]
  );

  const reply = buildReply(message);
  await db.query(
    `INSERT INTO chat_messages (user_id, role, content, risk_detected)
     VALUES ($1, 'assistant', $2, $3)`,
    [userId, reply.content, reply.riskDetected]
  );

  return res.json(reply);
});

router.get("/history/:userId", requireAuth, async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: "Invalid userId" });
  }
  if (Number(req.auth.sub) !== userId) {
    return res.status(403).json({ error: "Cannot read chat for another user" });
  }
  const result = await db.query(
    `SELECT id, role, content, risk_detected AS "riskDetected", created_at AS "createdAt"
     FROM chat_messages
     WHERE user_id = $1
     ORDER BY id ASC`,
    [userId]
  );
  return res.json({ items: result.rows });
});

module.exports = { chatRouter: router };
