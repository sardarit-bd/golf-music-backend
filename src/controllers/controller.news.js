import { validationResult } from "express-validator";
import News from "../models/model.news.js";
import { v2 as cloudinary } from "cloudinary";
import { ErrorResponse } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Helper function to get state from city
const getStateFromCity = (city) => {
  if (!city) return '';
  
  const cityLower = city.toLowerCase();
  
  const stateMap = {
    // Louisiana cities
    'new orleans': 'Louisiana',
    'baton rouge': 'Louisiana',
    'lafayette': 'Louisiana',
    'shreveport': 'Louisiana',
    'lake charles': 'Louisiana',
    'monroe': 'Louisiana',
    
    // Mississippi cities
    'jackson': 'Mississippi',
    'biloxi': 'Mississippi',
    'gulfport': 'Mississippi',
    'oxford': 'Mississippi',
    'hattiesburg': 'Mississippi',
    
    // Alabama cities
    'birmingham': 'Alabama',
    'mobile': 'Alabama',
    'huntsville': 'Alabama',
    'tuscaloosa': 'Alabama',
    
    // Florida cities
    'tampa': 'Florida',
    'st. petersburg': 'Florida',
    'clearwater': 'Florida',
    'pensacola': 'Florida',
    'panama city': 'Florida',
    'fort myers': 'Florida',
  };
  
  return stateMap[cityLower] || '';
};

//  CREATE NEWS
export const createNews = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ErrorResponse("Validation failed", 400, { details: errors.array() }));
  }

  const { title, description, location, credit } = req.body;
  const normalizedLocation = location?.toLowerCase();

  // Upload images (max 5)
  let uploadedPhotos = [];
  if (req.files && req.files.length > 0) {
    const maxPhotos = 5;
    const filesToUpload = req.files.slice(0, maxPhotos);
    
    uploadedPhotos = await Promise.all(
      filesToUpload.map(async (file) => {
        const uploadRes = await cloudinary.uploader.upload(file.path, {
          folder: "gulf-music/news",
          resource_type: "auto"
        });
        return {
          url: uploadRes.secure_url,
          filename: uploadRes.public_id,
          publicId: uploadRes.public_id
        };
      })
    );
  }

  // Model will auto-calculate state in pre-save middleware
  const news = await News.create({
    title,
    description,
    location: normalizedLocation,
    credit,
    photos: uploadedPhotos,
    journalist: req.user.id,
  });

  res.status(201).json({
    success: true,
    message: "News created successfully",
    data: { news },
  });
});

//  UPDATE NEWS
export const updateNews = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new ErrorResponse("Validation failed", 400, { details: errors.array() })
    );
  }

  const { title, description, location, credit, deletedPhotos } = req.body;
  const normalizedLocation = location?.toLowerCase();
  const state = location ? getStateFromCity(normalizedLocation) : undefined;

  let news = await News.findById(req.params.id);
  if (!news) return next(new ErrorResponse("News not found", 404));

  // Authorization check - only journalist who created or admin can update
  if (news.journalist.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse("Not authorized to update this news", 403));
  }

  // Handle photo deletions
  if (deletedPhotos && Array.isArray(deletedPhotos)) {
    for (const filename of deletedPhotos) {
      try {
        await cloudinary.uploader.destroy(filename);
      } catch (err) {
        console.warn(`Failed to delete image: ${filename}`);
      }
    }
    // Remove deleted photos from array
    news.photos = news.photos.filter(photo => 
      !deletedPhotos.includes(photo.filename)
    );
  }

  // Upload new photos (if provided) - Max 5 total photos
  const existingPhotoCount = news.photos.length;
  const availableSlots = Math.max(0, 5 - existingPhotoCount);
  
  let newPhotos = [];
  if (req.files && req.files.length > 0 && availableSlots > 0) {
    const filesToUpload = req.files.slice(0, availableSlots);
    
    newPhotos = await Promise.all(
      filesToUpload.map(async (file) => {
        const uploadRes = await cloudinary.uploader.upload(file.path, {
          folder: "gulf-music/news",
          resource_type: "auto"
        });
        return {
          url: uploadRes.secure_url,
          filename: uploadRes.public_id,
          publicId: uploadRes.public_id
        };
      })
    );
    
    // Add new photos to existing ones
    news.photos = [...news.photos, ...newPhotos];
  }

  // Dynamically build update object
  const updateData = {};
  
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (location !== undefined) {
    updateData.location = normalizedLocation;
    updateData.state = state;
  }
  if (credit !== undefined) updateData.credit = credit;
  if (newPhotos.length > 0 || deletedPhotos) updateData.photos = news.photos;

  // Update record
  news = await News.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    message: "News updated successfully",
    data: { news },
  });
});

//  GET ALL NEWS WITH FILTERS AND PAGINATION
export const getNewsByLocation = asyncHandler(async (req, res, next) => {
  const { location, state, page = 1, limit = 10, featured } = req.query;
  const query = { isActive: true };

  // Apply filters
  if (location && location !== "all") {
    query.location = location.toLowerCase();
  }
  
  if (state && state !== "all") {
    query.state = state;
  }
  
  if (featured === "true") {
    query.isFeatured = true;
  }

  const skip = (Number(page) - 1) * Number(limit);
  
  const news = await News.find(query)
    .populate({
      path: 'journalist',
      select: 'username email fullName profilePhoto'
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));
  
  const total = await News.countDocuments(query);

  // Increment views for featured/news details if needed
  if (req.query.incrementViews === 'true') {
    await News.updateMany(
      { _id: { $in: news.map(n => n._id) } },
      { $inc: { views: 1 } }
    );
  }

  res.status(200).json({
    success: true,
    data: { 
      news,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total,
        limit: Number(limit)
      }
    },
  });
});

//  GET SINGLE NEWS BY ID (with view increment)
export const getNews = asyncHandler(async (req, res, next) => {
  const news = await News.findById(req.params.id)
    .populate({
      path: 'journalist',
      select: 'username email fullName profilePhoto bio city state'
    });
  
  if (!news) {
    return next(new ErrorResponse("News not found", 404));
  }

  // Increment view count
  news.views += 1;
  await news.save();

  // Get related news (same location)
  const relatedNews = await News.find({
    _id: { $ne: news._id },
    location: news.location,
    isActive: true
  })
  .populate('journalist', 'fullName')
  .sort({ createdAt: -1 })
  .limit(3);

  res.status(200).json({
    success: true,
    data: { 
      news,
      relatedNews 
    },
  });
});

//  GET MY NEWS (for logged-in journalist)
export const getMyNews = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10, status = "active" } = req.query;
  
  const query = { journalist: req.user.id };
  
  if (status === "active") {
    query.isActive = true;
  } else if (status === "inactive") {
    query.isActive = false;
  }
  
  const skip = (Number(page) - 1) * Number(limit);
  
  const news = await News.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));
  
  const total = await News.countDocuments(query);

  const stats = {
    total: await News.countDocuments({ journalist: req.user.id }),
    active: await News.countDocuments({ journalist: req.user.id, isActive: true }),
    inactive: await News.countDocuments({ journalist: req.user.id, isActive: false }),
    views: await News.aggregate([
      { $match: { journalist: req.user.id } },
      { $group: { _id: null, totalViews: { $sum: "$views" } } }
    ]).then(result => result[0]?.totalViews || 0)
  };

  res.status(200).json({
    success: true,
    data: { 
      news,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total
      },
      stats
    },
  });
});

//  DELETE NEWS (Soft Delete + Cloudinary Cleanup)
export const deleteNews = asyncHandler(async (req, res, next) => {
  const news = await News.findById(req.params.id);
  if (!news) {
    return next(new ErrorResponse("News not found", 404));
  }

  // Authorization check
  if (news.journalist.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse("Not authorized to delete this news", 403));
  }

  // If admin is deleting, remove permanently. Otherwise soft delete.
  if (req.user.role === 'admin') {
    // Delete photos from Cloudinary
    if (news.photos?.length) {
      for (const photo of news.photos) {
        try {
          await cloudinary.uploader.destroy(photo.filename);
        } catch (err) {
          console.warn(`Failed to delete image: ${photo.filename}`);
        }
      }
    }
    await News.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      success: true,
      message: "News permanently deleted",
    });
  } else {
    // Soft delete for journalists
    news.isActive = false;
    await news.save();
    
    res.status(200).json({
      success: true,
      message: "News deleted successfully (soft delete)",
    });
  }
});

//  GET FEATURED NEWS
export const getFeaturedNews = asyncHandler(async (req, res, next) => {
  const news = await News.find({ 
    isFeatured: true, 
    isActive: true 
  })
    .populate('journalist', 'fullName profilePhoto')
    .sort({ createdAt: -1 })
    .limit(5);

  res.status(200).json({
    success: true,
    data: { news },
  });
});

//  GET NEWS STATISTICS
export const getNewsStats = asyncHandler(async (req, res, next) => {
  const stats = await News.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$state',
        count: { $sum: 1 },
        totalViews: { $sum: '$views' },
        avgViews: { $avg: '$views' }
      }
    },
    { $sort: { count: -1 } }
  ]);

  const totalNews = await News.countDocuments({ isActive: true });
  const totalViews = await News.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: null, total: { $sum: '$views' } } }
  ]);

  res.status(200).json({
    success: true,
    data: {
      stats,
      totalNews,
      totalViews: totalViews[0]?.total || 0
    },
  });
});

//  SEARCH NEWS
export const searchNews = asyncHandler(async (req, res, next) => {
  const { q, page = 1, limit = 10 } = req.query;
  
  if (!q || q.trim() === '') {
    return next(new ErrorResponse('Search query is required', 400));
  }

  const query = {
    isActive: true,
    $or: [
      { title: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
      { credit: { $regex: q, $options: 'i' } },
      { location: { $regex: q, $options: 'i' } }
    ]
  };

  const skip = (Number(page) - 1) * Number(limit);
  
  const news = await News.find(query)
    .populate('journalist', 'fullName profilePhoto')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));
  
  const total = await News.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      news,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total
      },
      query: q
    },
  });
});