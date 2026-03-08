import express from "express";
import { 
    cancelOrder, 
    createOrder, 
    createOrderPayment, 
    deleteOrder, 
    getAllOrders, 
    getUserOrders, 
    markOrderDelivered,
    updateOrderStatus,
    updatePaymentStatus
} from "../controllers/controller.merch.js";
import { authorize, protect } from "../middleware/auth.js";

const router = express.Router();

// ================================
// USER ROUTES
// ================================
router.get("/user", protect, getUserOrders);
router.post("/", protect, createOrder);
router.post("/create-payment", protect, createOrderPayment);
router.put("/:id/cancel", protect, cancelOrder);

// ================================
// ADMIN ONLY ROUTES
// ================================
router.get("/", protect, authorize("admin"), getAllOrders);
router.put("/:id/status", protect, authorize("admin"), updateOrderStatus);
router.put("/:id/payment-status", protect, authorize("admin"), updatePaymentStatus);
router.put("/:id/deliver", protect, authorize("admin"), markOrderDelivered);
router.delete("/:id", protect, authorize("admin"), deleteOrder);

export default router;