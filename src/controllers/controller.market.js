import { ErrorResponse } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import MarketItem from "../models/model.marketItem.js";
import Order from "../models/model.order.js";
import { deleteFromCloudinary, extractPublicIdFromUrl } from "../config/cloudinary.js";

const isSellerTypeAllowed = (userType) =>
  ["artist", "venue", "photographer", "studio", "journalist", "fan"].includes(String(userType || "").toLowerCase());

const normalizeSellerType = (t) => String(t || "").toLowerCase();

const validLocations = ["Louisiana", "Mississippi", "Alabama", "Florida", ""];

/**
 * Calculate market fee (only affects seller)
 * Buyer pays full price, seller receives price - fee
 */
const calculateMarketFee = (price, subscriptionPlan = "free") => {
  const rate = subscriptionPlan === "pro" ? 0 : 0.10;
  return Math.round(price * rate * 100) / 100;
};

/**
 * Helper function to delete file from Cloudinary
 */
const deleteCloudinaryFile = async (fileUrl) => {
  if (!fileUrl || !String(fileUrl).includes("res.cloudinary.com")) {
    return { success: false, message: 'Invalid URL' };
  }

  try {
    const result = await deleteFromCloudinary(fileUrl, 'auto');

    if (result.result === 'ok') {
      return { success: true, result };
    } else {
      console.warn('⚠️ Cloudinary delete may have failed:', result);
      return { success: false, result };
    }

  } catch (error) {
    console.error("❌ Cloudinary delete failed:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Helper function to delete multiple files from Cloudinary
 */
const deleteMultipleFiles = async (urls) => {
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return { success: true, deleted: 0 };
  }

  const results = [];

  for (const url of urls) {
    try {
      const result = await deleteCloudinaryFile(url);
      results.push({
        url: url.substring(0, 50) + '...',
        success: result.success
      });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));

    } catch (error) {
      results.push({
        url: url.substring(0, 50) + '...',
        success: false,
        error: error.message
      });
    }
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return {
    success: failed === 0,
    deleted: successful,
    failed,
    details: results
  };
};

/**
 * Parse photos to delete from request
 */
const parsePhotosToDelete = (reqBody) => {
  const photosToDelete = [];

  // Method 1: Check for photosToDelete array
  if (reqBody.photosToDelete) {
    try {
      if (typeof reqBody.photosToDelete === 'string') {
        const parsed = JSON.parse(reqBody.photosToDelete);
        if (Array.isArray(parsed)) {
          parsed.forEach(url => {
            if (url && url.trim() && !photosToDelete.includes(url.trim())) {
              photosToDelete.push(url.trim());
            }
          });
        }
      } else if (Array.isArray(reqBody.photosToDelete)) {
        reqBody.photosToDelete.forEach(url => {
          if (url && url.trim() && !photosToDelete.includes(url.trim())) {
            photosToDelete.push(url.trim());
          }
        });
      }
    } catch (error) {
      console.error("Error parsing photosToDelete:", error);
    }
  }

  // Method 2: Check for photosToDelete[0], photosToDelete[1], etc.
  if (reqBody['photosToDelete[0]']) {
    let index = 0;
    while (reqBody[`photosToDelete[${index}]`]) {
      try {
        const photoData = reqBody[`photosToDelete[${index}]`];
        let photoUrl;

        try {
          const parsed = JSON.parse(photoData);
          photoUrl = parsed.url || parsed;
        } catch {
          photoUrl = photoData;
        }

        if (photoUrl && photoUrl.trim() && !photosToDelete.includes(photoUrl.trim())) {
          photosToDelete.push(photoUrl.trim());
        }
        index++;
      } catch (err) {
        console.error("Error parsing photo to delete:", err);
        index++;
      }
    }
  }

  return photosToDelete;
};

/**
 * Remove deleted photos from array
 */
const removePhotosFromArray = (originalArray, urlsToRemove) => {
  if (!originalArray || !Array.isArray(originalArray) || urlsToRemove.length === 0) {
    return originalArray || [];
  }

  const publicIdsToRemove = new Set();
  urlsToRemove.forEach(url => {
    const publicId = extractPublicIdFromUrl(url);
    if (publicId) {
      publicIdsToRemove.add(publicId);
    }
  });

  const filteredArray = originalArray.filter(photoUrl => {
    const photoPublicId = extractPublicIdFromUrl(photoUrl);
    const shouldKeep = !publicIdsToRemove.has(photoPublicId);
    return shouldKeep;
  });

  return filteredArray;
};

/* =========================
   PUBLIC ROUTES
========================= */

/**
 * PUBLIC: Get all active items with fee calculation
 */
export const getAllMarketItemsPublic = asyncHandler(async (req, res) => {
  const { search, sellerType, location } = req.query;

  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || "12", 10), 1), 50);
  const skip = (page - 1) * limit;

  const filter = { status: "active" };

  if (
    sellerType &&
    ["artist", "venue", "photographer", "studio", "journalist", "fan"].includes(
      normalizeSellerType(sellerType)
    )
  ) {
    filter.sellerType = normalizeSellerType(sellerType);
  }

  if (location) {
    filter.location = new RegExp(location, "i");
  }

  if (search) {
    filter.$text = { $search: search };
  }

  const [items, total] = await Promise.all([
    MarketItem.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(
        "seller",
        "username userType subscriptionPlan isVerified stripeAccountStatus"
      ),
    MarketItem.countDocuments(filter)
  ]);

  const itemsWithFees = items.map((item) => {
    const feeAmount = calculateMarketFee(item.price, item.subscriptionPlan);

    return {
      ...item.toObject(),
      feeInfo: {
        percentage: item.subscriptionPlan === "pro" ? 5 : 10,
        amount: feeAmount,
        buyerPays: item.price,                 // ✅ Buyer pays full price
        sellerReceives: item.price - feeAmount, // ✅ Seller gets price minus fee
        adminCommission: feeAmount,              // ✅ Admin gets the fee
        plan: item.subscriptionPlan || "free"
      }
    };
  });

  res.status(200).json({
    success: true,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    data: itemsWithFees
  });
});

/**
 * PUBLIC: Get items by state (Homepage dropdown filtering)
 */
export const getMarketItemsByState = asyncHandler(async (req, res, next) => {
  const { state } = req.params;
  const { sellerType, search } = req.query;

  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || "12", 10), 1), 50);
  const skip = (page - 1) * limit;

  if (!validLocations.includes(state)) {
    return next(
      new ErrorResponse(
        "Invalid state. Must be: Louisiana, Mississippi, Alabama, Florida",
        400
      )
    );
  }

  // Only show active items
  const filter = {
    location: state,
    status: "active",
  };

  if (
    sellerType &&
    ["artist", "photographer", "venue", "studio", "journalist", "fan"].includes(
      sellerType
    )
  ) {
    filter.sellerType = sellerType;
  }

  if (search) {
    filter.$text = { $search: search };
  }

  const [items, total] = await Promise.all([
    MarketItem.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("seller", "username userType subscriptionPlan isVerified"),

    MarketItem.countDocuments(filter),
  ]);

  const itemsWithFees = items.map(item => {
    const feeAmount = calculateMarketFee(item.price, item.subscriptionPlan);

    return {
      ...item.toObject(),
      feeInfo: {
        percentage: item.subscriptionPlan === "pro" ? 5 : 10,
        amount: feeAmount,
        buyerPays: item.price,                 // ✅ Buyer pays full price
        sellerReceives: item.price - feeAmount, // ✅ Seller gets price minus fee
        adminCommission: feeAmount,              // ✅ Admin gets the fee
        plan: item.subscriptionPlan || "free"
      }
    };
  });

  res.status(200).json({
    success: true,
    data: itemsWithFees,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

/**
 * PUBLIC: Get single item by id
 */
export const getMarketItemByIdPublic = asyncHandler(async (req, res, next) => {
  const item = await MarketItem.findById(req.params.id).populate(
    "seller",
    "_id username userType subscriptionPlan isVerified stripeAccountStatus stripeAccountId"
  );

  if (!item || item.status === "hidden") {
    return next(new ErrorResponse("Item not found", 404));
  }

  // Check if item is active (only active items should be viewable for purchase)
  if (item.status !== "active") {
    return next(new ErrorResponse("This item is not available for purchase", 404));
  }

  const feeAmount = calculateMarketFee(item.price, item.subscriptionPlan);

  const itemWithFee = {
    ...item.toObject(),
    feeInfo: {
      percentage: item.subscriptionPlan === "pro" ? 5 : 10,
      amount: feeAmount,
      buyerPays: item.price,                 // ✅ Buyer pays full price
      sellerReceives: item.price - feeAmount, // ✅ Seller gets price minus fee
      adminCommission: feeAmount,              // ✅ Admin gets the fee
      plan: item.subscriptionPlan || "free"
    },
    sellerReady: !!(item.seller?.stripeAccountId && item.seller?.stripeAccountStatus === 'active')
  };

  res.status(200).json({ success: true, data: itemWithFee });
});

/* =========================
   SELLER ROUTES
========================= */

/**
 * GET: Get current user's market item
 */
export const getMyMarketItem = asyncHandler(async (req, res) => {
  const item = await MarketItem.findOne({ seller: req.user._id })
    .populate(
      "seller",
      "_id username userType subscriptionPlan isVerified stripeAccountStatus stripeAccountId"
    );

  if (item) {
    const feeAmount = calculateMarketFee(item.price, req.user?.subscriptionPlan);

    const itemWithFee = {
      ...item.toObject(),
      feeInfo: {
        percentage: req.user?.subscriptionPlan === "pro" ? 5 : 10,
        amount: feeAmount,
        buyerPays: item.price,                 // ✅ Buyer pays full price
        sellerReceives: item.price - feeAmount, // ✅ Seller gets price minus fee
        adminCommission: feeAmount,              // ✅ Admin gets the fee
        plan: req.user?.subscriptionPlan || "free"
      },
      // Add Stripe requirement info for UI
      requiresStripe: !req.user.stripeAccountId || req.user.stripeAccountStatus !== 'active',
      canActivate: !!(req.user.stripeAccountId && req.user.stripeAccountStatus === 'active')
    };

    return res.status(200).json({ success: true, data: itemWithFee });
  }

  res.status(200).json({ success: true, data: null });
});

/**
 * CREATE: Create new market item
 */
export const createMyMarketItem = asyncHandler(async (req, res, next) => {
  const user = req.user;
  const userType = normalizeSellerType(user.userType);

  // Only verified users
  if (!user.isVerified) {
    return next(
      new ErrorResponse(
        "Account must be verified. Please check your email for verification.",
        403
      )
    );
  }

  if (!isSellerTypeAllowed(userType)) {
    return next(new ErrorResponse("Not allowed to create market items", 403));
  }

  const existing = await MarketItem.findOne({ seller: user._id });
  if (existing) {
    return next(new ErrorResponse("You can only list 1 item", 400));
  }

  const { title, description, price, location } = req.body;

  if (!title || !description || price === undefined) {
    return next(
      new ErrorResponse("title, description, price are required", 400)
    );
  }

  const numericPrice = parseFloat(price);
  if (isNaN(numericPrice) || numericPrice <= 0) {
    return next(new ErrorResponse("Invalid price value", 400));
  }

  if (location && !validLocations.includes(location)) {
    return next(
      new ErrorResponse(
        "Invalid location. Must be: Louisiana, Mississippi, Alabama, Florida",
        400
      )
    );
  }

  const photos = req.files?.photos?.map((file) => file.path) || [];
  const videos =
    req.files?.video?.length ? [req.files.video[0].path] : [];

  // Studio specific
  let services = [];
  let audioFile = "";

  if (userType === "studio") {
    if (req.body.services) {
      try {
        services = JSON.parse(req.body.services);
      } catch {
        services = [];
      }
    }

    if (req.files?.audio?.length) {
      audioFile = req.files.audio[0].path;
    }
  }

  // Commission snapshot (only affects seller)
  const commissionRate = user.subscriptionPlan === "pro" ? 0.05 : 0.10;
  const stripeFee = Math.round(numericPrice * commissionRate * 100) / 100;

  // Stripe connection check
  const itemStatus =
    user.stripeAccountId && user.stripeAccountStatus === "active"
      ? "active"
      : "pending";

  const item = await MarketItem.create({
    seller: user._id,
    sellerType: userType,
    title,
    description,
    price: numericPrice,
    location: location || "",
    photos,
    videos,
    services: userType === "studio" ? services : undefined,
    audioFile: userType === "studio" ? audioFile : undefined,
    status: itemStatus,
    subscriptionPlan: user.subscriptionPlan || "free",
    stripeFee
  });

  let message = "Item created successfully";

  if (!user.stripeAccountId) {
    message =
      "Item saved as draft. Connect Stripe to activate your listing and start selling.";
  } else if (user.stripeAccountStatus !== "active") {
    message =
      "Item saved. Please complete your Stripe onboarding to activate your listing.";
  }

  res.status(201).json({
    success: true,
    message,
    data: item,
    requiresStripe:
      !user.stripeAccountId ||
      user.stripeAccountStatus !== "active",
    feeInfo: {
      percentage: commissionRate * 100,
      amount: stripeFee,
      buyerPays: numericPrice,                 // ✅ Buyer pays full price
      sellerReceives: numericPrice - stripeFee, // ✅ Seller gets price minus fee
      adminCommission: stripeFee,                // ✅ Admin gets the fee
      plan: user.subscriptionPlan || "free"
    }
  });
});

/**
 * UPDATE: Update current user's market item
 */
export const updateMyMarketItem = asyncHandler(async (req, res, next) => {
  const item = await MarketItem.findOne({ seller: req.user._id });
  if (!item) return next(new ErrorResponse("Market item not found", 404));

  const { title, description, price, location, status } = req.body;

  if (location !== undefined && !validLocations.includes(location)) {
    return next(
      new ErrorResponse(
        "Invalid location. Must be: Louisiana, Mississippi, Alabama, Florida",
        400
      )
    );
  }

  /* =========================
     PHOTOS DELETE LOGIC
  ========================= */
  const photosToDelete = [];

  if (req.body.photosToDelete) {
    try {
      const parsed = JSON.parse(req.body.photosToDelete);
      if (Array.isArray(parsed)) {
        photosToDelete.push(...parsed);
      }
    } catch (error) {
      console.error("Error parsing photosToDelete:", error);
    }
  }

  if (photosToDelete.length > 0) {
    await deleteMultipleFiles(photosToDelete);
    item.photos = item.photos.filter(
      (photoUrl) => !photosToDelete.includes(photoUrl)
    );
  }

  /* =========================
     VIDEO DELETE LOGIC
  ========================= */
  const shouldDeleteVideo =
    req.body.deleteVideo === "true" ||
    req.body.deleteExistingVideo === "true";

  if (shouldDeleteVideo && item.videos?.length > 0) {
    await deleteCloudinaryFile(item.videos[0]);
    item.videos = [];
  }

  /* =========================
     UPDATE BASIC FIELDS
  ========================= */

  if (title !== undefined) item.title = title;
  if (description !== undefined) item.description = description;
  if (location !== undefined) item.location = location;

  if (price !== undefined) {
    const numericPrice = parseFloat(price);

    if (isNaN(numericPrice) || numericPrice < 0) {
      return next(new ErrorResponse("Invalid price value", 400));
    }

    item.price = numericPrice;

    // Recalculate Stripe commission (only affects seller)
    const rate = req.user.subscriptionPlan === "pro" ? 0.05 : 0.10;
    item.stripeFee = Math.round(numericPrice * rate * 100) / 100;
    item.subscriptionPlan = req.user.subscriptionPlan || "free";
  }

  /* =========================
     STATUS UPDATE LOGIC
  ========================= */

  if (status !== undefined) {
    if (
      status === "active" &&
      (!req.user.stripeAccountId ||
        req.user.stripeAccountStatus !== "active")
    ) {
      return next(
        new ErrorResponse(
          "Cannot activate listing. Complete Stripe onboarding first.",
          400
        )
      );
    }
    item.status = status;
  }

  /* =========================
     ADD NEW PHOTOS
  ========================= */

  if (req.files?.photos?.length) {
    const newPhotos = req.files.photos.map((file) => file.path);
    const totalPhotos = (item.photos?.length || 0) + newPhotos.length;

    if (totalPhotos > 5) {
      return next(new ErrorResponse("Maximum 5 photos allowed", 400));
    }

    item.photos = [...(item.photos || []), ...newPhotos];
  }

  /* =========================
     ADD NEW VIDEO
  ========================= */

  if (req.files?.video?.length) {
    if (item.videos?.length > 0 && !shouldDeleteVideo) {
      await deleteCloudinaryFile(item.videos[0]);
    }
    item.videos = [req.files.video[0].path];
  }

  await item.save();

  const feeAmount = calculateMarketFee(item.price, req.user.subscriptionPlan);

  res.status(200).json({
    success: true,
    message: "Market item updated successfully",
    data: item,
    feeInfo: {
      percentage: req.user.subscriptionPlan === "pro" ? 5 : 10,
      amount: feeAmount,
      buyerPays: item.price,                 // ✅ Buyer pays full price
      sellerReceives: item.price - feeAmount, // ✅ Seller gets price minus fee
      adminCommission: feeAmount,              // ✅ Admin gets the fee
      plan: req.user.subscriptionPlan || "free"
    },
  });
});

/**
 * DELETE: Delete a specific photo from user's item
 */
export const deletePhotoFromMyItem = asyncHandler(async (req, res, next) => {
  const item = await MarketItem.findOne({ seller: req.user._id });
  if (!item) return next(new ErrorResponse("Market item not found", 404));

  const photoIndex = parseInt(req.params.index);

  if (isNaN(photoIndex) || photoIndex < 0 || photoIndex >= (item.photos?.length || 0)) {
    return next(new ErrorResponse("Invalid photo index", 400));
  }

  const photoUrlToDelete = item.photos[photoIndex];

  await deleteCloudinaryFile(photoUrlToDelete);
  item.photos.splice(photoIndex, 1);
  await item.save();

  res.status(200).json({
    success: true,
    message: "Photo deleted successfully",
    data: item
  });
});

/**
 * DELETE: Delete current user's market item
 */
export const deleteMyMarketItem = asyncHandler(async (req, res, next) => {
  const item = await MarketItem.findOne({ seller: req.user._id });
  if (!item) return next(new ErrorResponse("Market item not found", 404));

  const urlsToDelete = [
    ...(item.photos || []),
    ...(item.videos || []),
    ...(item.audioFile ? [item.audioFile] : [])
  ];

  if (urlsToDelete.length > 0) {
    await deleteMultipleFiles(urlsToDelete);
  }

  await item.deleteOne();
  res.status(200).json({
    success: true,
    message: "Market item deleted",
    deletedFiles: urlsToDelete.length
  });
});

/* =========================
   ADMIN ROUTES
========================= */

/**
 * ADMIN: List all market items with filters
 */
export const adminListMarketItems = asyncHandler(async (req, res) => {
  const { status, sellerType, search, location } = req.query;
  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};

  // Include pending status for admin view
  if (status && ["pending", "active", "sold", "hidden"].includes(status)) {
    filter.status = status;
  }

  if (sellerType && ["artist", "venue", "photographer", "studio", "journalist", "fan"].includes(normalizeSellerType(sellerType))) {
    filter.sellerType = normalizeSellerType(sellerType);
  }

  if (location) filter.location = new RegExp(location, "i");

  if (search) filter.$text = { $search: search };

  const [items, total] = await Promise.all([
    MarketItem.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("seller", "name email userType subscriptionPlan isVerified stripeAccountStatus"),
    MarketItem.countDocuments(filter),
  ]);

  // Add fee info for admin
  const itemsWithFees = items.map(item => {
    const feeAmount = calculateMarketFee(item.price, item.subscriptionPlan);

    return {
      ...item.toObject(),
      feeInfo: {
        percentage: item.subscriptionPlan === "pro" ? 5 : 10,
        amount: feeAmount,
        buyerPays: item.price,
        sellerReceives: item.price - feeAmount,
        adminCommission: feeAmount,
        plan: item.subscriptionPlan || "free"
      }
    };
  });

  res.status(200).json({
    success: true,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    data: itemsWithFees,
  });
});

/**
 * ADMIN: Get market statistics
 */
export const adminMarketStats = asyncHandler(async (req, res) => {
  const [total, pending, active, sold, hidden] = await Promise.all([
    MarketItem.countDocuments({}),
    MarketItem.countDocuments({ status: "pending" }),
    MarketItem.countDocuments({ status: "active" }),
    MarketItem.countDocuments({ status: "sold" }),
    MarketItem.countDocuments({ status: "hidden" }),
  ]);

  // Revenue from actual paid orders
  const revenueData = await Order.aggregate([
    { $match: { orderType: "market", paymentStatus: "paid" } },
    {
      $group: {
        _id: null,
        totalFees: { $sum: "$platformFee" },
        totalSales: { $sum: "$totalPrice" },
        totalShipping: { $sum: "$shippingCost" },
      },
    },
  ]);

  const stats = revenueData[0] || {
    totalFees: 0,
    totalSales: 0,
    totalShipping: 0,
  };

  res.status(200).json({
    success: true,
    data: {
      total,
      pending,
      active,
      sold,
      hidden,
      totalSales: stats.totalSales,
      totalShipping: stats.totalShipping,
      totalAdminCommission: stats.totalFees,
    },
  });
});

/**
 * ADMIN: Get single market item by ID
 */
export const adminGetMarketItem = asyncHandler(async (req, res, next) => {
  const item = await MarketItem.findById(req.params.id).populate(
    "seller",
    "name email userType subscriptionPlan isVerified stripeAccountStatus"
  );

  if (!item) return next(new ErrorResponse("Item not found", 404));

  const feeAmount = calculateMarketFee(item.price, item.subscriptionPlan);

  const itemWithFee = {
    ...item.toObject(),
    feeInfo: {
      percentage: item.subscriptionPlan === "pro" ? 5 : 10,
      amount: feeAmount,
      buyerPays: item.price,
      sellerReceives: item.price - feeAmount,
      adminCommission: feeAmount,
      plan: item.subscriptionPlan || "free"
    }
  };

  res.status(200).json({ success: true, data: itemWithFee });
});

/**
 * ADMIN: Update market item
 */
export const adminUpdateMarketItem = asyncHandler(async (req, res, next) => {
  const item = await MarketItem.findById(req.params.id);
  if (!item) return next(new ErrorResponse("Item not found", 404));

  const allowed = [
    "title",
    "photos",
    "videos",
    "description",
    "price",
    "location",
    "status",
    "sellerType",
    "services",
    "audioFile"
  ];

  // Remove disallowed fields
  for (const key of Object.keys(req.body || {})) {
    if (!allowed.includes(key)) delete req.body[key];
  }

  // Validate photo limit
  if (
    req.body.photos &&
    Array.isArray(req.body.photos) &&
    req.body.photos.length > 5
  ) {
    return next(new ErrorResponse("Maximum 5 photos allowed", 400));
  }

  // Validate sellerType
  if (
    req.body.sellerType &&
    !["artist", "venue", "photographer", "studio", "journalist", "fan"].includes(
      normalizeSellerType(req.body.sellerType)
    )
  ) {
    return next(new ErrorResponse("Invalid sellerType", 400));
  }

  // If price changes → recalculate commission
  if (req.body.price !== undefined) {
    const numericPrice = parseFloat(req.body.price);

    if (isNaN(numericPrice) || numericPrice < 0) {
      return next(new ErrorResponse("Invalid price value", 400));
    }

    item.price = numericPrice;

    const rate = item.subscriptionPlan === "pro" ? 0.05 : 0.10;
    item.stripeFee = Math.round(numericPrice * rate * 100) / 100;
  }

  // Assign other fields
  Object.assign(item, req.body);

  await item.save();

  const feeAmount = calculateMarketFee(item.price, item.subscriptionPlan);

  res.status(200).json({
    success: true,
    message: "Market item updated successfully by admin",
    data: item,
    feeInfo: {
      percentage: item.subscriptionPlan === "pro" ? 5 : 10,
      amount: feeAmount,
      buyerPays: item.price,
      sellerReceives: item.price - feeAmount,
      adminCommission: feeAmount,
      plan: item.subscriptionPlan || "free"
    }
  });
});

/**
 * ADMIN: Delete market item
 */
export const adminDeleteMarketItem = asyncHandler(async (req, res, next) => {
  const item = await MarketItem.findById(req.params.id);
  if (!item) return next(new ErrorResponse("Item not found", 404));

  const urlsToDelete = [
    ...(item.photos || []),
    ...(item.videos || []),
    ...(item.audioFile ? [item.audioFile] : [])
  ];

  if (urlsToDelete.length > 0) {
    await deleteMultipleFiles(urlsToDelete);
  }

  await item.deleteOne();
  res.status(200).json({
    success: true,
    message: "Item deleted",
    deletedFiles: urlsToDelete.length
  });
});

/**
 * ADMIN: Delete item by seller ID
 */
export const adminDeleteBySeller = asyncHandler(async (req, res, next) => {
  const item = await MarketItem.findOne({ seller: req.params.sellerId });
  if (!item) return next(new ErrorResponse("Seller has no item", 404));

  const urlsToDelete = [
    ...(item.photos || []),
    ...(item.videos || []),
    ...(item.audioFile ? [item.audioFile] : [])
  ];

  if (urlsToDelete.length > 0) {
    await deleteMultipleFiles(urlsToDelete);
  }

  await item.deleteOne();
  res.status(200).json({
    success: true,
    message: "Seller item deleted",
    deletedFiles: urlsToDelete.length
  });
});