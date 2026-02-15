import { ErrorResponse } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import MarketItem from "../models/model.marketItem.js";
import { deleteFromCloudinary, extractPublicIdFromUrl } from "../config/cloudinary.js";

const isSellerTypeAllowed = (userType) =>
  ["artist", "venue", "photographer", "studio", "journalist", "fan"].includes(String(userType || "").toLowerCase());

const normalizeSellerType = (t) => String(t || "").toLowerCase();

const validLocations = ["Louisiana", "Mississippi", "Alabama", "Florida", ""];

// Client requirement: Subscription fee calculation
const calculateMarketFee = (price, subscriptionPlan = "free") => {
  if (subscriptionPlan === "pro") {
    return price * 0.05; // Pro Plan: 5% fee
  }
  return price * 0.10; // Free Plan: 10% fee
};

/**
 * FIXED: Helper function to delete file from Cloudinary
 */
const deleteCloudinaryFile = async (fileUrl) => {
  if (!fileUrl || !String(fileUrl).includes("res.cloudinary.com")) {
    console.log('❌ Invalid or non-Cloudinary URL:', fileUrl);
    return { success: false, message: 'Invalid URL' };
  }

  try {
    // Use the fixed delete function from cloudinary.js
    const result = await deleteFromCloudinary(fileUrl, 'auto');
    
    if (result.result === 'ok') {
      console.log('✅ Cloudinary delete successful:', fileUrl.substring(0, 100) + '...');
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
  
  console.log(`🗑️ Deletion summary: ${successful} successful, ${failed} failed`);
  
  return {
    success: failed === 0,
    deleted: successful,
    failed,
    details: results
  };
};

/**
 * FIXED: Parse photos to delete from request
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
          // Try to parse as JSON
          const parsed = JSON.parse(photoData);
          photoUrl = parsed.url || parsed;
        } catch {
          // If not JSON, use as string
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
 * FIXED: Remove deleted photos from array
 */
const removePhotosFromArray = (originalArray, urlsToRemove) => {
  if (!originalArray || !Array.isArray(originalArray) || urlsToRemove.length === 0) {
    return originalArray || [];
  }
  
  // Create a Set of public IDs to remove for faster lookup
  const publicIdsToRemove = new Set();
  urlsToRemove.forEach(url => {
    const publicId = extractPublicIdFromUrl(url);
    if (publicId) {
      publicIdsToRemove.add(publicId);
    }
  });
  
  // Filter out photos whose public ID is in the remove set
  const filteredArray = originalArray.filter(photoUrl => {
    const photoPublicId = extractPublicIdFromUrl(photoUrl);
    const shouldKeep = !publicIdsToRemove.has(photoPublicId);
    
    if (!shouldKeep) {
      console.log(`❌ Removing photo: ${photoUrl.substring(0, 80)}...`);
    }
    
    return shouldKeep;
  });
  
  console.log(`📸 Photos filtered: ${originalArray.length} -> ${filteredArray.length}`);
  return filteredArray;
};

/**
 * PUBLIC: Get all active items with fee calculation
 */
export const getAllMarketItemsPublic = asyncHandler(async (req, res) => {
  const { search, sellerType, location } = req.query;
  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || "12", 10), 1), 50);
  const skip = (page - 1) * limit;

  const filter = { status: "active" };

  // Client requirement: All user types
  if (sellerType && ["artist", "venue", "photographer", "studio", "journalist", "fan"].includes(normalizeSellerType(sellerType))) {
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

  // Add fee info to response
  const itemsWithFees = items.map(item => {
    const feePercentage = item.seller?.subscriptionPlan === "pro" ? 5 : 10;
    const feeAmount = calculateMarketFee(item.price, item.seller?.subscriptionPlan);

    return {
      ...item.toObject(),
      feeInfo: {
        percentage: feePercentage,
        amount: feeAmount,
        total: item.price + feeAmount,
        plan: item.seller?.subscriptionPlan || "free"
      }
    };
  });

  res.status(200).json({
    success: true,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
    data: itemsWithFees,
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
      .populate("seller", "name userType subscriptionPlan isVerified"),

    MarketItem.countDocuments(filter),
  ]);

  const itemsWithFees = items.map(item => {
    const feePercentage = item.seller?.subscriptionPlan === "pro" ? 5 : 10;
    const feeAmount = calculateMarketFee(item.price, item.seller?.subscriptionPlan);

    return {
      ...item.toObject(),
      feeInfo: {
        percentage: feePercentage,
        amount: feeAmount,
        total: item.price + feeAmount
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
    "name userType subscriptionPlan isVerified"
  );

  if (!item || item.status === "hidden") {
    return next(new ErrorResponse("Item not found", 404));
  }

  // Add fee info
  const feePercentage = item.seller?.subscriptionPlan === "pro" ? 5 : 10;
  const feeAmount = calculateMarketFee(item.price, item.seller?.subscriptionPlan);

  const itemWithFee = {
    ...item.toObject(),
    feeInfo: {
      percentage: feePercentage,
      amount: feeAmount,
      total: item.price + feeAmount,
      plan: item.seller?.subscriptionPlan || "free"
    }
  };

  res.status(200).json({ success: true, data: itemWithFee });
});

export const getMyMarketItem = asyncHandler(async (req, res) => {
  const item = await MarketItem.findOne({ seller: req.user._id });

  if (item) {
    // Add fee info for my item
    const feePercentage = req.user?.subscriptionPlan === "pro" ? 5 : 10;
    const feeAmount = calculateMarketFee(item.price, req.user?.subscriptionPlan);

    const itemWithFee = {
      ...item.toObject(),
      feeInfo: {
        percentage: feePercentage,
        amount: feeAmount,
        total: item.price + feeAmount,
        plan: req.user?.subscriptionPlan || "free"
      }
    };

    return res.status(200).json({ success: true, data: itemWithFee });
  }

  res.status(200).json({ success: true, data: null });
});

export const createMyMarketItem = asyncHandler(async (req, res, next) => {
  const user = req.user;
  const userType = normalizeSellerType(user.userType);

  // Client requirement: Only verified users
  if (!user.isVerified)
    return next(new ErrorResponse("Account must be verified. Please check your email for verification.", 403));

  // Client requirement: All user types allowed
  if (!isSellerTypeAllowed(userType))
    return next(new ErrorResponse("Not allowed to create market items", 403));

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

  // Studio-specific fields (Client requirement)
  let services = [];
  let audioFile = "";

  if (userType === "studio") {
    // Parse services if provided
    if (req.body.services) {
      try {
        services = JSON.parse(req.body.services);
      } catch (error) {
        services = [];
      }
    }

    // Get audio file for studio
    if (req.files?.audio?.length) {
      audioFile = req.files.audio[0].path;
    }
  }

  // Calculate fee based on subscription plan
  const marketplaceFee = calculateMarketFee(price, user.subscriptionPlan);

  const item = await MarketItem.create({
    seller: user._id,
    sellerType: userType,
    title,
    description,
    price,
    location: location || "",
    photos,
    videos,
    services: userType === "studio" ? services : undefined,
    audioFile: userType === "studio" ? audioFile : undefined,
    status: "active",
    subscriptionPlan: user.subscriptionPlan || "free",
    stripeFee: marketplaceFee,
    paymentStatus: "pending"
  });

  // Return with fee info
  const feePercentage = user.subscriptionPlan === "pro" ? 5 : 10;

  res.status(201).json({
    success: true,
    data: item,
    feeInfo: {
      percentage: feePercentage,
      amount: marketplaceFee,
      total: price + marketplaceFee,
      plan: user.subscriptionPlan || "free"
    }
  });
});

export const updateMyMarketItem = asyncHandler(async (req, res, next) => {
  const item = await MarketItem.findOne({ seller: req.user._id });
  if (!item) return next(new ErrorResponse("Market item not found", 404));

  const { title, description, price, location, status, services } = req.body;

  if (location !== undefined && !validLocations.includes(location)) {
    return next(new ErrorResponse("Invalid location. Must be: Louisiana, Mississippi, Alabama, Florida", 400));
  }

  /* =========================
     FIXED: PHOTOS DELETE LOGIC
  ========================= */
  const photosToDelete = [];
  
  // Parse photosToDelete from request body
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

  console.log("📸 Photos to delete:", photosToDelete.length);

  // Delete photos from Cloudinary
  if (photosToDelete.length > 0) {
    const deleteResult = await deleteMultipleFiles(photosToDelete);
    console.log("✅ Photo deletion result:", deleteResult.deleted, "deleted,", deleteResult.failed, "failed");
    
    // Remove deleted photos from database array
    item.photos = item.photos.filter(photoUrl => {
      const shouldKeep = !photosToDelete.includes(photoUrl);
      if (!shouldKeep) {
        console.log(`❌ Removing photo: ${photoUrl.substring(0, 80)}...`);
      }
      return shouldKeep;
    });
  }

  /* =========================
     FIXED: VIDEO DELETE LOGIC
  ========================= */
  const shouldDeleteVideo = req.body.deleteVideo === 'true' || req.body.deleteExistingVideo === 'true';

  console.log("🎥 Delete video flag:", shouldDeleteVideo);

  if (shouldDeleteVideo && item.videos?.length > 0) {
    const videoUrl = item.videos[0];
    console.log('🗑️ Deleting video:', videoUrl.substring(0, 100) + '...');
    
    // Delete from Cloudinary
    await deleteCloudinaryFile(videoUrl);
    
    // Remove from database
    item.videos = [];
    console.log("✅ Video deleted successfully");
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
    console.log("✅ New photos added:", newPhotos.length);
  }

  /* =========================
     ADD NEW VIDEO
  ========================= */
  if (req.files?.video?.length) {
    // Delete old video if exists (and not already deleted)
    if (item.videos?.length > 0 && !shouldDeleteVideo) {
      await deleteCloudinaryFile(item.videos[0]);
    }
    
    item.videos = [req.files.video[0].path];
    console.log("✅ New video added");
  }

  await item.save();

  console.log("✅ Item updated successfully. Final state:", {
    photos: item.photos?.length || 0,
    videos: item.videos?.length || 0
  });

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
  await deleteCloudinaryFile(photoUrlToDelete);

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

  // Collect all media URLs to delete
  const urlsToDelete = [
    ...(item.photos || []),
    ...(item.videos || []),
    ...(item.audioFile ? [item.audioFile] : [])
  ];

  console.log(`🗑️ Deleting ${urlsToDelete.length} files from Cloudinary...`);
  
  // Delete all media files
  if (urlsToDelete.length > 0) {
    const deleteResult = await deleteMultipleFiles(urlsToDelete);
    console.log("✅ Media deletion result:", deleteResult.deleted, "deleted,", deleteResult.failed, "failed");
  }

  await item.deleteOne();
  res.status(200).json({ 
    success: true, 
    message: "Market item deleted",
    deletedFiles: urlsToDelete.length
  });
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

  // Add fee statistics
  const totalFees = await MarketItem.aggregate([
    { $group: { _id: null, totalFees: { $sum: "$stripeFee" } } }
  ]);

  res.status(200).json({
    success: true,
    data: {
      total,
      active,
      sold,
      hidden,
      totalFees: totalFees[0]?.totalFees || 0
    },
  });
});

export const adminGetMarketItem = asyncHandler(async (req, res, next) => {
  const item = await MarketItem.findById(req.params.id).populate(
    "seller",
    "name email userType subscriptionPlan isVerified"
  );

  if (!item) return next(new ErrorResponse("Item not found", 404));
  res.status(200).json({ success: true, data: item });
});

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

  for (const key of Object.keys(req.body || {})) {
    if (!allowed.includes(key)) delete req.body[key];
  }

  if (req.body.photos && Array.isArray(req.body.photos) && req.body.photos.length > 5) {
    return next(new ErrorResponse("Maximum 5 photos allowed", 400));
  }

  // Client requirement: All user types
  if (req.body.sellerType && !["artist", "venue", "photographer", "studio", "journalist", "fan"].includes(normalizeSellerType(req.body.sellerType))) {
    return next(new ErrorResponse("Invalid sellerType", 400));
  }

  Object.assign(item, req.body);
  await item.save();

  res.status(200).json({ success: true, data: item });
});

export const adminDeleteMarketItem = asyncHandler(async (req, res, next) => {
  const item = await MarketItem.findById(req.params.id);
  if (!item) return next(new ErrorResponse("Item not found", 404));

  // Collect all media URLs to delete
  const urlsToDelete = [
    ...(item.photos || []),
    ...(item.videos || []),
    ...(item.audioFile ? [item.audioFile] : [])
  ];

  console.log(`🗑️ Deleting ${urlsToDelete.length} files from Cloudinary...`);
  
  // Delete all media files
  if (urlsToDelete.length > 0) {
    const deleteResult = await deleteMultipleFiles(urlsToDelete);
    console.log("✅ Media deletion result:", deleteResult.deleted, "deleted,", deleteResult.failed, "failed");
  }

  await item.deleteOne();
  res.status(200).json({ 
    success: true, 
    message: "Item deleted",
    deletedFiles: urlsToDelete.length
  });
});

export const adminDeleteBySeller = asyncHandler(async (req, res, next) => {
  const item = await MarketItem.findOne({ seller: req.params.sellerId });
  if (!item) return next(new ErrorResponse("Seller has no item", 404));

  // Collect all media URLs to delete
  const urlsToDelete = [
    ...(item.photos || []),
    ...(item.videos || []),
    ...(item.audioFile ? [item.audioFile] : [])
  ];

  console.log(`🗑️ Deleting ${urlsToDelete.length} files from Cloudinary...`);
  
  // Delete all media files
  if (urlsToDelete.length > 0) {
    const deleteResult = await deleteMultipleFiles(urlsToDelete);
    console.log("✅ Media deletion result:", deleteResult.deleted, "deleted,", deleteResult.failed, "failed");
  }

  await item.deleteOne();
  res.status(200).json({ 
    success: true, 
    message: "Seller item deleted",
    deletedFiles: urlsToDelete.length
  });
});