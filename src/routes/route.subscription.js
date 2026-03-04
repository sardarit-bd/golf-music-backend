import express from "express";
import { protect } from "../middleware/auth.js";
import {
  createProCheckoutSession,
  cancelSubscription,
  getBillingStatus,
  createBillingPortalSession,
  resumeSubscription,
  getUserInvoices,
} from "../controllers/controller.subscription.js";

const router = express.Router();

router.post("/checkout/pro", protect, createProCheckoutSession);
router.post("/cancel", protect, cancelSubscription);
router.get("/status", protect, getBillingStatus);
router.post("/portal", protect, createBillingPortalSession);
router.post("/resume", protect, resumeSubscription);
router.get("/invoices", protect, getUserInvoices);


export default router;
