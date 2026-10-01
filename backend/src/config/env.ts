import "dotenv/config";

export const env = {
  PORT: Number(process.env.PORT || 5000),

  DATABASE_URL: process.env.DATABASE_URL || "",

  REDIS_URL: process.env.REDIS_URL || "",

  WORKER_CONCURRENCY: Number(process.env.WORKER_CONCURRENCY || 5),

  MIN_EMAIL_DELAY_MS: Number(
    process.env.MIN_EMAIL_DELAY_MS || 2000
  ),

  MAX_EMAILS_PER_HOUR: Number(
    process.env.MAX_EMAILS_PER_HOUR || 100
  ),

  SMTP_HOST: process.env.SMTP_HOST || "",

  SMTP_PORT: Number(
    process.env.SMTP_PORT || 587
  ),

  SMTP_USER: process.env.SMTP_USER || "",

  SMTP_PASS: process.env.SMTP_PASS || "",

  GOOGLE_CLIENT_ID:
    process.env.GOOGLE_CLIENT_ID || "",

  GOOGLE_CLIENT_SECRET:
    process.env.GOOGLE_CLIENT_SECRET || "",

  GOOGLE_CALLBACK_URL:
    process.env.GOOGLE_CALLBACK_URL ||
    "http://localhost:5000/auth/google/callback",

  SESSION_SECRET:
    process.env.SESSION_SECRET ||
    "development-session-secret",

  ELASTICSEARCH_URL:
    process.env.ELASTICSEARCH_URL ||
    "http://localhost:9200",

  ELASTICSEARCH_USERNAME:
    process.env.ELASTICSEARCH_USERNAME || "",

  ELASTICSEARCH_PASSWORD:
    process.env.ELASTICSEARCH_PASSWORD || "",

  SLACK_CLIENT_ID:
    process.env.SLACK_CLIENT_ID || "",

  SLACK_CLIENT_SECRET:
    process.env.SLACK_CLIENT_SECRET || "",

  SLACK_REDIRECT_URI:
    process.env.SLACK_REDIRECT_URI ||
    "http://localhost:5000/api/slack/callback",

  FRONTEND_URL:
    process.env.FRONTEND_URL ||
    "http://localhost:5173",
};