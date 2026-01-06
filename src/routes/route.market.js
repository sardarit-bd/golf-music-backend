import express from "express";

import {
  getMyMarketItem,
  createMyMarketItem,
  updateMyMarketItem,
  deleteMyMarketItem,
  getAllMarketItemsPublic,
  getMarketItemByIdPublic,
  adminMarketStats,
  adminListMarketItems,
  adminGetMarketItem,
  adminUpdateMarketItem,
  adminDeleteMarketItem,
  adminDeleteBySeller,
  deletePhotoFromMyItem,
} from "../controllers/controller.market.js";

import { authorize, protect } from "../middleware/auth.js";
import { handleUploadErrors } from "../middleware/upload.js";
import uploadMarketMedia from "../middleware/uploadMarketMedia.js";

const router = express.Router();

router.get("/", getAllMarketItemsPublic);

router.get("/me", protect, getMyMarketItem);

router.post(
  "/me",
  protect,
  uploadMarketMedia,
  handleUploadErrors,
  createMyMarketItem
);

router.put(
  "/me",
  protect,
  uploadMarketMedia,
  handleUploadErrors,
  updateMyMarketItem
);

router.delete(
  "/me/photos/:index",
  protect,
  deletePhotoFromMyItem
);

router.delete("/me", protect, deleteMyMarketItem);

/* ======================
   ADMIN
====================== */
router.get(
  "/admin/stats",
  protect,
  authorize("admin"),
  adminMarketStats
);

router.get(
  "/admin/items",
  protect,
  authorize("admin"),
  adminListMarketItems
);

router.get(
  "/admin/items/:id",
  protect,
  authorize("admin"),
  adminGetMarketItem
);

router.patch(
  "/admin/items/:id",
  protect,
  authorize("admin"),
  adminUpdateMarketItem
);

router.delete(
  "/admin/items/:id",
  protect,
  authorize("admin"),
  adminDeleteMarketItem
);

router.delete(
  "/admin/seller/:sellerId",
  protect,
  authorize("admin"),
  adminDeleteBySeller
);

router.get("/:id", getMarketItemByIdPublic);

export default router;
