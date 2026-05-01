const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const { config } = require("./config");
const { bootstrapSchema } = require("./db");
const { healthRouter } = require("./routes/health");
const { authRouter } = require("./routes/auth");
const { userRouter } = require("./routes/users");
const { checkinRouter } = require("./routes/checkins");
const { communityRouter } = require("./routes/community");
const { chatRouter } = require("./routes/chat");
const { reportRouter } = require("./routes/reports");

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false
});
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});

app.use("/health", healthRouter);
app.use("/auth", authLimiter, authRouter);
app.use("/users", userRouter);
app.use("/checkins", writeLimiter, checkinRouter);
app.use("/community", writeLimiter, communityRouter);
app.use("/chat", writeLimiter, chatRouter);
app.use("/reports", writeLimiter, reportRouter);

app.use((_, res) => {
  res.status(404).json({ error: "Route not found" });
});

async function start() {
  await bootstrapSchema();
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[mood-guardian-api] listening on :${config.port}`);
  });
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[mood-guardian-api] failed to start", error);
  process.exit(1);
});
