import express from "express";
import { createMerch, deleteMerch, getAllMerch, getMerchById, updateMerch } from "../controllers/controller.merch.js";
import { handleUploadErrors, uploadMerchImage } from "../middleware/upload.js";
import { validateMerch } from "../middleware/validation.js";
import { authorize, protect } from "../middleware/auth.js";



const router = express.Router();

// Public route
router.get("/", getAllMerch);
router.get("/:id", getMerchById);

// Admin routes
router.post(
  "/",
  protect,
  authorize("admin"),
  uploadMerchImage,
  handleUploadErrors,
  validateMerch,
  createMerch
);

router.put(
  "/:id",
  protect,
  authorize("admin"),
  uploadMerchImage,
  handleUploadErrors,
  validateMerch,
  updateMerch
);

router.delete("/:id", protect, authorize("admin"), deleteMerch);

export default router;
