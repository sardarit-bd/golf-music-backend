import express from "express";
import { protect } from "../middleware/auth.js";
import { createStripeConnectAccount } from "../controllers/controller.stripeConnect.js";



const router = express.Router();

router.post(
  "/connect/onboard",
  protect,
  createStripeConnectAccount
);


export default router;