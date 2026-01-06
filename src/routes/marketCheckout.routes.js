import express from "express";
import { protect } from "../middleware/auth.js";
import { createMarketCheckout } from "../controllers/controller.marketCheckout.js";

const router = express.Router();

// Buyer creates checkout session
router.post("/checkout", protect, createMarketCheckout);

export default router;
