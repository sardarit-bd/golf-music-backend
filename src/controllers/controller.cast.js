import Cast from "../models/model.cast.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { cloudinary } from "../config/cloudinary.js";
import { extractYouTubeId, getYouTubeThumbnail } from "../utils/youtube.js";

// ===============================
// GET ALL PODCASTS
// ===============================
export const getAllCasts = asyncHandler(async (req, res) => {
  const casts = await Cast.find().sort({ createdAt: -1 });
  res.json({ success: true, data: { casts } });
});

// ===============================
// CREATE PODCAST
// ===============================
export const createCast = asyncHandler(async (req, res, next) => {
  const {
    title,
    description,
    videoType,
    youtubeUrl,
    videoUrl,
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
    return next(new ErrorResponse("Title already exists", 400));
  }

  let finalThumbnail = thumbnail;

  // ▶️ YOUTUBE
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

  // 🎥 UPLOAD (Next-Cloudinary)
  if (videoType === "upload") {
    if (!videoUrl || !videoPublicId) {
      return next(
        new ErrorResponse("Video upload incomplete (missing Cloudinary data)", 400)
      );
    }
  }

  const cast = await Cast.create({
    title: title.trim(),
    description,
    videoType,
    video: videoType === "upload" ? videoUrl : undefined,
    videoPublicId: videoType === "upload" ? videoPublicId : undefined,
    youtubeUrl: videoType === "youtube" ? youtubeUrl : undefined,
    thumbnail: finalThumbnail,
  });

  res.status(201).json({
    success: true,
    message: "Podcast added successfully!",
    data: { cast },
  });
});

// ===============================
// UPDATE PODCAST
// ===============================
export const updateCast = asyncHandler(async (req, res, next) => {
  const cast = await Cast.findById(req.params.id);
  if (!cast) return next(new ErrorResponse("Podcast not found", 404));

  const {
    title,
    description,
    videoType,
    youtubeUrl,
    videoUrl,
    videoPublicId,
    thumbnail,
  } = req.body;

  if (title) cast.title = title.trim();
  if (description !== undefined) cast.description = description;

  // 🔁 Switch type
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

  // ▶️ YouTube
  if (cast.videoType === "youtube") {
    const videoId = extractYouTubeId(youtubeUrl);
    if (!videoId) {
      return next(new ErrorResponse("Invalid YouTube URL", 400));
    }
    cast.youtubeUrl = youtubeUrl;
    cast.thumbnail = getYouTubeThumbnail(videoId);
  }

  // 🎥 Upload (Next-Cloudinary)
  if (cast.videoType === "upload" && videoUrl && videoPublicId) {
    if (cast.videoPublicId) {
      await cloudinary.uploader.destroy(cast.videoPublicId, {
        resource_type: "video",
      });
    }
    cast.video = videoUrl;
    cast.videoPublicId = videoPublicId;
    if (thumbnail) cast.thumbnail = thumbnail;
  }

  await cast.save();

  res.json({
    success: true,
    message: "Podcast updated successfully!",
    data: { cast },
  });
});

// ===============================
// DELETE PODCAST
// ===============================
export const deleteCast = asyncHandler(async (req, res) => {
  const cast = await Cast.findById(req.params.id);
  if (!cast) {
    return res.status(404).json({ success: false, message: "Podcast not found" });
  }

  if (cast.videoPublicId) {
    await cloudinary.uploader.destroy(cast.videoPublicId, {
      resource_type: "video",
    });
  }

  await cast.deleteOne();

  res.json({
    success: true,
    message: "Podcast deleted successfully!",
  });
});
