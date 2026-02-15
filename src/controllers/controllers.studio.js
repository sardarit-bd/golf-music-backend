import Studio from "../models/model.studio.js";
import User from "../models/model.user.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import { cloudinary, deleteFromCloudinary } from "../config/cloudinary.js";
import mongoose from "mongoose";

// ========================================================
// GET STUDIO PROFILE - FIXED (Photo URL validation)
// ========================================================
export const getStudioProfile = asyncHandler(async (req, res, next) => {
    const studio = await Studio.findOne({ user: req.user.id });

    if (!studio) {
        return next(new ErrorResponse("Studio profile not found", 404));
    }

    // 🔥 FIX: Ensure all photos have valid URLs
    if (studio.photos && studio.photos.length > 0) {
        studio.photos = studio.photos.map(photo => {
            // If photo is string (old format), convert to object
            if (typeof photo === 'string') {
                return {
                    url: photo,
                    publicId: extractPublicIdFromUrl(photo),
                    _id: new mongoose.Types.ObjectId()
                };
            }
            
            // If photo has publicId but no url, construct url
            if (photo.publicId && !photo.url) {
                photo.url = `https://res.cloudinary.com/${process.env.CLOUDINARY_NAME}/image/upload/${photo.publicId}`;
            }
            
            // Fix duplicate /upload/ issue
            if (photo.url?.includes('/upload//upload/')) {
                photo.url = photo.url.replace('/upload//upload/', '/upload/');
            }
            
            return photo;
        });
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

    if (req.user.userType !== "studio") {
        return next(new ErrorResponse("Only studio users can update studio profile", 403));
    }

    let studio = await Studio.findOne({ user: req.user.id });

    if (!studio) {
        return next(new ErrorResponse("Studio profile not found", 404));
    }

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
// UPDATE SERVICES
// ========================================================
export const updateServices = asyncHandler(async (req, res, next) => {
    const { services } = req.body;

    if (!Array.isArray(services)) {
        return next(new ErrorResponse("Services must be an array", 400));
    }

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
// UPLOAD PHOTOS - 🔥 COMPLETELY FIXED VERSION
// ========================================================
export const uploadPhotos = asyncHandler(async (req, res, next) => {
    const studio = await Studio.findOne({ user: req.user.id });

    if (!studio) {
        return next(new ErrorResponse("Studio profile not found", 404));
    }

    const files = req.files;

    if (!files || files.length === 0) {
        return next(new ErrorResponse("No photos uploaded", 400));
    }

    if (studio.photos.length >= 5) {
        return next(new ErrorResponse("Maximum 5 photos allowed", 400));
    }

    if (studio.photos.length + files.length > 5) {
        return next(
            new ErrorResponse(
                `Can only upload ${5 - studio.photos.length} more photos`,
                400
            )
        );
    }

    // 🔥 FIX: Process each file and ensure proper URL
    const uploadedPhotos = [];

    for (const file of files) {
        // Get the correct URL from Cloudinary
        let fileUrl = file.path || file.secure_url;
        
        // Clean the URL
        if (fileUrl) {
            // Ensure HTTPS
            if (fileUrl.startsWith('http://')) {
                fileUrl = fileUrl.replace('http://', 'https://');
            }
            
            // Fix duplicate /upload/
            if (fileUrl.includes('/upload//upload/')) {
                fileUrl = fileUrl.replace('/upload//upload/', '/upload/');
            }
        }

        const photoData = {
            url: fileUrl,
            publicId: file.filename || file.public_id,
            _id: new mongoose.Types.ObjectId()
        };

        uploadedPhotos.push(photoData);
        studio.photos.push(photoData);
    }

    await studio.save();

    // 🔥 Return the updated photos array
    res.status(200).json({
        success: true,
        message: `${files.length} photo(s) uploaded successfully`,
        data: {
            photos: studio.photos,
            count: studio.photos.length
        },
    });
});

// ========================================================
// UPLOAD AUDIO FILE - 🔥 FIXED VERSION
// ========================================================
export const uploadAudioFile = asyncHandler(async (req, res, next) => {
    const studio = await Studio.findOne({ user: req.user.id });

    if (!studio) {
        return next(new ErrorResponse("Studio profile not found", 404));
    }

    if (!req.file) {
        return next(new ErrorResponse("No audio file uploaded", 400));
    }

    // Delete old audio file if exists
    if (studio.audioFile && studio.audioFile.publicId) {
        try {
            await deleteFromCloudinary(studio.audioFile.publicId, 'video');
        } catch (error) {
            console.error("Error deleting old audio file:", error);
        }
    }

    // 🔥 FIX: Get correct URL
    let audioUrl = req.file.path || req.file.secure_url;
    
    // Clean URL
    if (audioUrl) {
        if (audioUrl.startsWith('http://')) {
            audioUrl = audioUrl.replace('http://', 'https://');
        }
    }

    studio.audioFile = {
        url: audioUrl,
        publicId: req.file.filename || req.file.public_id,
    };

    await studio.save();

    res.status(200).json({
        success: true,
        message: "Audio file uploaded successfully",
        data: studio.audioFile,
    });
});

// ========================================================
// DELETE PHOTO - 🔥 FIXED VERSION
// ========================================================
export const deletePhoto = asyncHandler(async (req, res, next) => {
    const { photoId } = req.params;

    const studio = await Studio.findOne({ user: req.user.id });

    if (!studio) {
        return next(new ErrorResponse("Studio profile not found", 404));
    }

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
            await deleteFromCloudinary(photo.publicId, 'image');
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
        data: {
            photos: studio.photos,
            count: studio.photos.length
        }
    });
});

// ========================================================
// DELETE AUDIO FILE - 🔥 FIXED VERSION
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
            await deleteFromCloudinary(studio.audioFile.publicId, 'video');
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
// GET STUDIOS BY LOCATION
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
// PUBLIC: GET SINGLE STUDIO
// ========================================================
export const getStudioPublic = asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    const studio = await Studio.findById(id)
        .populate("user", "username email userType")
        .select("name state city biography services photos audioFile isVerified isFeatured isActive");

    if (!studio) {
        return next(new ErrorResponse("Studio not found", 404));
    }

    if (!studio.isActive) {
        return next(new ErrorResponse("Studio is not active", 404));
    }

    res.status(200).json({
        success: true,
        data: {
            studio: studio,
            user: studio.user
        },
    });
});

// ========================================================
// ADMIN: GET ALL STUDIOS
// ========================================================
export const getAllStudios = asyncHandler(async (req, res, next) => {
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
// ADMIN: GET STUDIO BY ID
// ========================================================
export const getStudioById = asyncHandler(async (req, res, next) => {
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
// ADMIN: UPDATE STUDIO STATUS
// ========================================================
export const updateStudioStatus = asyncHandler(async (req, res, next) => {
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
                await deleteFromCloudinary(photo.publicId, 'image');
            } catch (error) {
                console.error("Error deleting photo:", error);
            }
        }
    }

    // Delete audio file from Cloudinary
    if (studio.audioFile && studio.audioFile.publicId) {
        try {
            await deleteFromCloudinary(studio.audioFile.publicId, 'video');
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

// ========================================================
// HELPER: Extract Public ID from URL
// ========================================================
const extractPublicIdFromUrl = (url) => {
    if (!url) return null;
    try {
        const matches = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
        return matches ? matches[1] : null;
    } catch {
        return null;
    }
};