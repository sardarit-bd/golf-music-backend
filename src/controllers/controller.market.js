import { ErrorResponse } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import MarketItem from "../models/model.marketItem.js";
import { cloudinary } from "../config/cloudinary.js";

const isSellerTypeAllowed = (userType) =>
  ["artist", "venue", "photographer"].includes(String(userType || "").toLowerCase());

const normalizeSellerType = (t) => String(t || "").toLowerCase();

const validLocations = ["Louisiana", "Mississippi", "Alabama", "Florida", ""];

/**
 * Helper function to delete file from Cloudinary
 */
const deleteFromCloudinary = async (fileUrl) => {
  if (!fileUrl || !fileUrl.includes('cloudinary')) {
    console.log("Skipping non-cloudinary URL:", fileUrl);
    return;
  }

  try {
    // Extract public_id from URL
    const parts = fileUrl.split('/');
    const publicIdWithExtension = parts[parts.length - 1];
    const publicId = publicIdWithExtension.split('.')[0];

    // Extract folder from URL
    const folderMatch = fileUrl.match(/\/v\d+\/([^\/]+)\//);
    const folder = folderMatch ? folderMatch[1] : 'market';

    console.log(`Deleting from Cloudinary - Folder: ${folder}, Public ID: ${publicId}`);

    // Detect resource type (video or image)
    if (fileUrl.includes('/video/') || fileUrl.includes('.mp4') || fileUrl.includes('.mov')) {
      await cloudinary.uploader.destroy(`${folder}/${publicId}`, {
        resource_type: "video"
      });
      console.log(`✅ Video deleted: ${publicId}`);
    } else {
      await cloudinary.uploader.destroy(`${folder}/${publicId}`);
      console.log(`✅ Image deleted: ${publicId}`);
    }
  } catch (error) {
    console.error("❌ Error deleting from Cloudinary:", error);
  }
};


/**
 * PUBLIC: Get all active items
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
 * PUBLIC: Get items by state (Homepage dropdown filtering)
 */
export const getMarketItemsByState = asyncHandler(async (req, res, next) => {
  const { state } = req.params;

  if (!validLocations.includes(state)) {
    return next(new ErrorResponse("Invalid state. Must be: Louisiana, Mississippi, Alabama, Florida", 400));
  }

  const items = await MarketItem.find({
    location: state,
    status: "active"
  })
    .sort({ createdAt: -1 })
    .populate("seller", "name userType subscriptionPlan isVerified");

  res.status(200).json({
    success: true,
    data: items
  });
});

/**
 * PUBLIC: Get single item by id
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


export const getMyMarketItem = asyncHandler(async (req, res) => {
  const item = await MarketItem.findOne({ seller: req.user._id });
  res.status(200).json({ success: true, data: item || null });
});


export const createMyMarketItem = asyncHandler(async (req, res, next) => {
  const user = req.user;
  const userType = normalizeSellerType(user.userType);

  if (!user.isVerified)
    return next(new ErrorResponse("Account must be verified", 403));
  if (!isSellerTypeAllowed(userType))
    return next(new ErrorResponse("Not allowed", 403));

  const existing = await MarketItem.findOne({ seller: user._id });
  if (existing)
    return next(new ErrorResponse("You can only list 1 item", 400));

  const { title, description, price, location } = req.body;

  if (!title || !description || price === undefined) {
    return next(
      new ErrorResponse("title, description, price are required", 400)
    );
  }

  if (location && !validLocations.includes(location)) {
    return next(new ErrorResponse("Invalid location. Must be: Louisiana, Mississippi, Alabama, Florida", 400));
  }

  const photos = req.files?.photos?.map((file) => file.path) || [];

  const videos = req.files?.video?.length
    ? [req.files.video[0].path]
    : [];

  const item = await MarketItem.create({
    seller: user._id,
    sellerType: userType,
    title,
    description,
    price,
    location: location || "",
    photos,
    videos,
    status: "active",
  });

  res.status(201).json({ success: true, data: item });
});


export const updateMyMarketItem = asyncHandler(async (req, res, next) => {
  const item = await MarketItem.findOne({ seller: req.user._id });
  if (!item) return next(new ErrorResponse("Market item not found", 404));

  const { title, description, price, location, status } = req.body;

  if (location !== undefined && !validLocations.includes(location)) {
    return next(new ErrorResponse("Invalid location. Must be: Louisiana, Mississippi, Alabama, Florida", 400));
  }

  /* =========================
     PHOTOS DELETE LOGIC - FIXED
  ========================= */
  let removedPhotos = [];

  // Parse photosToDelete from FormData
  if (req.body['photosToDelete[0]']) {
    let index = 0;
    while (req.body[`photosToDelete[${index}]`]) {
      try {
        const photoData = JSON.parse(req.body[`photosToDelete[${index}]`]);
        const photoUrl = photoData.url || photoData;
        if (photoUrl) {
          removedPhotos.push(photoUrl);
        }
        index++;
      } catch (err) {
        console.error("Error parsing photo to delete:", err);
        index++;
      }
    }
  }

  console.log("📸 Photos to delete:", removedPhotos);

  // Delete photos from Cloudinary
  if (removedPhotos.length > 0) {
    for (const photoUrl of removedPhotos) {
      await deleteFromCloudinary(photoUrl);
    }

    // Remove from database array
    item.photos = item.photos.filter(photo => !removedPhotos.includes(photo));
    console.log("✅ Photos removed from database");
  }

  /* =========================
     VIDEO DELETE LOGIC - FIXED
  ========================= */
  let deleteExistingVideo = null;
  if (req.body.deleteExistingVideo) {
    try {
      deleteExistingVideo = typeof req.body.deleteExistingVideo === 'string'
        ? JSON.parse(req.body.deleteExistingVideo)
        : req.body.deleteExistingVideo;
    } catch (err) {
      console.error("Error parsing deleteExistingVideo:", err);
    }
  }

  console.log("🎥 Delete existing video:", deleteExistingVideo);

  if (deleteExistingVideo?.delete === true) {
    if (item.videos?.length) {
      const videoUrl = item.videos[0];
      await deleteFromCloudinary(videoUrl);
      item.videos = [];
      console.log("✅ Video removed from database and Cloudinary");
    }
  }

  /* =========================
     UPDATE BASIC FIELDS
  ========================= */
  if (title !== undefined) item.title = title;
  if (description !== undefined) item.description = description;
  if (price !== undefined) item.price = price;
  if (location !== undefined) item.location = location;
  if (status !== undefined) item.status = status;

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
    console.log("✅ New photos added");
  }

  /* =========================
     ADD NEW VIDEO
  ========================= */
  if (req.files?.video?.length) {
    // Delete old video first if exists
    if (item.videos?.length) {
      await deleteFromCloudinary(item.videos[0]);
    }

    // Save new video
    item.videos = [req.files.video[0].path];
    console.log("✅ New video added");
  }

  await item.save();

  // Populate seller info
  await item.populate('seller', 'name userType subscriptionPlan isVerified');

  console.log("✅ Item updated successfully");

  res.status(200).json({
    success: true,
    message: "Market item updated successfully",
    data: item
  });
});


export const deletePhotoFromMyItem = asyncHandler(async (req, res, next) => {
  const item = await MarketItem.findOne({ seller: req.user._id });
  if (!item) return next(new ErrorResponse("Market item not found", 404));

  const photoIndex = parseInt(req.params.index);

  if (isNaN(photoIndex) || photoIndex < 0 || photoIndex >= (item.photos?.length || 0)) {
    return next(new ErrorResponse("Invalid photo index", 400));
  }

  const photoUrlToDelete = item.photos[photoIndex];

  // Delete from Cloudinary
  await deleteFromCloudinary(photoUrlToDelete);

  // Remove from array
  item.photos.splice(photoIndex, 1);
  await item.save();

  res.status(200).json({
    success: true,
    message: "Photo deleted successfully",
    data: item
  });
});



export const deleteMyMarketItem = asyncHandler(async (req, res, next) => {
  const item = await MarketItem.findOne({ seller: req.user._id });
  if (!item) return next(new ErrorResponse("Market item not found", 404));

  // Delete all photos from Cloudinary
  if (item.photos?.length) {
    for (const photoUrl of item.photos) {
      await deleteFromCloudinary(photoUrl);
    }
  }

  // Delete all videos from Cloudinary
  if (item.videos?.length) {
    for (const videoUrl of item.videos) {
      await deleteFromCloudinary(videoUrl);
    }
  }

  await item.deleteOne();
  res.status(200).json({ success: true, message: "Market item deleted" });
});

/* =========================
   ADMIN CONTROLLERS
========================= */

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


export const adminGetMarketItem = asyncHandler(async (req, res, next) => {
  const item = await MarketItem.findById(req.params.id).populate(
    "seller",
    "name email userType subscriptionPlan isVerified"
  );

  if (!item) return next(new ErrorResponse("Item not found", 404));
  res.status(200).json({ success: true, data: item });
})


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
  ];

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

export const adminDeleteMarketItem = asyncHandler(async (req, res, next) => {
  const item = await MarketItem.findById(req.params.id);
  if (!item) return next(new ErrorResponse("Item not found", 404));

  // Delete photos
  if (item.photos?.length) {
    for (const photoUrl of item.photos) {
      await deleteFromCloudinary(photoUrl);
    }
  }

  // Delete videos
  if (item.videos?.length) {
    for (const videoUrl of item.videos) {
      await deleteFromCloudinary(videoUrl);
    }
  }

  await item.deleteOne();
  res.status(200).json({ success: true, message: "Item deleted" });
});


export const adminDeleteBySeller = asyncHandler(async (req, res, next) => {
  const item = await MarketItem.findOne({ seller: req.params.sellerId });
  if (!item) return next(new ErrorResponse("Seller has no item", 404));

  // Delete photos
  if (item.photos?.length) {
    for (const photoUrl of item.photos) {
      await deleteFromCloudinary(photoUrl);
    }
  }

  // Delete videos
  if (item.videos?.length) {
    for (const videoUrl of item.videos) {
      await deleteFromCloudinary(videoUrl);
    }
  }

  await item.deleteOne();
  res.status(200).json({ success: true, message: "Seller item deleted" });
});