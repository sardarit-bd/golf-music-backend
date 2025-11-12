import express from "express";
import { authorize, protect } from "../middleware/auth.js";
import { createOrder, deleteOrder, getAllOrders, handleStripeWebhook, markOrderDelivered } from "../controllers/controller.merch.js";


const router = express.Router();

router.post("/", protect, createOrder);
router.post("/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);


// admin routes
router.get("/", protect, authorize("admin"), getAllOrders);
router.put("/:id/deliver", protect, authorize("admin"), markOrderDelivered);
router.delete("/:id", protect, authorize("admin"), deleteOrder);

export default router;
