import { ErrorResponse } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import MarketItem from "../models/model.marketItem.js";



const isSellerTypeAllowed = (userType) =>
  ["artist", "venue", "photographer"].includes(String(userType || "").toLowerCase());

const normalizeSellerType = (t) => String(t || "").toLowerCase();

/**
 * PUBLIC: Get all active items
 * GET /api/market
 * query: search, sellerType, location, page, limit
 */
export const getAllMarketItemsPublic = asyncHandler(async (req, res) => {
  const { search, sellerType, location } = req.query;
  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || "12", 10), 1), 50);
  const skip = (page - 1) * limit;

  const filter = { status: "active" };

  if (sellerType && ["artist", "venue", "photographer"].includes(normalizeSellerType(sellerType))) {
    filter.sellerType = normalizeSellerType(sellerType);
  }
  if (location) filter.location = new RegExp(location, "i");

  if (search) {
    filter.$text = { $search: search };
  }

  const [items, total] = await Promise.all([
    MarketItem.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("seller", "name userType subscriptionPlan isVerified"),
    MarketItem.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
    data: items,
  });
});

/**
 * PUBLIC: Get single item by id
 * GET /api/market/:id
 */
export const getMarketItemByIdPublic = asyncHandler(async (req, res, next) => {
  const item = await MarketItem.findById(req.params.id).populate(
    "seller",
    "name userType subscriptionPlan isVerified"
  );

  if (!item || item.status === "hidden") {
    return next(new ErrorResponse("Item not found", 404));
  }

  res.status(200).json({ success: true, data: item });
});

/**
 * SELLER: Get my item
 * GET /api/market/me
 */
export const getMyMarketItem = asyncHandler(async (req, res) => {
  const item = await MarketItem.findOne({ seller: req.user._id });
  res.status(200).json({ success: true, data: item || null });
});

/**
 * SELLER: Create item (verified only + 1 item)
 * POST /api/market/me
 */
export const createMyMarketItem = asyncHandler(async (req, res, next) => {
  const user = req.user;
  const userType = normalizeSellerType(user.userType);

  if (!user.isVerified) return next(new ErrorResponse("Account must be verified", 403));
  if (!isSellerTypeAllowed(userType)) return next(new ErrorResponse("Not allowed to list items", 403));

  const existing = await MarketItem.findOne({ seller: user._id });
  if (existing) return next(new ErrorResponse("You can only list 1 item", 400));

  const { title, photos, video, description, price, location } = req.body;

  if (!title || !description || price === undefined) {
    return next(new ErrorResponse("title, description, price are required", 400));
  }
  if (photos && Array.isArray(photos) && photos.length > 5) {
    return next(new ErrorResponse("Maximum 5 photos allowed", 400));
  }

  const item = await MarketItem.create({
    seller: user._id,
    sellerType: userType,
    title,
    photos: photos || [],
    video: video || "",
    description,
    price,
    location: location || "",
    status: "active",
  });

  res.status(201).json({ success: true, data: item });
});

/**
 * SELLER: Update my item
 * PUT /api/market/me
 */
export const updateMyMarketItem = asyncHandler(async (req, res, next) => {
  const item = await MarketItem.findOne({ seller: req.user._id });
  if (!item) return next(new ErrorResponse("Market item not found", 404));

  // allow updates
  const allowed = ["title", "photos", "video", "description", "price", "location", "status"];
  for (const key of Object.keys(req.body || {})) {
    if (!allowed.includes(key)) delete req.body[key];
  }

  if (req.body.photos && Array.isArray(req.body.photos) && req.body.photos.length > 5) {
    return next(new ErrorResponse("Maximum 5 photos allowed", 400));
  }

  Object.assign(item, req.body);
  await item.save();

  res.status(200).json({ success: true, data: item });
});

/**
 * SELLER: Delete my item
 * DELETE /api/market/me
 */
export const deleteMyMarketItem = asyncHandler(async (req, res, next) => {
  const item = await MarketItem.findOne({ seller: req.user._id });
  if (!item) return next(new ErrorResponse("Market item not found", 404));

  await item.deleteOne();
  res.status(200).json({ success: true, message: "Market item deleted" });
});

/* =========================
   ADMIN CONTROLLERS
========================= */

/**
 * ADMIN: List all items (filters + pagination + search)
 * GET /api/market/admin/items
 * query: status, sellerType, search, location, page, limit
 */
export const adminListMarketItems = asyncHandler(async (req, res) => {
  const { status, sellerType, search, location } = req.query;
  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};
  if (status && ["active", "sold", "hidden"].includes(status)) filter.status = status;

  if (sellerType && ["artist", "venue", "photographer"].includes(normalizeSellerType(sellerType))) {
    filter.sellerType = normalizeSellerType(sellerType);
  }

  if (location) filter.location = new RegExp(location, "i");

  if (search) filter.$text = { $search: search };

  const [items, total] = await Promise.all([
    MarketItem.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("seller", "name email userType subscriptionPlan isVerified"),
    MarketItem.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    data: items,
  });
});

/**
 * ADMIN: Get stats for dashboard cards
 * GET /api/market/admin/stats
 */
export const adminMarketStats = asyncHandler(async (req, res) => {
  const [total, active, sold, hidden] = await Promise.all([
    MarketItem.countDocuments({}),
    MarketItem.countDocuments({ status: "active" }),
    MarketItem.countDocuments({ status: "sold" }),
    MarketItem.countDocuments({ status: "hidden" }),
  ]);

  res.status(200).json({
    success: true,
    data: { total, active, sold, hidden },
  });
});

/**
 * ADMIN: Get single item
 * GET /api/market/admin/items/:id
 */
export const adminGetMarketItem = asyncHandler(async (req, res, next) => {
  const item = await MarketItem.findById(req.params.id).populate(
    "seller",
    "name email userType subscriptionPlan isVerified"
  );

  if (!item) return next(new ErrorResponse("Item not found", 404));
  res.status(200).json({ success: true, data: item });
});

/**
 * ADMIN: Update item fields/status
 * PATCH /api/market/admin/items/:id
 */
export const adminUpdateMarketItem = asyncHandler(async (req, res, next) => {
  const item = await MarketItem.findById(req.params.id);
  if (!item) return next(new ErrorResponse("Item not found", 404));

  const allowed = ["title", "photos", "video", "description", "price", "location", "status", "sellerType"];
  for (const key of Object.keys(req.body || {})) {
    if (!allowed.includes(key)) delete req.body[key];
  }

  if (req.body.photos && Array.isArray(req.body.photos) && req.body.photos.length > 5) {
    return next(new ErrorResponse("Maximum 5 photos allowed", 400));
  }
  if (req.body.sellerType && !["artist", "venue", "photographer"].includes(normalizeSellerType(req.body.sellerType))) {
    return next(new ErrorResponse("Invalid sellerType", 400));
  }

  Object.assign(item, req.body);
  await item.save();

  res.status(200).json({ success: true, data: item });
});

/**
 * ADMIN: Delete item
 * DELETE /api/market/admin/items/:id
 */
export const adminDeleteMarketItem = asyncHandler(async (req, res, next) => {
  const item = await MarketItem.findById(req.params.id);
  if (!item) return next(new ErrorResponse("Item not found", 404));

  await item.deleteOne();
  res.status(200).json({ success: true, message: "Item deleted" });
});

/**
 * ADMIN: Force remove a seller's item by sellerId
 * DELETE /api/market/admin/seller/:sellerId
 */
export const adminDeleteBySeller = asyncHandler(async (req, res, next) => {
  const item = await MarketItem.findOne({ seller: req.params.sellerId });
  if (!item) return next(new ErrorResponse("Seller has no item", 404));

  await item.deleteOne();
  res.status(200).json({ success: true, message: "Seller item deleted" });
});
