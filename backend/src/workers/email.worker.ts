import { Worker, Job } from "bullmq";
import { redis } from "../config/redis.js";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { sendEmail } from "../services/email.service.js";

interface EmailJobData {
  emailId: string;
  userId: string;
  recipient: string;
  subject: string;
  body: string;
}

export const emailWorker = new Worker<EmailJobData>(
  "email-sending",

  async (job: Job<EmailJobData>) => {
    console.log(`📨 Processing email job: ${job.id}`);

    const { emailId, recipient, subject, body } = job.data;

    // Prevent duplicate sending
    const email = await prisma.email.findUnique({
      where: {
        id: emailId,
      },
    });

    if (!email) {
      throw new Error(`Email ${emailId} not found`);
    }

    if (email.status === "SENT") {
      console.log(`⏭️ Email ${emailId} already sent`);
      return {
        success: true,
        skipped: true,
        emailId,
      };
    }

    // Mark as PROCESSING
    await prisma.email.update({
      where: {
        id: emailId,
      },
      data: {
        status: "PROCESSING",
      },
    });

    try {
      console.log(`📧 Sending email to: ${recipient}`);
      console.log(`📝 Subject: ${subject}`);

      const result = await sendEmail(
        recipient,
        subject,
        body
      );

      // Mark as SENT
      await prisma.email.update({
        where: {
          id: emailId,
        },
        data: {
          status: "SENT",
          sentAt: new Date(),
        },
      });

      console.log(`✅ Email marked as SENT: ${emailId}`);

      if (result.previewUrl) {
        console.log(
          `🔗 Ethereal preview: ${result.previewUrl}`
        );
      }

      return {
        success: true,
        emailId,
        messageId: result.messageId,
        previewUrl: result.previewUrl,
      };
    } catch (error) {
      // Return email to SCHEDULED so BullMQ can retry it
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
    concurrency: env.WORKER_CONCURRENCY,
  }
);

emailWorker.on("completed", (job) => {
  console.log(`✅ BullMQ job completed: ${job.id}`);
});

emailWorker.on("failed", (job, error) => {
  console.error(
    `❌ BullMQ job failed: ${job?.id}`,
    error.message
  );
});