import Cast from "../models/model.cast.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { cloudinary } from "../config/cloudinary.js";
import { extractYouTubeId, getYouTubeThumbnail } from "../utils/youtube.js";

// ===============================
// GET ALL CASTS (public)
// ===============================
export const getAllCasts = asyncHandler(async (req, res) => {
  const casts = await Cast.find().sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: { casts }
  });
});

// ===============================
// GET SINGLE CAST (public)
// ===============================
export const getCastById = asyncHandler(async (req, res, next) => {
  const cast = await Cast.findById(req.params.id);

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
  } = req.body;

  if (!title || !videoType) {
    return next(new ErrorResponse("Title and video type are required", 400));
  }

  const exists = await Cast.findOne({
    title: new RegExp(`^${title}$`, "i"),
  });

  if (exists) {
    return next(new ErrorResponse("Cast title already exists", 400));
  }

  let finalThumbnail = thumbnail;

  // YouTube
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

  // Upload
  if (videoType === "upload") {
    if (!video || !videoPublicId) {
      return next(
        new ErrorResponse("Video upload incomplete (missing Cloudinary data)", 400)
      );
    }

    if (!finalThumbnail && videoPublicId) {
      finalThumbnail = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload/w_500,h_300,c_fill,q_auto/${videoPublicId}.jpg`;
    }
  }

  const cast = await Cast.create({
    title: title.trim(),
    description: description || "",
    videoType,
    video: videoType === "upload" ? video : undefined,
    videoPublicId: videoType === "upload" ? videoPublicId : undefined,
    youtubeUrl: videoType === "youtube" ? youtubeUrl : undefined,
    thumbnail: finalThumbnail,
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
  const cast = await Cast.findById(req.params.id);

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
  } = req.body;

  if (title) cast.title = title.trim();
  if (description !== undefined) cast.description = description;

  // Handle video type change
  if (videoType && videoType !== cast.videoType) {
    if (cast.videoPublicId) {
      await cloudinary.uploader.destroy(cast.videoPublicId, {
        resource_type: "video",
      });
    }

    cast.video = undefined;
    cast.videoPublicId = undefined;
    cast.youtubeUrl = undefined;
    cast.thumbnail = undefined;
    cast.videoType = videoType;
  }

  // YouTube update
  if (cast.videoType === "youtube" && youtubeUrl) {
    const videoId = extractYouTubeId(youtubeUrl);
    if (!videoId) {
      return next(new ErrorResponse("Invalid YouTube URL", 400));
    }

    cast.youtubeUrl = youtubeUrl;
    cast.thumbnail = getYouTubeThumbnail(videoId);
  }

  // Upload update
  if (cast.videoType === "upload") {
    if (video && videoPublicId) {
      if (cast.videoPublicId && cast.videoPublicId !== videoPublicId) {
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
  const cast = await Cast.findById(req.params.id);

  if (!cast) {
    return next(new ErrorResponse("Cast not found", 404));
  }

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
// SEARCH CASTS (public)
// ===============================
export const searchCasts = asyncHandler(async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return getAllCasts(req, res);
  }

  const casts = await Cast.find(
    { $text: { $search: query } },
    { score: { $meta: "textScore" } }
  ).sort({ score: { $meta: "textScore" } });

  res.status(200).json({
    success: true,
    data: { casts },
  });
});