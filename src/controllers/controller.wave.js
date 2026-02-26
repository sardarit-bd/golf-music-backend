import { validationResult } from "express-validator";
import Wave from "../models/model.wave.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { extractYouTubeId, getYouTubeThumbnail } from "../utils/youtube.js";

// GET all waves (public)
export const getAllWaves = asyncHandler(async (req, res) => {
  const waves = await Wave.find().sort({ createdAt: -1 });
  res.status(200).json({
    success: true,
    data: { waves },
  });
});

// GET single wave (public)
export const getWaveById = asyncHandler(async (req, res, next) => {
  const wave = await Wave.findById(req.params.id);
  
  if (!wave) {
    return next(new ErrorResponse("Wave not found", 404));
  }
  
  res.status(200).json({
    success: true,
    data: { wave },
  });
});

// CREATE wave (admin)
export const createWave = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new ErrorResponse(errors.array().map(e => e.msg).join(", "), 400)
    );
  }

  const { title, description, youtubeUrl } = req.body;

  const videoId = extractYouTubeId(youtubeUrl);
  if (!videoId) {
    return next(new ErrorResponse("Invalid YouTube URL", 400));
  }

  let thumbnailUrl = "";

  if (req.file?.path) {
    thumbnailUrl = req.file.path;
  } else {
    thumbnailUrl = getYouTubeThumbnail(videoId);
  }

  // Check if wave exists
  const existingWave = await Wave.findOne({ youtubeUrl });
  if (existingWave) {
    return next(new ErrorResponse("This YouTube video already exists", 400));
  }

  const newWave = await Wave.create({
    title,
    description: description || "",
    youtubeUrl,
    thumbnail: thumbnailUrl,
  });

  res.status(201).json({
    success: true,
    message: "Wave added successfully!",
    data: { wave: newWave },
  });
});

// UPDATE wave (admin)
export const updateWave = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new ErrorResponse(errors.array().map(e => e.msg).join(", "), 400)
    );
  }

  const wave = await Wave.findById(req.params.id);
  if (!wave) {
    return next(new ErrorResponse("Wave not found", 404));
  }

  const { title, description, youtubeUrl } = req.body;

  // Update fields
  if (title) wave.title = title;
  if (description !== undefined) wave.description = description;
  
  if (youtubeUrl && youtubeUrl !== wave.youtubeUrl) {
    const videoId = extractYouTubeId(youtubeUrl);
    if (!videoId) {
      return next(new ErrorResponse("Invalid YouTube URL", 400));
    }
    
    // Check if new URL already exists
    const existingWave = await Wave.findOne({ youtubeUrl, _id: { $ne: wave._id } });
    if (existingWave) {
      return next(new ErrorResponse("This YouTube video already exists", 400));
    }
    
    wave.youtubeUrl = youtubeUrl;
    
    // Update thumbnail if no custom upload
    if (!req.file?.path) {
      wave.thumbnail = getYouTubeThumbnail(videoId);
    }
  }

  // Update thumbnail if new file uploaded
  if (req.file?.path) {
    wave.thumbnail = req.file.path;
  }

  await wave.save();

  res.status(200).json({
    success: true,
    message: "Wave updated successfully!",
    data: { wave },
  });
});

// DELETE wave (admin)
export const deleteWave = asyncHandler(async (req, res, next) => {
  const wave = await Wave.findById(req.params.id);
  if (!wave) {
    return next(new ErrorResponse("Wave not found", 404));
  }

  await wave.deleteOne();

  res.status(200).json({
    success: true,
    message: "Wave deleted successfully!",
  });
});

// SEARCH waves (public) - Updated to use text search
export const searchWaves = asyncHandler(async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return getAllWaves(req, res);
  }

  // Try text search first, fallback to regex if needed
  try {
    const waves = await Wave.find(
      { $text: { $search: query } },
      { score: { $meta: "textScore" } }
    ).sort({ score: { $meta: "textScore" } });

    res.status(200).json({
      success: true,
      data: { waves },
    });
  } catch (error) {
    // Fallback to regex search if text search fails
    const waves = await Wave.find({
      $or: [
        { title: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } }
      ]
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: { waves },
    });
  }
});