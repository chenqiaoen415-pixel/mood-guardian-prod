const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const { db } = require("../db");
const { config } = require("../config");
const { signAccessToken, createRefreshToken, hashToken } = require("../auth");

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2).max(30),
  password: z.string().min(8).max(64)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(64)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(16)
});

function refreshExpiresAt() {
  const expires = new Date();
  expires.setDate(expires.getDate() + config.refreshTokenExpiresInDays);
  return expires;
}

async function issueRefreshToken(userId, replacedByTokenId = null) {
  const refreshToken = createRefreshToken();
  const inserted = await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [userId, hashToken(refreshToken), refreshExpiresAt().toISOString()]
  );
  const tokenId = inserted.rows[0].id;
  if (replacedByTokenId) {
    await db.query(
      `UPDATE refresh_tokens
       SET replaced_by = $1
       WHERE id = $2`,
      [tokenId, replacedByTokenId]
    );
  }
  return { refreshToken, tokenId };
}

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }

  const { email, displayName, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const inserted = await db.query(
      `INSERT INTO users (email, display_name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name`,
      [email, displayName, passwordHash]
    );
    const user = inserted.rows[0];
    const accessToken = signAccessToken(user);
    const { refreshToken } = await issueRefreshToken(user.id);
    return res.status(201).json({
      user: { id: user.id, email: user.email, displayName: user.display_name },
      accessToken,
      refreshToken
    });
  } catch {
    return res.status(409).json({ error: "Email already exists" });
  }
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }
  const { email, password } = parsed.data;
  const found = await db.query(
    `SELECT id, email, display_name, password_hash
     FROM users
     WHERE email = $1`,
    [email]
  );
  if (found.rowCount === 0) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const user = found.rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const accessToken = signAccessToken(user);
  const { refreshToken } = await issueRefreshToken(user.id);
  return res.json({
    user: { id: user.id, email: user.email, displayName: user.display_name },
    accessToken,
    refreshToken
  });
});

router.post("/refresh", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }
  const tokenHash = hashToken(parsed.data.refreshToken);
  const tokenResult = await db.query(
    `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at, rt.replaced_by, u.email, u.display_name
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1`,
    [tokenHash]
  );
  if (tokenResult.rowCount === 0) {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
  const tokenRow = tokenResult.rows[0];
  const isExpired = new Date(tokenRow.expires_at) < new Date();
  if (tokenRow.revoked_at || tokenRow.replaced_by || isExpired) {
    // Reuse detection: old refresh token used again after rotation/revoke.
    if (tokenRow.replaced_by || tokenRow.revoked_at) {
      await db.query(
        `INSERT INTO refresh_token_reuse_events (user_id, token_id)
         VALUES ($1, $2)`,
        [tokenRow.user_id, tokenRow.id]
      );
      // Revoke all active refresh tokens for this user.
      await db.query(
        `UPDATE refresh_tokens
         SET revoked_at = NOW()
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [tokenRow.user_id]
      );
    }
    return res.status(401).json({ error: "Refresh token expired or revoked" });
  }

  await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE id = $1`,
    [tokenRow.id]
  );

  const { refreshToken } = await issueRefreshToken(tokenRow.user_id, tokenRow.id);
  const accessToken = signAccessToken({
    id: tokenRow.user_id,
    email: tokenRow.email,
    display_name: tokenRow.display_name
  });
  return res.json({ accessToken, refreshToken });
});

router.post("/logout", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }
  const tokenHash = hashToken(parsed.data.refreshToken);
  await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE token_hash = $1`,
    [tokenHash]
  );
  return res.json({ ok: true });
});

module.exports = { authRouter: router };
