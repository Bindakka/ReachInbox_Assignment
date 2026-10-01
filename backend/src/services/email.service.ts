import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let transporter: ReturnType<typeof nodemailer.createTransport>;

export async function initializeEmailService() {
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });

    console.log("📧 SMTP transporter configured");
    return;
  }

  const testAccount = await nodemailer.createTestAccount();

  transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  console.log("📧 Ethereal test account created");
  console.log("📧 Ethereal user:", testAccount.user);
}

export async function sendEmail(
  recipient: string,
  subject: string,
  body: string
) {
  if (!transporter) {
    throw new Error("Email service has not been initialized");
  }

  const info = await transporter.sendMail({
    from: `"ReachInbox" <${env.SMTP_USER || "reachinbox@ethereal.email"}>`,
    to: recipient,
    subject,
    text: body,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);

  if (previewUrl) {
    console.log("🔗 Ethereal preview:", previewUrl);
  }

  return {
    messageId: info.messageId,
    previewUrl: previewUrl || null,
  };
}