import express from "express";
import { adminDeleteBySeller, adminDeleteMarketItem, adminGetMarketItem, adminListMarketItems, adminMarketStats, adminUpdateMarketItem, createMyMarketItem, deleteMyMarketItem, getAllMarketItemsPublic, getMarketItemByIdPublic, getMyMarketItem, updateMyMarketItem } from "../controllers/controller.market.js";
import { authorize, protect } from "../middleware/auth.js";


const router = express.Router();

/* ========= PUBLIC ========= */
router.get("/", getAllMarketItemsPublic);
router.get("/:id", getMarketItemByIdPublic);

/* ========= SELLER ========= */
router.get("/me", protect, getMyMarketItem);
router.post("/me", protect, createMyMarketItem);
router.put("/me", protect, updateMyMarketItem);
router.delete("/me", protect, deleteMyMarketItem);

/* ========= ADMIN ========= */
router.get("/admin/stats", protect, authorize("admin"), adminMarketStats);
router.get("/admin/items", protect, authorize("admin"), adminListMarketItems);
router.get("/admin/items/:id", protect, authorize("admin"), adminGetMarketItem);
router.patch("/admin/items/:id", protect, authorize("admin"), adminUpdateMarketItem);
router.delete("/admin/items/:id", protect, authorize("admin"), adminDeleteMarketItem);
router.delete("/admin/seller/:sellerId", protect, authorize("admin"), adminDeleteBySeller);

export default router;
