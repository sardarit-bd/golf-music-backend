import Studio from "../models/model.studio.js";
import User from "../models/model.user.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import { cloudinary } from "../config/cloudinary.js";

// ========================================================
// GET STUDIO PROFILE
// ========================================================
export const getStudioProfile = asyncHandler(async (req, res, next) => {
    const studio = await Studio.findOne({ user: req.user.id });

    if (!studio) {
        return next(new ErrorResponse("Studio profile not found", 404));
    }

    res.status(200).json({
        success: true,
        data: studio,
    });
});

// ========================================================
// UPDATE STUDIO PROFILE
// ========================================================
export const updateStudioProfile = asyncHandler(async (req, res, next) => {
    const { name, city, state, biography } = req.body;

    // Check if user is a studio
    if (req.user.userType !== "studio") {
        return next(new ErrorResponse("Only studio users can update studio profile", 403));
    }

    let studio = await Studio.findOne({ user: req.user.id });

    if (!studio) {
        return next(new ErrorResponse("Studio profile not found", 404));
    }

    // Update basic info
    if (name) studio.name = name;
    if (city) studio.city = city.toLowerCase();
    if (state) {
        const validStates = ["Louisiana", "Mississippi", "Alabama", "Florida"];
        if (!validStates.includes(state)) {
            return next(new ErrorResponse(`Invalid state. Must be one of: ${validStates.join(", ")}`, 400));
        }
        studio.state = state;
    }
    if (biography !== undefined) studio.biography = biography;

    await studio.save();

    res.status(200).json({
        success: true,
        message: "Studio profile updated successfully",
        data: studio,
    });
});

// ========================================================
// ADD/MODIFY SERVICES
// ========================================================
export const updateServices = asyncHandler(async (req, res, next) => {
    const { services } = req.body;

    if (!Array.isArray(services)) {
        return next(new ErrorResponse("Services must be an array", 400));
    }

    // Validate each service
    for (const service of services) {
        if (!service.service || !service.price) {
            return next(new ErrorResponse("Each service must have 'service' and 'price' fields", 400));
        }
    }

    const studio = await Studio.findOne({ user: req.user.id });

    if (!studio) {
        return next(new ErrorResponse("Studio profile not found", 404));
    }

    studio.services = services;
    await studio.save();

    res.status(200).json({
        success: true,
        message: "Services updated successfully",
        data: studio.services,
    });
});

// ========================================================
// UPLOAD PHOTOS (Up to 5) - Direct Cloudinary Upload
// ========================================================
export const uploadPhotos = asyncHandler(async (req, res, next) => {
    const studio = await Studio.findOne({ user: req.user.id });

    if (!studio) {
        return next(new ErrorResponse("Studio profile not found", 404));
    }

    // Check if already has 5 photos
    if (studio.photos.length >= 5) {
        return next(new ErrorResponse("Maximum 5 photos allowed", 400));
    }

    if (!req.files || req.files.length === 0) {
        return next(new ErrorResponse("No photos uploaded", 400));
    }

    // Check total photos won't exceed 5
    if (studio.photos.length + req.files.length > 5) {
        return next(new ErrorResponse(`Can only upload ${5 - studio.photos.length} more photos`, 400));
    }

    for (const file of req.files) {
        studio.photos.push({
            url: file.path,
            publicId: file.filename,
        });
    }

    await studio.save();

    res.status(200).json({
        success: true,
        message: "Photos uploaded successfully",
        data: studio.photos,
    });
});

// ========================================================
// UPLOAD AUDIO FILE (1 file only) - Direct Cloudinary Upload
// ========================================================
export const uploadAudioFile = asyncHandler(async (req, res, next) => {
    const studio = await Studio.findOne({ user: req.user.id });

    if (!studio) {
        return next(new ErrorResponse("Studio profile not found", 404));
    }

    if (!req.file) {
        return next(new ErrorResponse("No audio file uploaded", 400));
    }

    if (studio.audioFile && studio.audioFile.publicId) {
        try {
            await cloudinary.uploader.destroy(studio.audioFile.publicId, {
                resource_type: 'video'
            });
        } catch (error) {
            console.error("Error deleting old audio file:", error);
        }
    }

    studio.audioFile = {
        url: req.file.path,
        publicId: req.file.filename,
    };

    await studio.save();

    res.status(200).json({
        success: true,
        message: "Audio file uploaded successfully",
        data: studio.audioFile,
    });
});

// ========================================================
// DELETE PHOTO
// ========================================================
export const deletePhoto = asyncHandler(async (req, res, next) => {
    const { photoId } = req.params;

    const studio = await Studio.findOne({ user: req.user.id });

    if (!studio) {
        return next(new ErrorResponse("Studio profile not found", 404));
    }

    // Find photo by _id (Mongoose ObjectId)
    const photoIndex = studio.photos.findIndex(
        photo => photo._id.toString() === photoId
    );

    if (photoIndex === -1) {
        return next(new ErrorResponse("Photo not found", 404));
    }

    const photo = studio.photos[photoIndex];

    // Delete from Cloudinary
    if (photo.publicId) {
        try {
            await cloudinary.uploader.destroy(photo.publicId);
        } catch (error) {
            console.error("Error deleting photo from Cloudinary:", error);
        }
    }

    // Remove from array
    studio.photos.splice(photoIndex, 1);
    await studio.save();

    res.status(200).json({
        success: true,
        message: "Photo deleted successfully",
    });
});


// ========================================================
// DELETE AUDIO FILE
// ========================================================
export const deleteAudioFile = asyncHandler(async (req, res, next) => {
    const studio = await Studio.findOne({ user: req.user.id });

    if (!studio) {
        return next(new ErrorResponse("Studio profile not found", 404));
    }

    if (!studio.audioFile) {
        return next(new ErrorResponse("No audio file found", 404));
    }

    // Delete from Cloudinary
    if (studio.audioFile.publicId) {
        try {
            await cloudinary.uploader.destroy(studio.audioFile.publicId, {
                resource_type: 'video'
            });
        } catch (error) {
            console.error("Error deleting audio from Cloudinary:", error);
        }
    }

    studio.audioFile = null;
    await studio.save();

    res.status(200).json({
        success: true,
        message: "Audio file deleted successfully",
    });
});

// ========================================================
// GET ALL STUDIOS BY LOCATION (For homepage filtering)
// ========================================================
export const getStudiosByLocation = asyncHandler(async (req, res, next) => {
    const { state, city } = req.query;

    const query = { isActive: true };

    if (state) {
        const validStates = ["Louisiana", "Mississippi", "Alabama", "Florida"];
        if (!validStates.includes(state)) {
            return next(new ErrorResponse(`Invalid state. Must be one of: ${validStates.join(", ")}`, 400));
        }
        query.state = state;
    }

    if (city) query.city = city.toLowerCase();

    const studios = await Studio.find(query)
        .populate("user", "username email userType")
        .select("name state city biography services photos audioFile isVerified isFeatured")
        .sort({ isFeatured: -1, createdAt: -1 });

    res.status(200).json({
        success: true,
        count: studios.length,
        data: studios,
    });
});

// ========================================================
// ADMIN: GET ALL STUDIOS (For admin dashboard)
// ========================================================
export const getAllStudios = asyncHandler(async (req, res, next) => {
    // Check if user is admin
    if (req.user.userType !== "admin") {
        return next(new ErrorResponse("Only admin can access all studios", 403));
    }

    const { page = 1, limit = 20, state, status } = req.query;
    const skip = (page - 1) * limit;

    const query = {};

    if (state) {
        const validStates = ["Louisiana", "Mississippi", "Alabama", "Florida"];
        if (!validStates.includes(state)) {
            return next(new ErrorResponse(`Invalid state. Must be one of: ${validStates.join(", ")}`, 400));
        }
        query.state = state;
    }

    if (status === 'active') query.isActive = true;
    if (status === 'inactive') query.isActive = false;
    if (status === 'verified') query.isVerified = true;
    if (status === 'unverified') query.isVerified = false;

    const studios = await Studio.find(query)
        .populate("user", "username email userType createdAt")
        .select("name state city biography services photos audioFile isActive isVerified isFeatured createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Studio.countDocuments(query);

    res.status(200).json({
        success: true,
        count: studios.length,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        data: studios,
    });
});

// ========================================================
// ADMIN: GET SINGLE STUDIO BY ID
// ========================================================
export const getStudioById = asyncHandler(async (req, res, next) => {
    // Check if user is admin
    if (req.user.userType !== "admin") {
        return next(new ErrorResponse("Only admin can access studio by ID", 403));
    }

    const { id } = req.params;

    const studio = await Studio.findById(id)
        .populate("user", "username email userType createdAt");

    if (!studio) {
        return next(new ErrorResponse("Studio not found", 404));
    }

    res.status(200).json({
        success: true,
        data: studio,
    });
});

// ========================================================
// ADMIN: UPDATE STUDIO STATUS (Active/Inactive)
// ========================================================
export const updateStudioStatus = asyncHandler(async (req, res, next) => {
    // Check if user is admin
    if (req.user.userType !== "admin") {
        return next(new ErrorResponse("Only admin can update studio status", 403));
    }

    const { id } = req.params;
    const { isActive, isVerified, isFeatured } = req.body;

    const studio = await Studio.findById(id);

    if (!studio) {
        return next(new ErrorResponse("Studio not found", 404));
    }

    if (isActive !== undefined) studio.isActive = isActive;
    if (isVerified !== undefined) studio.isVerified = isVerified;
    if (isFeatured !== undefined) studio.isFeatured = isFeatured;

    await studio.save();

    res.status(200).json({
        success: true,
        message: "Studio status updated successfully",
        data: studio,
    });
});

// ========================================================
// ADMIN: DELETE STUDIO
// ========================================================
export const deleteStudio = asyncHandler(async (req, res, next) => {
    // Check if user is admin
    if (req.user.userType !== "admin") {
        return next(new ErrorResponse("Only admin can delete studio", 403));
    }

    const { id } = req.params;

    const studio = await Studio.findById(id);

    if (!studio) {
        return next(new ErrorResponse("Studio not found", 404));
    }

    // Delete photos from Cloudinary
    for (const photo of studio.photos) {
        if (photo.publicId) {
            try {
                await cloudinary.uploader.destroy(photo.publicId);
            } catch (error) {
                console.error("Error deleting photo:", error);
            }
        }
    }

    // Delete audio file from Cloudinary
    if (studio.audioFile && studio.audioFile.publicId) {
        try {
            await cloudinary.uploader.destroy(studio.audioFile.publicId, {
                resource_type: 'video'
            });
        } catch (error) {
            console.error("Error deleting audio:", error);
        }
    }

    // Delete user account
    await User.findByIdAndDelete(studio.user);

    // Delete studio
    await Studio.findByIdAndDelete(id);

    res.status(200).json({
        success: true,
        message: "Studio deleted successfully",
    });
});