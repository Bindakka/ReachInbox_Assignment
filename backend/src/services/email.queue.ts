import { Queue } from "bullmq";
import { redis } from "../config/redis.js";

export const emailQueue = new Queue("email-sending", {
  connection: redis,

  defaultJobOptions: {
    attempts: 3,

    backoff: {
      type: "exponential",
      delay: 5000,
    },

    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});