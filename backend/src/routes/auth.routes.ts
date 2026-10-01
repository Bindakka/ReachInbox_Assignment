import { Router } from "express";
import passport from "../auth/google.js";
import { env } from "../config/env.js";

const router = Router();

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${env.FRONTEND_URL}/login`,
  }),
  (_req, res) => {
    res.redirect(`${env.FRONTEND_URL}/dashboard`);
  }
);

router.get("/me", (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Not authenticated",
    });
  }

  return res.json({
    success: true,
    user: req.user,
  });
});

router.post("/logout", (req, res) => {
  req.logout((error) => {
    if (error) {
      return res.status(500).json({
        success: false,
        message: "Logout failed",
      });
    }

    req.session.destroy(() => {
      res.json({
        success: true,
        message: "Logged out successfully",
      });
    });
  });
});

export default router;