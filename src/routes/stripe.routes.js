import express from "express";
import { protect } from "../middleware/auth.js";
import { createStripeConnectAccount, createStripeDashboardLink, disconnectStripeAccount, getStripeConnectStatus, handleStripeOnboardingSuccess, refreshStripeOnboarding } from "../controllers/controller.stripeConnect.js";


const router = express.Router();

// ===== PUBLIC ROUTES (No auth required for webhooks) =====
// (Add webhook handlers here if any)

// ===== PROTECTED ROUTES (Require authentication) =====

// Check Stripe connection status
router.get("/connect/status", protect, getStripeConnectStatus);

// Create new Stripe Connect account or get onboarding link
router.post("/connect/onboard", protect, createStripeConnectAccount);

// Get Stripe dashboard login link
router.get("/connect/dashboard", protect, createStripeDashboardLink);

// Refresh Stripe onboarding
router.get("/connect/refresh", protect, refreshStripeOnboarding);

// Handle Stripe onboarding success callback
router.get("/connect/success", protect, handleStripeOnboardingSuccess);

// Disconnect Stripe account
router.post("/connect/disconnect", protect, disconnectStripeAccount);

export default router;