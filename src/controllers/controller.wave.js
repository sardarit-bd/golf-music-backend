import { validationResult } from "express-validator";
import Wave from "../models/model.wave.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";

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

  const { title, thumbnail, youtubeUrl } = req.body;

  // Duplicate check (title or YouTube URL)
  const [titleExists, videoExists] = await Promise.all([
    Wave.findOne({ title: new RegExp(`^${title}$`, "i") }),
    Wave.findOne({ youtubeUrl }),
  ]);

  if (titleExists && videoExists)
    return next(new ErrorResponse("Wave with same title and YouTube video already exists", 400));
  if (titleExists)
    return next(new ErrorResponse("Wave title already exists", 400));
  if (videoExists)
    return next(new ErrorResponse("This YouTube video already exists", 400));

  const newWave = await Wave.create({ title, thumbnail, youtubeUrl });

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

  const { title, thumbnail, youtubeUrl } = req.body;

  // Duplicate check (excluding self)
  if (title) {
    const existing = await Wave.findOne({
      title: new RegExp(`^${title}$`, "i"),
      _id: { $ne: req.params.id },
    });
    if (existing)
      return next(new ErrorResponse("Wave title already exists", 400));
  }

  if (youtubeUrl) {
    const existing = await Wave.findOne({
      youtubeUrl,
      _id: { $ne: req.params.id },
    });
    if (existing)
      return next(new ErrorResponse("This YouTube video already exists", 400));
  }

  const updated = await Wave.findByIdAndUpdate(
    req.params.id,
    { title, thumbnail, youtubeUrl },
    { new: true, runValidators: true }
  );

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
