import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../config/prisma.js";
import { emailQueue } from "../services/email.queue.js";

interface EmailInput {
  recipient: string;
  subject: string;
  body: string;
}

// ================================
// SCHEDULE EMAILS
// ================================
export async function scheduleEmails(req: Request, res: Response) {
  try {
    const {
      emails,
      startTime,
      delayMs = 2000,
    }: {
      emails: EmailInput[];
      startTime: string;
      delayMs?: number;
    } = req.body;

    // Validate emails
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        success: false,
        message: "emails must be a non-empty array",
      });
    }

    // Validate start time
    if (!startTime) {
      return res.status(400).json({
        success: false,
        message: "startTime is required",
      });
    }

    const startDate = new Date(startTime);

    if (Number.isNaN(startDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid startTime",
      });
    }

    // Get logged-in Google user
    const loggedInUser = req.user as
      | {
          id: string;
        }
      | undefined;

    if (!loggedInUser) {
      return res.status(401).json({
        success: false,
        message: "Please login with Google first.",
      });
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: {
        id: loggedInUser.id,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Make sure delay is never negative
    const minimumDelay = Math.max(delayMs, 0);

    // Create database records
    const emailRecords = emails.map((email, index) => {
      const scheduledAt = new Date(
        startDate.getTime() + index * minimumDelay
      );

      return {
        userId: user.id,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        scheduledAt,
        status: "SCHEDULED" as const,

        // Unique idempotency key for this email
        idempotencyKey: randomUUID(),
      };
    });

    // Save emails in PostgreSQL
    const createdEmails =
      await prisma.email.createManyAndReturn({
        data: emailRecords,
      });

    // Create BullMQ jobs
    const jobs = createdEmails.map((email) => ({
      name: "send-email",

      data: {
        emailId: email.id,
        userId: email.userId,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
      },

      opts: {
        jobId: `email-${email.id}`,

        delay: Math.max(
          0,
          email.scheduledAt.getTime() - Date.now()
        ),
      },
    }));

    // Add jobs to BullMQ
    await emailQueue.addBulk(jobs);

    return res.status(201).json({
      success: true,

      message:
        `${createdEmails.length} email(s) scheduled successfully`,

      emails: createdEmails,
    });
  } catch (error) {
    console.error(
      "Schedule emails error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to schedule emails",
    });
  }
}

// ================================
// GET SCHEDULED EMAILS
// ================================
export async function getScheduledEmails(
  req: Request,
  res: Response
) {
  try {
    const loggedInUser = req.user as
      | {
          id: string;
        }
      | undefined;

    if (!loggedInUser) {
      return res.status(401).json({
        success: false,
        message: "Please login with Google first.",
      });
    }

    const emails = await prisma.email.findMany({
      where: {
        userId: loggedInUser.id,
        status: "SCHEDULED",
      },

      orderBy: {
        scheduledAt: "asc",
      },
    });

    return res.json({
      success: true,
      emails,
    });
  } catch (error) {
    console.error(
      "Get scheduled emails error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch scheduled emails",
    });
  }
}

// ================================
// GET SENT EMAILS
// ================================
export async function getSentEmails(
  req: Request,
  res: Response
) {
  try {
    const loggedInUser = req.user as
      | {
          id: string;
        }
      | undefined;

    if (!loggedInUser) {
      return res.status(401).json({
        success: false,
        message: "Please login with Google first.",
      });
    }

    const emails = await prisma.email.findMany({
      where: {
        userId: loggedInUser.id,
        status: "SENT",
      },

      orderBy: {
        sentAt: "desc",
      },
    });

    return res.json({
      success: true,
      emails,
    });
  } catch (error) {
    console.error(
      "Get sent emails error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch sent emails",
    });
  }
}