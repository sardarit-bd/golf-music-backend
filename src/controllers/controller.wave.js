import { validationResult } from "express-validator";
import Wave from "../models/model.wave.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { extractYouTubeId, getYouTubeThumbnail } from "../utils/youtube.js";

// GET all waves (public)
export const getAllWaves = asyncHandler(async (req, res) => {
  const waves = await Wave.find({ isPageText: { $ne: true } }).sort({ createdAt: -1 });
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
  } else {
    thumbnailUrl = getYouTubeThumbnail(videoId);
  }

  const [titleExists, videoExists] = await Promise.all([
    Wave.findOne({ title: new RegExp(`^${title}$`, "i"), isPageText: { $ne: true } }),
    Wave.findOne({ youtubeUrl, isPageText: { $ne: true } }),
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
    message: "Wave added successfully!",
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

  const updated = await Wave.findOneAndUpdate(
    { _id: req.params.id, isPageText: { $ne: true } },
    updateData,
    {
      new: true,
      runValidators: true,
    }
  );

  if (!updated) return next(new ErrorResponse("Wave not found", 404));

  res.status(200).json({
    success: true,
    message: "Wave updated successfully!",
    data: { updated },
  });
});

// DELETE wave (admin)
export const deleteWave = asyncHandler(async (req, res, next) => {
  const wave = await Wave.findOne({ _id: req.params.id, isPageText: { $ne: true } });
  if (!wave) return next(new ErrorResponse("Wave not found", 404));

  await wave.deleteOne();

  res.status(200).json({
    success: true,
    message: "Wave deleted successfully!",
  });
});

// GET SECTION TEXT (public)
export const getWaveSectionText = asyncHandler(async (req, res) => {
  let pageText = await Wave.findOne({ isPageText: true });

  if (!pageText) {
    // Create default page text if doesn't exist
    pageText = await Wave.create({
      isPageText: true,
      sectionTitle: "Waves",
      sectionSubtitle: "Explore the freshest waves and top audio experiences.",
      yourWavesTitle: "Your Waves",
    });
  }

  res.status(200).json({
    success: true,
    data: {
      sectionTitle: pageText.sectionTitle,
      sectionSubtitle: pageText.sectionSubtitle,
      yourWavesTitle: pageText.yourWavesTitle,
    },
  });
});

// UPDATE SECTION TEXT (admin)
export const updateWaveSectionText = asyncHandler(async (req, res, next) => {
  const { sectionTitle, sectionSubtitle, yourWavesTitle } = req.body;

  // Check if at least one field is provided
  if (!sectionTitle && !sectionSubtitle && !yourWavesTitle) {
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
  
  if (yourWavesTitle !== undefined) {
    updateData.yourWavesTitle = yourWavesTitle.trim();
  }

  // Find or create the page text document
  const pageText = await Wave.findOneAndUpdate(
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
      yourWavesTitle: pageText.yourWavesTitle,
    },
  });
});