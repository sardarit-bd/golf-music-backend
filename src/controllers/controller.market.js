import { ErrorResponse } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import MarketItem from "../models/model.marketItem.js";
import { cloudinary } from "../config/cloudinary.js";

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
 * FIXED: Helper function to extract correct Cloudinary public_id
 */
const extractCloudinaryPublicId = (fileUrl = "") => {
  if (!fileUrl || typeof fileUrl !== 'string') return null;
  
  try {
    // Remove query parameters
    const cleanUrl = fileUrl.split('?')[0];
    
    // Check if it's a Cloudinary URL
    if (!cleanUrl.includes('cloudinary.com') || !cleanUrl.includes('/upload/')) {
      console.log('❌ Not a Cloudinary URL:', fileUrl);
      return null;
    }
    
    // Find the upload part
    const uploadIndex = cleanUrl.indexOf('/upload/');
    if (uploadIndex === -1) return null;
    
    // Get everything after /upload/
    let path = cleanUrl.substring(uploadIndex + 8); // 8 = length of "/upload/"
    
    // Remove version prefix (v1234567890/)
    path = path.replace(/^v\d+\//, '');
    
    // Decode URL encoded characters
    path = decodeURIComponent(path);
    
    // Find the last slash to separate folder and filename
    const lastSlashIndex = path.lastIndexOf('/');
    
    if (lastSlashIndex === -1) {
      // No folder structure, just filename
      const dotIndex = path.lastIndexOf('.');
      return dotIndex !== -1 ? path.substring(0, dotIndex) : path;
    }
    
    // Separate folder and filename
    const folder = path.substring(0, lastSlashIndex);
    const filenameWithExt = path.substring(lastSlashIndex + 1);
    
    // Remove file extension from filename
    const dotIndex = filenameWithExt.lastIndexOf('.');
    const filename = dotIndex !== -1 ? filenameWithExt.substring(0, dotIndex) : filenameWithExt;
    
    // Return folder/filename (without extension)
    return folder ? `${folder}/${filename}` : filename;
    
  } catch (error) {
    console.error('❌ Error extracting Cloudinary public ID:', error);
    return null;
  }
};

/**
 * FIXED: Helper function to delete file from Cloudinary
 */
const deleteFromCloudinary = async (fileUrl) => {
  if (!fileUrl || !String(fileUrl).includes("res.cloudinary.com")) {
    console.log('❌ Invalid or non-Cloudinary URL:', fileUrl);
    return;
  }

  try {
    const publicId = extractCloudinaryPublicId(fileUrl);
    if (!publicId) {
      console.log('❌ Could not extract public ID from:', fileUrl);
      return;
    }

    const isVideo = fileUrl.includes("/video/upload/") || 
                    /\.(mp4|mov|avi|webm|mkv)$/i.test(fileUrl);

    const resource_type = isVideo ? "video" : "image";

    console.log('🗑️ Deleting from Cloudinary:', {
      publicId,
      resource_type,
      originalUrl: fileUrl.substring(0, 100) + '...'
    });

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type,
      invalidate: true
    });

    if (result.result === 'ok') {
      console.log('✅ Cloudinary delete successful:', publicId);
    } else {
      console.warn('⚠️ Cloudinary delete may have failed:', result);
    }
    
    return result;
  } catch (error) {
    console.error("❌ Cloudinary delete failed:", error.message);
  }
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
     PHOTOS DELETE LOGIC - FIXED
  ========================= */
  let removedPhotos = [];

  if (req.body['photosToDelete[0]']) {
    let index = 0;
    while (req.body[`photosToDelete[${index}]`]) {
      try {
        const photoData = req.body[`photosToDelete[${index}]`];
        let photoUrl;
        
        try {
          // Try to parse as JSON
          const parsed = JSON.parse(photoData);
          photoUrl = parsed.url || parsed;
        } catch {
          // If not JSON, use as string
          photoUrl = photoData;
        }
        
        if (photoUrl && photoUrl.trim()) {
          console.log(`📸 Photo to delete (${index}):`, photoUrl.substring(0, 100) + '...');
          removedPhotos.push(photoUrl.trim());
        }
        index++;
      } catch (err) {
        console.error("Error parsing photo to delete:", err);
        index++;
      }
    }
  }

  console.log("📸 Total photos to delete:", removedPhotos.length);

  // Delete photos from Cloudinary
  if (removedPhotos.length > 0) {
    const deletePromises = removedPhotos.map(async (photoUrl) => {
      console.log('🗑️ Deleting photo from Cloudinary:', photoUrl.substring(0, 100) + '...');
      return await deleteFromCloudinary(photoUrl);
    });
    
    await Promise.allSettled(deletePromises);
    console.log("✅ Cloudinary photo deletion completed");
  }

  // Remove from database array
  if (removedPhotos.length > 0) {
    const normalizeUrl = (url = "") => {
      // Remove query parameters
      const cleanUrl = String(url).split("?")[0].trim();
      // Decode URL encoded characters
      try {
        return decodeURIComponent(cleanUrl).toLowerCase();
      } catch {
        return cleanUrl.toLowerCase();
      }
    };

    const photosToRemove = removedPhotos.map(normalizeUrl);
    
    const originalCount = item.photos?.length || 0;
    
    item.photos = (item.photos || []).filter(p => {
      const currentPhotoUrl = normalizeUrl(p);
      const shouldKeep = !photosToRemove.includes(currentPhotoUrl);
      
      if (!shouldKeep) {
        console.log(`❌ Removing photo from DB: ${currentPhotoUrl.substring(0, 100)}...`);
      }
      
      return shouldKeep;
    });
    
    console.log(`✅ Photos removed from database: ${originalCount} -> ${item.photos.length}`);
  }

  /* =========================
     VIDEO DELETE LOGIC - FIXED
  ========================= */
  let deleteExistingVideo = false;
  
  if (req.body.deleteExistingVideo) {
    try {
      const deleteData = typeof req.body.deleteExistingVideo === 'string' 
        ? JSON.parse(req.body.deleteExistingVideo)
        : req.body.deleteExistingVideo;
      
      deleteExistingVideo = deleteData.delete === true;
    } catch (err) {
      console.error("Error parsing deleteExistingVideo:", err);
    }
  }

  console.log("🎥 Delete existing video flag:", deleteExistingVideo);

  if (deleteExistingVideo && item.videos?.length) {
    const videoUrl = item.videos[0];
    console.log('🗑️ Deleting video from Cloudinary:', videoUrl.substring(0, 100) + '...');
    
    // Delete from Cloudinary
    await deleteFromCloudinary(videoUrl);
    
    // Remove from database
    item.videos = [];
    console.log("✅ Video removed from database and Cloudinary");
  }

  /* =========================
     UPDATE BASIC FIELDS
  ========================= */
  if (title !== undefined) item.title = title;
  if (description !== undefined) item.description = description;
  if (price !== undefined) item.price = price;
  if (location !== undefined) item.location = location;
  if (status !== undefined) item.status = status;

  // Update services for studios
  if (req.user.userType === "studio" && services !== undefined) {
    try {
      const parsedServices = JSON.parse(services);
      if (Array.isArray(parsedServices)) {
        item.services = parsedServices;
      }
    } catch (error) {
      console.error("Error parsing services:", error);
    }
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
    console.log("✅ New photos added:", newPhotos.length);
  }

  /* =========================
     ADD NEW VIDEO
  ========================= */
  if (req.files?.video?.length) {
    if (item.videos?.length) {
      // Delete old video from Cloudinary
      await deleteFromCloudinary(item.videos[0]);
    }
    item.videos = [req.files.video[0].path];
    console.log("✅ New video added");
  }

  /* =========================
     ADD NEW AUDIO (Studio only)
  ========================= */
  if (req.user.userType === "studio" && req.files?.audio?.length) {
    if (item.audioFile) {
      await deleteFromCloudinary(item.audioFile);
    }
    item.audioFile = req.files.audio[0].path;
    console.log("✅ New audio added");
  }

  // Recalculate fee if price changed
  if (price !== undefined) {
    item.stripeFee = calculateMarketFee(price, req.user.subscriptionPlan);
  }

  await item.save();

  // Populate seller info
  await item.populate('seller', 'name userType subscriptionPlan isVerified');

  // Add fee info to response
  const feePercentage = req.user.subscriptionPlan === "pro" ? 5 : 10;
  const feeAmount = item.stripeFee || calculateMarketFee(item.price, req.user.subscriptionPlan);

  console.log("✅ Item updated successfully. Final state:", {
    photos: item.photos?.length || 0,
    videos: item.videos?.length || 0,
    audio: !!item.audioFile
  });

  res.status(200).json({
    success: true,
    message: "Market item updated successfully",
    data: item,
    feeInfo: {
      percentage: feePercentage,
      amount: feeAmount,
      total: item.price + feeAmount,
      plan: req.user.subscriptionPlan || "free"
    }
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

  // Delete audio file if exists
  if (item.audioFile) {
    await deleteFromCloudinary(item.audioFile);
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

  // Delete audio file
  if (item.audioFile) {
    await deleteFromCloudinary(item.audioFile);
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

  // Delete audio file
  if (item.audioFile) {
    await deleteFromCloudinary(item.audioFile);
  }

  await item.deleteOne();
  res.status(200).json({ success: true, message: "Seller item deleted" });
});