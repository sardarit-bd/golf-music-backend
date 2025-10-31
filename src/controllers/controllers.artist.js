import { validationResult } from "express-validator";
import Artist from "../models/model.artist.js";

export const createOrUpdateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { name, city, genre, biography } = req.body;

    let artist = await Artist.findOne({ user: req.user.id });

    // Update existing artist

    if (artist) {
      artist = await Artist.findByIdAndUpdate(
        artist._id,
        {
          name,
          city,
          genre,
          biography,
          photos: req.files?.photos
            ? req.files.photos.map((file) => ({
                url: file.path,
                filename: file.filename,
              }))
            : artist.photos,
          mp3File: req.files?.mp3File
            ? {
                url: req.files.mp3File[0].path,
                filename: req.files.mp3File[0].filename,
                originalName: req.files.mp3File[0].originalname,
              }
            : artist.mp3File,
        },
        { new: true, runValidators: true }
      );
    }

    // Create new artist
    else {
      artist = await Artist.create({
        user: req.user.id,
        name,
        city,
        genre,
        biography,
        photos: req.files?.photos
          ? req.files.photos.map((file) => ({
              url: file.path,
              filename: file.filename,
            }))
          : [],
        mp3File: req.files?.mp3File
          ? {
              url: req.files.mp3File[0].path,
              filename: req.files.mp3File[0].filename,
              originalName: req.files.mp3File[0].originalname,
            }
          : null,
      });
    }

    // Send success response
    res.status(200).json({
      success: true,
      message: "Artist profile saved successfully",
      data: { artist },
    });
  } catch (error) {
    console.error("Artist profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while saving artist profile",
    });
  }
};

export const getMyArtistProfile = async (req, res) => {
  try {
    const artist = await Artist.findOne({ user: req.user.id }).populate(
      "user",
      "username email"
    );
    if (!artist) {
      return res
        .status(404)
        .json({ success: false, message: "Artist profile not found" });
    }
    res.status(200).json({ success: true, data: { artist } });
  } catch (error) {
    console.error("Get my artist profile error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Server error while fetching artist profile",
      });
  }
};

// GET artists by genre

export const getArtistsByGenre = async (req, res) => {
  try {
    const { genre } = req.query;
    let query = { isActive: true };

    if (genre && genre !== "all") {
      query.genre = genre;
    }

    const artists = await Artist.find(query)
      .populate("user", "username email")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: { artists },
    });
  } catch (error) {
    console.error("Get artists error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching artists",
    });
  }
};

// GET single artist
export const getArtist = async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id).populate(
      "user",
      "username email"
    );

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist not found",
      });
    }

    res.status(200).json({
      success: true,
      data: { artist },
    });
  } catch (error) {
    console.error("Get artist error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching artist",
    });
  }
};

// UPDATE artist profile
export const updateArtistProfile = async (req, res) => {
  try {
    const { name, city, genre, biography } = req.body;

    const artist = await Artist.findOneAndUpdate(
      { user: req.user.id },
      {
        name,
        city,
        genre,
        biography,
        photos: req.files?.photos
          ? req.files.photos.map((file) => ({
              url: `/uploads/${file.filename}`,
              filename: file.filename,
            }))
          : undefined,
        mp3File: req.files?.mp3File
          ? {
              url: `/uploads/${req.files.mp3File[0].filename}`,
              filename: req.files.mp3File[0].filename,
              originalName: req.files.mp3File[0].originalname,
            }
          : undefined,
      },
      { new: true, runValidators: true }
    );

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist profile not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Artist profile updated successfully",
      data: { artist },
    });
  } catch (error) {
    console.error("Update artist error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating artist profile",
    });
  }
};

// DELETE artist profile
export const deleteArtistProfile = async (req, res) => {
  try {
    const artist = await Artist.findOne({ user: req.user.id });

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist profile not found",
      });
    }

    await artist.deleteOne();

    res.status(200).json({
      success: true,
      message: "Artist profile deleted successfully",
    });
  } catch (error) {
    console.error("Delete artist error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting artist profile",
    });
  }
};
