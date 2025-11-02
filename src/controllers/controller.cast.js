import { validationResult } from "express-validator";
import Cast from "../models/model.cast.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Get all casts (Public)
export const getAllCasts = async (req, res) => {
  try {
    const casts = await Cast.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: { casts },
    });
  } catch (error) {
    console.error("Get casts error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching casts",
    });
  }
};

// Create a new cast (Admin Only)
export const createCast = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ErrorResponse("Validation failed", 400));
  }

  const { title, thumbnail, youtubeUrl, description } = req.body;

  // Duplicate checks
  const existingTitle = await Cast.findOne({ title: new RegExp(`^${title}$`, "i") });
  const existingUrl = await Cast.findOne({ youtubeUrl });

  if (existingTitle && existingUrl) {
    return next(new ErrorResponse("Podcast with same title and link exists", 400));
  } else if (existingTitle) {
    return next(new ErrorResponse("Podcast title already exists", 400));
  } else if (existingUrl) {
    return next(new ErrorResponse("Podcast YouTube link already exists", 400));
  }

  const newCast = await Cast.create({ title, thumbnail, youtubeUrl, description });

  res.status(201).json({
    success: true,
    message: "Podcast added successfully!",
    data: { newCast },
  });
});

// Update cast (Admin Only)
export const updateCast = async (req, res) => {
  try {
    const updated = await Cast.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Podcast not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Podcast updated successfully!",
      data: { updated },
    });
  } catch (error) {
    console.error("Update cast error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating podcast",
    });
  }
};

// Delete cast (Admin Only)
export const deleteCast = async (req, res) => {
  try {
    const cast = await Cast.findById(req.params.id);
    if (!cast) {
      return res.status(404).json({
        success: false,
        message: "Podcast not found",
      });
    }

    await cast.deleteOne();
    res.status(200).json({
      success: true,
      message: "Podcast deleted successfully!",
    });
  } catch (error) {
    console.error("Delete cast error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting podcast",
    });
  }
};
