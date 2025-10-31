import { validationResult } from "express-validator";
import News from "../models/model.news.js";
import { v2 as cloudinary } from "cloudinary";

// CREATE NEWS

export const createNews = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { title, description, location, credit } = req.body;




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
    console.error("Create news error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating news",
    });
  }
};

// GET ALL NEWS (optionally by location)

export const getNewsByLocation = async (req, res) => {
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
    console.error("Get news error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching news",
    });
  }
};

// GET SINGLE NEWS BY ID

export const getNews = async (req, res) => {
  try {
    const news = await News.findById(req.params.id).populate(
      "journalist",
      "fullName email"
    );

    if (!news) {
      return res.status(404).json({
        success: false,
        message: "News not found",
      });
    }

    res.status(200).json({
      success: true,
      data: { news },
    });
  } catch (error) {
    console.error("Get single news error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching news",
    });
  }
};

// GET MY NEWS (for logged-in journalist)

export const getMyNews = async (req, res) => {
  try {
    const news = await News.find({ journalist: req.user.id, isActive: true })
      .sort({ createdAt: -1 })
      .populate("journalist", "fullName email");

    res.status(200).json({
      success: true,
      data: { news },
    });
  } catch (error) {
    console.error("Get my news error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching journalist news",
    });
  }
};

// UPDATE NEWS

export const updateNews = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { title, description, location, credit } = req.body;

    let news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({
        success: false,
        message: "News not found",
      });
    }

    if (news.journalist.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this news",
      });
    }

    // If new photos are uploaded, upload to Cloudinary
    let updatedPhotos = news.photos;
    if (req.files?.length) {
      updatedPhotos = await Promise.all(
        req.files.map(async (file) => {
          const uploadRes = await cloudinary.uploader.upload(file.path, {
            folder: "gulf-music/news",
          });
          return {
            url: uploadRes.secure_url,
            filename: uploadRes.public_id,
          };
        })
      );
    }

    news = await News.findByIdAndUpdate(
      req.params.id,
      {
        title,
        description,
        location: location?.toLowerCase() || news.location,
        credit,
        photos: updatedPhotos,
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: " News updated successfully",
      data: { news },
    });
  } catch (error) {
    console.error("Update news error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating news",
    });
  }
};

// DELETE NEWS (Soft Delete + Cloudinary Cleanup)

export const deleteNews = async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({
        success: false,
        message: "News not found",
      });
    }

    if (news.journalist.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this news",
      });
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
      message: " News deleted successfully",
    });
  } catch (error) {
    console.error("Delete news error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting news",
    });
  }
};
