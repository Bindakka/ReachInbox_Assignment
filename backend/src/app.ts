import express from "express";
import cors from "cors";
import session from "express-session";

import { env } from "./config/env.js";
import passport from "./auth/google.js";

import authRoutes from "./routes/auth.routes.js";
import emailRoutes from "./routes/email.routes.js";
import slackRoutes from "./routes/slack.routes.js";

import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

import { emailQueue } from "./services/email.queue.js";

const app = express();

// ========================================
// CORS
// ========================================
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

// ========================================
// BODY PARSING
// ========================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================================
// SESSION
// ========================================
app.use(
  session({
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// ========================================
// PASSPORT
// ========================================
app.use(passport.initialize());
app.use(passport.session());

// ========================================
// HEALTH CHECK
// ========================================
app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "ReachInbox backend is running",
  });
});

// ========================================
// BULL BOARD
// ========================================
const serverAdapter = new ExpressAdapter();

serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

app.use(
  "/admin/queues",
  serverAdapter.getRouter()
);

// ========================================
// AUTH ROUTES
// ========================================
app.use("/auth", authRoutes);

// ========================================
// EMAIL ROUTES
// ========================================
app.use("/api/emails", emailRoutes);

// ========================================
// SLACK ROUTES
// ========================================
app.use("/api/slack", slackRoutes);

export default app;