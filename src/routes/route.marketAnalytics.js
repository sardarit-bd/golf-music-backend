import express from "express";
import { protect } from "../middleware/auth.js";
import { getMarketAnalytics, getStripeBalance } from "../controllers/controller.marketAnalytics.js";

const router = express.Router();

router.get("/analytics", protect, getMarketAnalytics);
router.get("/stripe/balance", protect, getStripeBalance);

export default router;