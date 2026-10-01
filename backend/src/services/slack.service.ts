import axios from "axios";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";

export async function sendSlackNotification(
  userId: string,
  message: string
) {
  try {
    const connection =
      await prisma.slackConnection.findUnique({
        where: {
          userId,
        },
      });

    if (!connection?.webhookUrl) {
      console.log(
        "ℹ️ Slack is not connected. Skipping notification."
      );

      return false;
    }

    await axios.post(
      connection.webhookUrl,
      {
        text: message,
      }
    );

    console.log("🔔 Slack notification sent");

    return true;
  } catch (error) {
    console.error(
      "Slack notification failed:",
      error instanceof Error
        ? error.message
        : error
    );

    return false;
  }
}

export async function exchangeSlackCode(
  code: string
) {
  const response = await axios.post(
    "https://slack.com/api/oauth.v2.access",
    null,
    {
      params: {
        client_id: env.SLACK_CLIENT_ID,
        client_secret:
          env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri:
          env.SLACK_REDIRECT_URI,
      },
    }
  );

  if (!response.data.ok) {
    throw new Error(
      response.data.error ||
        "Slack OAuth failed"
    );
  }

  return response.data;
}