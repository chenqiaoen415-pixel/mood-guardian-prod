const express = require("express");

const router = express.Router();

router.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "mood-guardian-api",
    timestamp: new Date().toISOString()
  });
});

module.exports = { healthRouter: router };
