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

// CREATE wave (admin)
export const createWave = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new ErrorResponse(errors.array().map(e => e.msg).join(", "), 400)
    );
  }

  const { title, youtubeUrl } = req.body;

  const videoId = extractYouTubeId(youtubeUrl);
  if (!videoId) {
    return next(new ErrorResponse("Invalid YouTube URL", 400));
  }

  let thumbnailUrl = "";

  if (req.file?.path) {
    thumbnailUrl = req.file.path;
  }
  else {
    thumbnailUrl = getYouTubeThumbnail(videoId);
  }

  const [titleExists, videoExists] = await Promise.all([
    Wave.findOne({ title: new RegExp(`^${title}$`, "i") }),
    Wave.findOne({ youtubeUrl }),
  ]);

  if (titleExists)
    return next(new ErrorResponse("Wave title already exists", 400));
  if (videoExists)
    return next(new ErrorResponse("This YouTube video already exists", 400));

  const newWave = await Wave.create({
    title,
    youtubeUrl,
    thumbnail: thumbnailUrl,
  });

  res.status(201).json({
    success: true,
    message: "Open Mic added successfully!",
    data: { newWave },
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

  const updateData = { ...req.body };

  if (req.file && req.file.path) {
    updateData.thumbnail = req.file.path;
  }

  const updated = await Wave.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!updated) return next(new ErrorResponse("Wave not found", 404));

  res.status(200).json({
    success: true,
    message: "Open Mic updated successfully!",
    data: { updated },
  });
});


// DELETE wave (admin)
export const deleteWave = asyncHandler(async (req, res, next) => {
  const wave = await Wave.findById(req.params.id);
  if (!wave) return next(new ErrorResponse("Wave not found", 404));

  await wave.deleteOne();

  res.status(200).json({
    success: true,
    message: "Open Mic deleted successfully!",
  });
});
