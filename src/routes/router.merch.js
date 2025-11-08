import express from "express";
import { addAllPrintifyProducts, addSinglePrintifyProduct, createMerch, deleteMerch, fetchPrintifyProducts, getAllMerch, updateMerch } from "../controllers/controller.merch.js";
import { authorize, protect } from "../middleware/auth.js";
import { validateMerch } from "../middleware/validation.js";

const router = express.Router();

// Public route
router.get("/", getAllMerch);

// Admin routes
router.post("/", protect, authorize("admin"), validateMerch, createMerch);
router.put("/:id", protect, authorize("admin"), validateMerch, updateMerch);
router.delete("/:id", protect, authorize("admin"), deleteMerch);



router.get("/products", protect, authorize("admin"), fetchPrintifyProducts);
router.post("/add-all", protect, authorize("admin"), addAllPrintifyProducts);
router.post("/add/:productId", protect, authorize("admin"), addSinglePrintifyProduct);


export default router;
