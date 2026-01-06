import { ErrorResponse } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import MarketItem from "../models/model.marketItem.js";
import { cloudinary } from "../config/cloudinary.js";

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

  const validLocations = ["New Orleans", "Biloxi", "Mobile", "Pensacola", ""];
  if (location && !validLocations.includes(location)) {
    return next(new ErrorResponse("Invalid location", 400));
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

  const { title, description, price, location, status, removedPhotos = [] } = req.body;

  const validLocations = ["New Orleans", "Biloxi", "Mobile", "Pensacola", ""];
  if (location !== undefined && !validLocations.includes(location)) {
    return next(new ErrorResponse("Invalid location", 400));
  }

  // Handle removed photos
  if (removedPhotos && Array.isArray(removedPhotos)) {
    for (const photoUrl of removedPhotos) {
      if (photoUrl && photoUrl.includes('cloudinary')) {
        try {
          const publicId = photoUrl.split('/').pop().split('.')[0];
          
          // Detect resource type
          if (photoUrl.includes('/video/') || photoUrl.includes('.mp4')) {
            await cloudinary.uploader.destroy(`market/videos/${publicId}`, {
              resource_type: "video"
            });
          } else {
            await cloudinary.uploader.destroy(`market/photos/${publicId}`);
          }
        } catch (error) {
          console.error("Error deleting photo from Cloudinary:", error);
        }
      }
    }
    
    // Remove from array
    item.photos = item.photos.filter(photo => !removedPhotos.includes(photo));
  }

  if (title !== undefined) item.title = title;
  if (description !== undefined) item.description = description;
  if (price !== undefined) item.price = price;
  if (location !== undefined) item.location = location;
  if (status !== undefined) item.status = status;

  if (req.files?.photos?.length) {
    const newPhotos = req.files.photos.map((file) => file.path);
    const totalPhotos = (item.photos?.length || 0) + newPhotos.length;

    if (totalPhotos > 5) {
      return next(new ErrorResponse("Maximum 5 photos allowed", 400));
    }

    item.photos = [...(item.photos || []), ...newPhotos];
  }

  // If user wants to remove video
  if (req.body.removeVideo === 'true') {
    if (item.videos?.length) {
      for (const v of item.videos) {
        try {
          const publicId = v.split('/').pop().split('.')[0];
          await cloudinary.uploader.destroy(`market/videos/${publicId}`, {
            resource_type: "video",
          });
        } catch (err) {
          console.error("Error deleting video:", err);
        }
      }
    }
    item.videos = [];
  }

  // Upload new video
  if (req.files?.video?.length) {
    // Delete old video first if exists
    if (item.videos?.length) {
      for (const v of item.videos) {
        try {
          const publicId = v.split('/').pop().split('.')[0];
          await cloudinary.uploader.destroy(`market/videos/${publicId}`, {
            resource_type: "video",
          });
        } catch (err) {
          console.error("Error deleting old video:", err);
        }
      }
    }

    // Save new video
    item.videos = [req.files.video[0].path];
  }

  await item.save();
  
  // Populate seller info
  await item.populate('seller', 'name userType subscriptionPlan isVerified');
  
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

  // Delete from Cloudinary only if it's a cloudinary URL
  if (photoUrlToDelete && photoUrlToDelete.includes('cloudinary')) {
    try {
      const publicId = photoUrlToDelete.split('/').pop().split('.')[0];
      
      // Try to detect if it's a video or image
      if (photoUrlToDelete.includes('/video/') || photoUrlToDelete.includes('.mp4')) {
        await cloudinary.uploader.destroy(`market/videos/${publicId}`, {
          resource_type: "video"
        });
      } else {
        await cloudinary.uploader.destroy(`market/photos/${publicId}`);
      }
    } catch (error) {
      console.error("Error deleting from Cloudinary:", error);
    }
  }

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
      try {
        const publicId = photoUrl.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`market/photos/${publicId}`);
      } catch (error) {
        console.error(`Error deleting photo ${photoUrl}:`, error);
      }
    }
  }

  // Delete video from Cloudinary if exists
  if (item.videos?.length) {
    for (const v of item.videos) {
      try {
        const publicId = v.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(`market/videos/${publicId}`, {
          resource_type: "video",
        });
      } catch (err) {
        console.error("Error deleting video:", err);
      }
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
      try {
        const publicId = photoUrl.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(`market/photos/${publicId}`);
      } catch (error) {
        console.error(`Error deleting photo ${photoUrl}:`, error);
      }
    }
  }


  if (item.videos?.length) {
    for (const videoUrl of item.videos) {
      try {
        const publicId = videoUrl.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(`market/videos/${publicId}`, {
          resource_type: "video",
        });
      } catch (error) {
        console.error(`Error deleting video ${videoUrl}:`, error);
      }
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
      try {
        const publicId = photoUrl.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(`market/photos/${publicId}`);
      } catch (error) {
        console.error(`Error deleting photo ${photoUrl}:`, error);
      }
    }
  }

  if (item.videos?.length) {
    for (const videoUrl of item.videos) {
      try {
        const publicId = videoUrl.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(`market/videos/${publicId}`, {
          resource_type: "video",
        });
      } catch (error) {
        console.error(`Error deleting video ${videoUrl}:`, error);
      }
    }
  }

  await item.deleteOne();
  res.status(200).json({ success: true, message: "Seller item deleted" });
});
