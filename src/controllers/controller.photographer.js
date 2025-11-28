import mongoose from "mongoose";
import Photographer from "../models/model.photographer.js";
// import Photographer from "../models/model.photographer.js";
// import User from "../models/model.user.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
// import { asyncHandler } from "../utils/asyncHandler.js";
// import { ErrorResponse } from "../middleware/errorHandler.js";

/* ========================================================
   GET PHOTOGRAPHER PROFILE
======================================================== */
export const getPhotographerProfile = asyncHandler(async (req, res, next) => {
  const photographer = await Photographer.findOne({ user: req.user.id })
    .populate("user", "username email userType isVerified");

  if (!photographer) {
    return next(new ErrorResponse("Photographer profile not found", 404));
  }

  res.status(200).json({
    success: true,
    message: "Photographer profile fetched successfully",
    data: {
      photographer: {
        id: photographer._id,
        user: photographer.user,
        name: photographer.name,
        city: photographer.city,
        biography: photographer.biography,
        services: photographer.services,
        photos: photographer.photos,
        videos: photographer.videos,
        isActive: photographer.isActive,
        isVerified: photographer.isVerified,
        createdAt: photographer.createdAt,
        updatedAt: photographer.updatedAt,
      },
    },
  });
});

/* ========================================================
   UPDATE PHOTOGRAPHER PROFILE
======================================================== */
export const updatePhotographerProfile = asyncHandler(async (req, res, next) => {
  const { name, city, biography } = req.body;

  let photographer = await Photographer.findOne({ user: req.user.id });

  if (!photographer) {
    return next(new ErrorResponse("Photographer profile not found", 404));
  }

  // Update fields
  if (name) photographer.name = name;
  if (city) photographer.city = city.toLowerCase();
  if (biography !== undefined) photographer.biography = biography;

  await photographer.save();

  // Populate user data for response
  photographer = await Photographer.findOne({ user: req.user.id })
    .populate("user", "username email userType isVerified");

  res.status(200).json({
    success: true,
    message: "Photographer profile updated successfully",
    data: {
      photographer: {
        id: photographer._id,
        user: photographer.user,
        name: photographer.name,
        city: photographer.city,
        biography: photographer.biography,
        services: photographer.services,
        photos: photographer.photos,
        videos: photographer.videos,
        isActive: photographer.isActive,
        isVerified: photographer.isVerified,
        createdAt: photographer.createdAt,
        updatedAt: photographer.updatedAt,
      },
    },
  });
});

/* ========================================================
   ADD SERVICE
======================================================== */
export const addService = asyncHandler(async (req, res, next) => {
  const { service, price } = req.body;

  if (!service || !price) {
    return next(new ErrorResponse("Service and price are required", 400));
  }

  const photographer = await Photographer.findOne({ user: req.user.id });

  if (!photographer) {
    return next(new ErrorResponse("Photographer profile not found", 404));
  }

  // Check if service already exists (case insensitive)
  const serviceExists = photographer.services.some(
    (s) => s.service.toLowerCase() === service.toLowerCase()
  );

  if (serviceExists) {
    return next(new ErrorResponse("Service already exists", 400));
  }

  // Add new service
  photographer.services.push({ service, price });
  await photographer.save();

  res.status(201).json({
    success: true,
    message: "Service added successfully",
    data: {
      services: photographer.services,
    },
  });
});

/* ========================================================
   UPDATE SERVICE
======================================================== */
export const updateService = asyncHandler(async (req, res, next) => {
  const { serviceId } = req.params;
  const { service, price } = req.body;

  if (!service && !price) {
    return next(new ErrorResponse("At least one field (service or price) is required to update", 400));
  }

  const photographer = await Photographer.findOne({ user: req.user.id });

  if (!photographer) {
    return next(new ErrorResponse("Photographer profile not found", 404));
  }

  // Find the service
  const serviceToUpdate = photographer.services.id(serviceId);
  if (!serviceToUpdate) {
    return next(new ErrorResponse("Service not found", 404));
  }

  // Update service fields
  if (service) serviceToUpdate.service = service;
  if (price) serviceToUpdate.price = price;

  await photographer.save();

  res.status(200).json({
    success: true,
    message: "Service updated successfully",
    data: {
      services: photographer.services,
    },
  });
});

/* ========================================================
   DELETE SERVICE
======================================================== */
export const deleteService = asyncHandler(async (req, res, next) => {
  const { serviceId } = req.params;

  const photographer = await Photographer.findOne({ user: req.user.id });

  if (!photographer) {
    return next(new ErrorResponse("Photographer profile not found", 404));
  }

  // Find and remove the service
  const serviceToDelete = photographer.services.id(serviceId);
  if (!serviceToDelete) {
    return next(new ErrorResponse("Service not found", 404));
  }

  photographer.services.pull(serviceId);
  await photographer.save();

  res.status(200).json({
    success: true,
    message: "Service deleted successfully",
    data: {
      services: photographer.services,
    },
  });
});

/* ========================================================
   ADD PHOTO
======================================================== */
export const addPhoto = asyncHandler(async (req, res, next) => {
  const { url, caption } = req.body;

  if (!url) {
    return next(new ErrorResponse("Photo URL is required", 400));
  }

  const photographer = await Photographer.findOne({ user: req.user.id });

  if (!photographer) {
    return next(new ErrorResponse("Photographer profile not found", 404));
  }

  photographer.photos.push({ url, caption: caption || "" });
  await photographer.save();

  res.status(201).json({
    success: true,
    message: "Photo added successfully",
    data: {
      photos: photographer.photos,
    },
  });
});

/* ========================================================
   DELETE PHOTO
======================================================== */
export const deletePhoto = asyncHandler(async (req, res, next) => {
  const { photoId } = req.params;

  const photographer = await Photographer.findOne({ user: req.user.id });

  if (!photographer) {
    return next(new ErrorResponse("Photographer profile not found", 404));
  }

  const photoToDelete = photographer.photos.id(photoId);
  if (!photoToDelete) {
    return next(new ErrorResponse("Photo not found", 404));
  }

  photographer.photos.pull(photoId);
  await photographer.save();

  res.status(200).json({
    success: true,
    message: "Photo deleted successfully",
    data: {
      photos: photographer.photos,
    },
  });
});

/* ========================================================
   ADD VIDEO
======================================================== */
export const addVideo = asyncHandler(async (req, res, next) => {
  const { url, title } = req.body;

  if (!url) {
    return next(new ErrorResponse("Video URL is required", 400));
  }

  const photographer = await Photographer.findOne({ user: req.user.id });

  if (!photographer) {
    return next(new ErrorResponse("Photographer profile not found", 404));
  }

  photographer.videos.push({ url, title: title || "" });
  await photographer.save();

  res.status(201).json({
    success: true,
    message: "Video added successfully",
    data: {
      videos: photographer.videos,
    },
  });
});

/* ========================================================
   DELETE VIDEO
======================================================== */
export const deleteVideo = asyncHandler(async (req, res, next) => {
  const { videoId } = req.params;

  const photographer = await Photographer.findOne({ user: req.user.id });

  if (!photographer) {
    return next(new ErrorResponse("Photographer profile not found", 404));
  }

  const videoToDelete = photographer.videos.id(videoId);
  if (!videoToDelete) {
    return next(new ErrorResponse("Video not found", 404));
  }

  photographer.videos.pull(videoId);
  await photographer.save();

  res.status(200).json({
    success: true,
    message: "Video deleted successfully",
    data: {
      videos: photographer.videos,
    },
  });
});

/* ========================================================
   GET ALL PHOTOGRAPHERS (PUBLIC)
======================================================== */
export const getAllPhotographers = asyncHandler(async (req, res, next) => {
  const { city, page = 1, limit = 10 } = req.query;

  let query = { isActive: true, isVerified: true };
  
  if (city) {
    query.city = city.toLowerCase();
  }

  const photographers = await Photographer.find(query)
    .populate("user", "username email")
    .select("-__v")
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const total = await Photographer.countDocuments(query);

  res.status(200).json({
    success: true,
    message: "Photographers fetched successfully",
    data: {
      photographers,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    },
  });
});

/* ========================================================
   GET PHOTOGRAPHER BY ID (PUBLIC)
======================================================== */
export const getPhotographerById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const photographer = await Photographer.findById(id)
    .populate("user", "username email")
    .select("-__v");

  if (!photographer) {
    return next(new ErrorResponse("Photographer not found", 404));
  }

  if (!photographer.isActive || !photographer.isVerified) {
    return next(new ErrorResponse("Photographer profile is not available", 404));
  }

  res.status(200).json({
    success: true,
    message: "Photographer profile fetched successfully",
    data: {
      photographer,
    },
  });
});