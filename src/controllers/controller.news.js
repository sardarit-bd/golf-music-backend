import { validationResult } from "express-validator";
import News from "../models/model.news.js";
import { v2 as cloudinary } from "cloudinary";
import { ErrorResponse } from "../middleware/errorHandler.js";


  //  CREATE NEWS

export const createNews = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(
        new ErrorResponse("Validation failed", 400, { details: errors.array() })
      );
    }

    const { title, description, location, credit } = req.body;

    // Upload images to Cloudinary (if any)
    const uploadedPhotos = req.files?.length
      ? await Promise.all(
          req.files.map(async (file) => {
            const uploadRes = await cloudinary.uploader.upload(file.path, {
              folder: "gulf-music/news",
            });
            return {
              url: uploadRes.secure_url,
              filename: uploadRes.public_id,
            };
          })
        )
      : [];

    const news = await News.create({
      title,
      description,
      location: location?.toLowerCase(),
      credit,
      photos: uploadedPhotos,
      journalist: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: "News created successfully",
      data: { news },
    });
  } catch (error) {
    next(error);
  }
};


//  UPDATE NEWS (FIXED)
export const updateNews = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(
        new ErrorResponse("Validation failed", 400, { details: errors.array() })
      );
    }

    const { title, description, location, credit } = req.body;

    let news = await News.findById(req.params.id);
    if (!news) return next(new ErrorResponse("News not found", 404));

    // Authorization check
    if (news.journalist.toString() !== req.user.id) {
      return next(new ErrorResponse("Not authorized to update this news", 403));
    }

    // Upload new photos (if provided)
    const oldPhotos = news.photos || [];
    const newPhotos = req.files?.length
      ? await Promise.all(
          req.files.map(async (file) => {
            const uploadRes = await cloudinary.uploader.upload(file.path, {
              folder: "gulf-music/news",
            });
            return {
              url: uploadRes.secure_url,
              filename: uploadRes.public_id,
            };
          })
        )
      : [];

    // Merge photos, max 5
    const mergedPhotos = [...oldPhotos, ...newPhotos].slice(0, 5);

    // Dynamically build update object
    const updateData = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (location !== undefined) updateData.location = location.toLowerCase();
    if (credit !== undefined) updateData.credit = credit;
    if (req.files?.length) updateData.photos = mergedPhotos;

    // Update record
    news = await News.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: "News updated successfully",
      data: { news },
    });
  } catch (error) {
    next(error);
  }
};

  //  GET ALL NEWS (optionally by location)

export const getNewsByLocation = async (req, res, next) => {
  try {
    const { location } = req.query;
    const query = { isActive: true };

    if (location && location !== "all") {
      query.location = location.toLowerCase();
    }

    const news = await News.find(query)
      .populate("journalist", "fullName email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: { news },
    });
  } catch (error) {
    next(error);
  }
};


  //  GET SINGLE NEWS BY ID

export const getNews = async (req, res, next) => {
  try {
    const news = await News.findById(req.params.id)
  .populate("journalist", "username email profilePhoto bio");
    if (!news) {
      return next(new ErrorResponse("News not found", 404));
    }

    res.status(200).json({
      success: true,
      data: { news },
    });
  } catch (error) {
    next(error);
  }
};


  //  GET MY NEWS (for logged-in journalist)

export const getMyNews = async (req, res, next) => {
  try {
    const news = await News.find({ journalist: req.user.id, isActive: true })
      .sort({ createdAt: -1 })
      .populate("journalist", "fullName email");

    res.status(200).json({
      success: true,
      data: { news },
    });
  } catch (error) {
    next(error);
  }
};





  //  DELETE NEWS (Soft Delete + Cloudinary Cleanup)

export const deleteNews = async (req, res, next) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return next(new ErrorResponse("News not found", 404));
    }

    if (news.journalist.toString() !== req.user.id) {
      return next(new ErrorResponse("Not authorized to delete this news", 403));
    }

    // Delete photos from Cloudinary
    if (news.photos?.length) {
      for (const photo of news.photos) {
        try {
          await cloudinary.uploader.destroy(photo.filename);
        } catch (err) {
          console.warn(`Failed to delete image: ${photo.filename}`);
        }
      }
    }

    await News.findByIdAndUpdate(req.params.id, { isActive: false });

    res.status(200).json({
      success: true,
      message: "News deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
