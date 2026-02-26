import express from "express";
import { 
    cancelOrder, 
    createOrder, 
    deleteOrder, 
    getAllOrders, 
    getUserOrders, 
    markOrderDelivered,
    updateOrderStatus,
    updatePaymentStatus
    //  handleStripeWebhook
} from "../controllers/controller.merch.js";
import { authorize, protect } from "../middleware/auth.js";

const router = express.Router();

// User routes
router.get("/user", protect, getUserOrders);
router.post("/", protect, createOrder);

// router.post(
//   "/stripe/webhook",
//   express.raw({ type: "application/json" }),
//   handleStripeWebhook
// );

// ================================
// ADMIN ROUTES
// ================================

// Get all orders
router.get("/", protect, authorize("admin"), getAllOrders);

// Update order status
router.put("/:id/status", protect, authorize("admin"), updateOrderStatus);

// Update payment status
router.put("/:id/payment-status", protect, authorize("admin"), updatePaymentStatus);

// Mark delivered
router.put("/:id/deliver", protect, authorize("admin"), markOrderDelivered);

// Delete order
router.delete("/:id", protect, authorize("admin"), deleteOrder);

// Cancel order
router.put("/:id/cancel", protect, authorize("admin"), cancelOrder);

export default router;