import { Worker, Job } from "bullmq";

import { redis } from "../config/redis.js";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

import { sendEmail } from "../services/email.service.js";
import { emailQueue } from "../services/email.queue.js";
import { sendSlackNotification } from "../services/slack.service.js";

interface EmailJobData {
  emailId: string;
  userId: string;
  recipient: string;
  subject: string;
  body: string;
}

// ========================================
// REDIS RATE LIMIT
// ========================================

const RATE_LIMIT_PREFIX = "email-rate-limit";

const RATE_LIMIT_SCRIPT = `
local current = redis.call("GET", KEYS[1])

if not current then
  current = 0
else
  current = tonumber(current)
end

local limit = tonumber(ARGV[1])

if current >= limit then
  return 0
end

current = redis.call("INCR", KEYS[1])

if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[2])
end

return 1
`;

// ========================================
// CHECK HOURLY RATE LIMIT
// ========================================

async function checkHourlyRateLimit(
  userId: string
): Promise<{
  allowed: boolean;
  retryAfterMs: number;
}> {
  const now = new Date();

  const hourKey =
    `${now.getUTCFullYear()}-` +
    `${String(now.getUTCMonth() + 1).padStart(2, "0")}-` +
    `${String(now.getUTCDate()).padStart(2, "0")}-` +
    `${String(now.getUTCHours()).padStart(2, "0")}`;

  const key =
    `${RATE_LIMIT_PREFIX}:${userId}:${hourKey}`;

  const result = await redis.eval(
    RATE_LIMIT_SCRIPT,
    1,
    key,
    env.MAX_EMAILS_PER_HOUR,
    3700
  );

  // Rate limit available
  if (Number(result) === 1) {
    return {
      allowed: true,
      retryAfterMs: 0,
    };
  }

  // Rate limit reached
  const nextHour = new Date(now);

  nextHour.setUTCMinutes(0);
  nextHour.setUTCSeconds(0);
  nextHour.setUTCMilliseconds(0);
  nextHour.setUTCHours(
    nextHour.getUTCHours() + 1
  );

  return {
    allowed: false,
    retryAfterMs:
      nextHour.getTime() - now.getTime(),
  };
}

// ========================================
// RESCHEDULE EMAIL FOR NEXT HOUR
// ========================================

async function rescheduleForNextHour(
  job: Job<EmailJobData>,
  retryAfterMs: number
) {
  const nextRun =
    Date.now() + retryAfterMs;

  const retryJobId =
    `email-${job.data.emailId}-retry-${Math.floor(
      nextRun / 60000
    )}`;

  await emailQueue.add(
    "send-email",
    job.data,
    {
      jobId: retryJobId,
      delay: retryAfterMs,
    }
  );

  console.log(
    `⏰ Email ${job.data.emailId} queued again for next hour`
  );
}

// ========================================
// EMAIL WORKER
// ========================================

export const emailWorker =
  new Worker<EmailJobData>(
    "email-sending",

    async (job: Job<EmailJobData>) => {
      console.log(
        `📨 Processing email job: ${job.id}`
      );

      const {
        emailId,
        userId,
        recipient,
        subject,
        body,
      } = job.data;

      // ========================================
      // FIND EMAIL
      // ========================================

      const email =
        await prisma.email.findUnique({
          where: {
            id: emailId,
          },
        });

      if (!email) {
        throw new Error(
          `Email ${emailId} not found`
        );
      }

      // ========================================
      // IDEMPOTENCY / ATOMIC CLAIM
      // ========================================

      const claimResult =
        await prisma.email.updateMany({
          where: {
            id: emailId,
            status: "SCHEDULED",
          },

          data: {
            status: "PROCESSING",
          },
        });

      // Another worker already claimed it
      if (claimResult.count === 0) {
        const currentEmail =
          await prisma.email.findUnique({
            where: {
              id: emailId,
            },
          });

        if (
          currentEmail?.status === "SENT"
        ) {
          console.log(
            `⏭️ Email ${emailId} already sent`
          );

          return {
            success: true,
            skipped: true,
            emailId,
          };
        }

        if (
          currentEmail?.status ===
          "PROCESSING"
        ) {
          console.log(
            `⏭️ Email ${emailId} already being processed`
          );

          return {
            success: true,
            skipped: true,
            emailId,
          };
        }

        throw new Error(
          `Could not claim email ${emailId}`
        );
      }

      // ========================================
      // CHECK HOURLY RATE LIMIT
      // ========================================

      const rateLimit =
        await checkHourlyRateLimit(userId);

      if (!rateLimit.allowed) {
        console.log(
          `⏳ Hourly rate limit reached for user ${userId}`
        );

        // ========================================
        // SLACK NOTIFICATION
        // Only one notification per user/hour
        // ========================================

        const currentHour =
          new Date()
            .toISOString()
            .slice(0, 13);

        const notificationKey =
          `email-rate-limit-notified:${userId}:${currentHour}`;

        const shouldNotify =
          await redis.set(
            notificationKey,
            "1",
            "EX",
            3700,
            "NX"
          );

        if (shouldNotify === "OK") {
          await sendSlackNotification(
            userId,
            "🚨 ReachInbox hourly email rate limit reached. Emails are being rescheduled and will continue in the next hour."
          );
        }

        // ========================================
        // RETURN EMAIL TO SCHEDULED
        // ========================================

        await prisma.email.update({
          where: {
            id: emailId,
          },

          data: {
            status: "SCHEDULED",
          },
        });

        // ========================================
        // CREATE NEW DELAYED BULLMQ JOB
        // ========================================

        await rescheduleForNextHour(
          job,
          rateLimit.retryAfterMs
        );

        return {
          success: true,
          rateLimited: true,
          rescheduled: true,
          emailId,
          retryAfterMs:
            rateLimit.retryAfterMs,
        };
      }

      // ========================================
      // SEND EMAIL
      // ========================================

      try {
        console.log(
          `📧 Sending email to: ${recipient}`
        );

        console.log(
          `📝 Subject: ${subject}`
        );

        const result =
          await sendEmail(
            recipient,
            subject,
            body
          );

        // ========================================
        // MARK EMAIL AS SENT
        // ========================================

        await prisma.email.update({
          where: {
            id: emailId,
          },

          data: {
            status: "SENT",
            sentAt: new Date(),
          },
        });

        console.log(
          `✅ Email marked as SENT: ${emailId}`
        );

        if (result.previewUrl) {
          console.log(
            `🔗 Ethereal preview: ${result.previewUrl}`
          );
        }

        return {
          success: true,
          emailId,
          messageId:
            result.messageId,
          previewUrl:
            result.previewUrl,
        };
      } catch (error) {
        // ========================================
        // SEND FAILED
        // ========================================

        await prisma.email.update({
          where: {
            id: emailId,
          },

          data: {
            status: "SCHEDULED",
          },
        });

        throw error;
      }
    },

    {
      connection: redis,

      concurrency:
        env.WORKER_CONCURRENCY,
    }
  );

// ========================================
// WORKER EVENTS
// ========================================

emailWorker.on(
  "completed",
  (job) => {
    console.log(
      `✅ BullMQ job completed: ${job.id}`
    );
  }
);

emailWorker.on(
  "failed",
  (job, error) => {
    console.error(
      `❌ BullMQ job failed: ${job?.id}`,
      error.message
    );
  }
);

emailWorker.on(
  "error",
  (error) => {
    console.error(
      "❌ Worker error:",
      error.message
    );
  }
);