import Cast from "../models/model.cast.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { cloudinary } from "../config/cloudinary.js";
import { extractYouTubeId, getYouTubeThumbnail } from "../utils/youtube.js";

// ===============================
// GET ALL CASTS (public)
// ===============================
export const getAllCasts = asyncHandler(async (req, res) => {
  // Exclude page text documents from regular casts
  const casts = await Cast.find({ isPageText: { $ne: true } }).sort({ createdAt: -1 });
  
  res.status(200).json({ 
    success: true, 
    data: { casts } 
  });
});

// ===============================
// GET SINGLE CAST (public)
// ===============================
export const getCastById = asyncHandler(async (req, res, next) => {
  const cast = await Cast.findOne({ 
    _id: req.params.id,
    isPageText: { $ne: true }
  });
  
  if (!cast) {
    return next(new ErrorResponse("Cast not found", 404));
  }
  
  res.status(200).json({ 
    success: true, 
    data: { cast } 
  });
});

// ===============================
// CREATE CAST (admin)
// ===============================
export const createCast = asyncHandler(async (req, res, next) => {
  const {
    title,
    description,
    videoType,
    youtubeUrl,
    video,
    videoPublicId,
    thumbnail,
    // duration,
    // tags,
    publishedDate
  } = req.body;

  // Basic validation
  if (!title || !videoType) {
    return next(new ErrorResponse("Title and video type are required", 400));
  }

  // Check duplicate title
  const exists = await Cast.findOne({
    title: new RegExp(`^${title}$`, "i"),
    isPageText: { $ne: true }
  });
  
  if (exists) {
    return next(new ErrorResponse("Cast title already exists", 400));
  }

  let finalThumbnail = thumbnail;

  // YouTube video type
  if (videoType === "youtube") {
    if (!youtubeUrl) {
      return next(new ErrorResponse("YouTube URL is required", 400));
    }

    const videoId = extractYouTubeId(youtubeUrl);
    if (!videoId) {
      return next(new ErrorResponse("Invalid YouTube URL", 400));
    }

    finalThumbnail = getYouTubeThumbnail(videoId);
  }

  // Upload video type
  if (videoType === "upload") {
    if (!video || !videoPublicId) {
      return next(
        new ErrorResponse("Video upload incomplete (missing Cloudinary data)", 400)
      );
    }
    
    // Use custom thumbnail if provided
    if (!finalThumbnail && videoPublicId) {
      finalThumbnail = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload/w_500,h_300,c_fill,q_auto/${videoPublicId}.jpg`;
    }
  }

  // Create new cast
  const cast = await Cast.create({
    title: title.trim(),
    description: description || "",
    videoType,
    video: videoType === "upload" ? video : undefined,
    videoPublicId: videoType === "upload" ? videoPublicId : undefined,
    youtubeUrl: videoType === "youtube" ? youtubeUrl : undefined,
    thumbnail: finalThumbnail,
    duration: duration || 0,
    tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
    publishedDate: publishedDate || Date.now()
  });

  res.status(201).json({
    success: true,
    message: "Cast added successfully!",
    data: { cast },
  });
});

// ===============================
// UPDATE CAST (admin)
// ===============================
export const updateCast = asyncHandler(async (req, res, next) => {
  const cast = await Cast.findOne({ 
    _id: req.params.id,
    isPageText: { $ne: true }
  });
  
  if (!cast) {
    return next(new ErrorResponse("Cast not found", 404));
  }

  const {
    title,
    description,
    videoType,
    youtubeUrl,
    video,
    videoPublicId,
    thumbnail,
    duration,
    tags
  } = req.body;

  // Update basic fields
  if (title) cast.title = title.trim();
  if (description !== undefined) cast.description = description;
  if (duration !== undefined) cast.duration = parseInt(duration) || 0;
  if (tags !== undefined) cast.tags = tags.split(',').map(tag => tag.trim());

  // Handle video type change
  if (videoType && videoType !== cast.videoType) {
    // Delete old video from Cloudinary if exists
    if (cast.videoPublicId) {
      await cloudinary.uploader.destroy(cast.videoPublicId, {
        resource_type: "video",
      });
    }

    // Reset video fields
    cast.video = undefined;
    cast.videoPublicId = undefined;
    cast.youtubeUrl = undefined;
    cast.thumbnail = undefined;
    cast.videoType = videoType;
  }

  // Update based on video type
  if (cast.videoType === "youtube") {
    if (youtubeUrl) {
      const videoId = extractYouTubeId(youtubeUrl);
      if (!videoId) {
        return next(new ErrorResponse("Invalid YouTube URL", 400));
      }
      cast.youtubeUrl = youtubeUrl;
      cast.thumbnail = getYouTubeThumbnail(videoId);
    }
  }

  if (cast.videoType === "upload") {
    if (video && videoPublicId) {
      // Delete old video if exists
      if (cast.videoPublicId) {
        await cloudinary.uploader.destroy(cast.videoPublicId, {
          resource_type: "video",
        });
      }
      
      cast.video = video;
      cast.videoPublicId = videoPublicId;
    }
    
    if (thumbnail) {
      cast.thumbnail = thumbnail;
    }
  }

  // Save updated cast
  await cast.save();

  res.status(200).json({
    success: true,
    message: "Cast updated successfully!",
    data: { cast },
  });
});

// ===============================
// DELETE CAST (admin)
// ===============================
export const deleteCast = asyncHandler(async (req, res, next) => {
  const cast = await Cast.findOne({ 
    _id: req.params.id,
    isPageText: { $ne: true }
  });
  
  if (!cast) {
    return next(new ErrorResponse("Cast not found", 404));
  }

  // Delete video from Cloudinary if exists
  if (cast.videoPublicId) {
    await cloudinary.uploader.destroy(cast.videoPublicId, {
      resource_type: "video",
    });
  }

  await cast.deleteOne();

  res.status(200).json({
    success: true,
    message: "Cast deleted successfully!",
  });
});

// ===============================
// GET SECTION TEXT (public) - NO VALIDATION
// ===============================
export const getCastSectionText = asyncHandler(async (req, res) => {
  let pageText = await Cast.findOne({ isPageText: true });

  if (!pageText) {
    // Create default page text if doesn't exist
    pageText = await Cast.create({
      isPageText: true,
      sectionTitle: "Casts",
      sectionSubtitle: "Explore the latest audio casts and conversations.",
      yourCastsTitle: "Your Casts",
    });
  }

  res.status(200).json({
    success: true,
    data: {
      sectionTitle: pageText.sectionTitle,
      sectionSubtitle: pageText.sectionSubtitle,
      yourCastsTitle: pageText.yourCastsTitle,
    },
  });
});

// ===============================
// UPDATE SECTION TEXT (admin) - NO VALIDATION
// ===============================
export const updateCastSectionText = asyncHandler(async (req, res, next) => {
  const { sectionTitle, sectionSubtitle, yourCastsTitle } = req.body;

  // Check if at least one field is provided (optional, আপনি চাইলে এইটাও রিমুভ করতে পারেন)
  if (!sectionTitle && !sectionSubtitle && !yourCastsTitle) {
    return next(new ErrorResponse("At least one field is required to update", 400));
  }

  const updateData = {};
  
  // Optional fields - only update if provided
  if (sectionTitle !== undefined) {
    updateData.sectionTitle = sectionTitle.trim();
  }
  
  if (sectionSubtitle !== undefined) {
    updateData.sectionSubtitle = sectionSubtitle.trim();
  }
  
  if (yourCastsTitle !== undefined) {
    updateData.yourCastsTitle = yourCastsTitle.trim();
  }

  // Find or create the page text document
  const pageText = await Cast.findOneAndUpdate(
    { isPageText: true },
    updateData,
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  res.status(200).json({
    success: true,
    message: "Section text updated successfully!",
    data: {
      sectionTitle: pageText.sectionTitle,
      sectionSubtitle: pageText.sectionSubtitle,
      yourCastsTitle: pageText.yourCastsTitle,
    },
  });
});

// ===============================
// SEARCH CASTS (public)
// ===============================
export const searchCasts = asyncHandler(async (req, res) => {
  const { query } = req.query;
  
  if (!query) {
    return getAllCasts(req, res);
  }

  const casts = await Cast.find(
    { 
      $text: { $search: query },
      isPageText: { $ne: true }
    },
    { score: { $meta: "textScore" } }
  ).sort({ score: { $meta: "textScore" } });

  res.status(200).json({
    success: true,
    data: { casts },
  });
});

// ===============================
// GET CASTS BY TAG (public)
// ===============================
export const getCastsByTag = asyncHandler(async (req, res) => {
  const { tag } = req.params;
  
  const casts = await Cast.find({
    tags: { $in: [tag] },
    isPageText: { $ne: true }
  }).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: { casts },
  });
});