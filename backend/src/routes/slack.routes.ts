import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../config/prisma.js";
import { redis } from "../config/redis.js";
import { env } from "../config/env.js";
import { exchangeSlackCode } from "../services/slack.service.js";

const router = Router();

// ========================================
// CONNECT SLACK
// ========================================
router.get("/connect", async (req, res) => {
  try {
    const loggedInUser = req.user as
      | { id: string }
      | undefined;

    if (!loggedInUser) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    const state = crypto.randomUUID();

    await redis.set(
      `slack-oauth-state:${state}`,
      loggedInUser.id,
      "EX",
      600
    );

    const params = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      scope: "incoming-webhook",
      redirect_uri: env.SLACK_REDIRECT_URI,
      state,
    });

    return res.redirect(
      `https://slack.com/oauth/v2/authorize?${params.toString()}`
    );
  } catch (error) {
    console.error(
      "Slack connect error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to connect Slack.",
    });
  }
});

// ========================================
// SLACK CALLBACK
// ========================================
router.get("/callback", async (req, res) => {
  try {
    const { code, state } = req.query;

    if (
      typeof code !== "string" ||
      typeof state !== "string"
    ) {
      return res.status(400).send(
        "Invalid Slack OAuth callback."
      );
    }

    const userId = await redis.get(
      `slack-oauth-state:${state}`
    );

    if (!userId) {
      return res.status(400).send(
        "Invalid or expired Slack OAuth state."
      );
    }

    await redis.del(
      `slack-oauth-state:${state}`
    );

    const slackData =
      await exchangeSlackCode(code);

    const webhookUrl =
      slackData.incoming_webhook?.url ??
      null;

    await prisma.slackConnection.upsert({
      where: {
        userId,
      },
      update: {
        accessToken:
          slackData.access_token,
        webhookUrl,
        teamId:
          slackData.team?.id ?? null,
        teamName:
          slackData.team?.name ?? null,
      },
      create: {
        userId,
        accessToken:
          slackData.access_token,
        webhookUrl,
        teamId:
          slackData.team?.id ?? null,
        teamName:
          slackData.team?.name ?? null,
      },
    });

    return res.redirect(
      `${env.FRONTEND_URL}/dashboard?slack=connected`
    );
  } catch (error) {
    console.error(
      "Slack callback error:",
      error
    );

    return res.status(500).send(
      "Slack connection failed."
    );
  }
});

// ========================================
// SLACK STATUS
// ========================================
router.get("/status", async (req, res) => {
  try {
    const loggedInUser = req.user as
      | { id: string }
      | undefined;

    if (!loggedInUser) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    const connection =
      await prisma.slackConnection.findUnique({
        where: {
          userId: loggedInUser.id,
        },
      });

    return res.json({
      success: true,
      connected: Boolean(connection),
      teamName:
        connection?.teamName ?? null,
    });
  } catch (error) {
    console.error(
      "Slack status error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to check Slack status.",
    });
  }
});

// ========================================
// DISCONNECT SLACK
// ========================================
router.post("/disconnect", async (req, res) => {
  try {
    const loggedInUser = req.user as
      | { id: string }
      | undefined;

    if (!loggedInUser) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    await prisma.slackConnection.deleteMany({
      where: {
        userId: loggedInUser.id,
      },
    });

    return res.json({
      success: true,
      message: "Slack disconnected successfully.",
    });
  } catch (error) {
    console.error(
      "Slack disconnect error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to disconnect Slack.",
    });
  }
});

export default router;