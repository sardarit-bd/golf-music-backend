import { validationResult } from "express-validator";
import Artist from "../models/model.artist.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/* =====================================================
   CREATE or UPDATE Artist Profile
===================================================== */
export const createOrUpdateProfile = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Make errors clean & readable
    const formatted = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));
    return next(new ErrorResponse("Validation failed", 400, { details: formatted }));
  }

  // Normalize genre (lowercase)
  const { name, city, genre, biography } = req.body;
  const normalizedGenre = genre?.toLowerCase();

  let artist = await Artist.findOne({ user: req.user.id });

  const artistData = {
    name,
    city,
    genre: normalizedGenre,
    biography,
    photos: req.files?.photos
      ? req.files.photos.map((file) => ({
          url: file.path,
          filename: file.filename,
        }))
      : artist?.photos || [],
    mp3File: req.files?.mp3File
      ? {
          url: req.files.mp3File[0].path,
          filename: req.files.mp3File[0].filename,
          originalName: req.files.mp3File[0].originalname,
        }
      : artist?.mp3File || null,
  };

  artist = artist
    ? await Artist.findByIdAndUpdate(artist._id, artistData, {
        new: true,
        runValidators: true,
      })
    : await Artist.create({ user: req.user.id, ...artistData });

  res.status(200).json({
    success: true,
    message: "Artist profile saved successfully",
    data: { artist },
  });
});

/* =====================================================
   GET My Artist Profile
===================================================== */
export const getMyArtistProfile = asyncHandler(async (req, res, next) => {
  const artist = await Artist.findOne({ user: req.user.id }).populate(
    "user",
    "username email"
  );

  if (!artist) {
    return next(new ErrorResponse("Artist profile not found", 404));
  }

  res.status(200).json({ success: true, data: { artist } });
});

/* =====================================================
   GET Artists by Genre
===================================================== */
export const getArtistsByGenre = asyncHandler(async (req, res, next) => {
  const { genre } = req.query;
  let query = { isActive: true };

  if (genre && genre !== "all") {
    query.genre = genre.toLowerCase();
  }

  const artists = await Artist.find(query)
    .populate("user", "username email")
    .sort({ name: 1 });

  res.status(200).json({
    success: true,
    data: { artists },
  });
});

/* =====================================================
   GET Single Artist by ID
===================================================== */
export const getArtist = asyncHandler(async (req, res, next) => {
  const artist = await Artist.findById(req.params.id).populate(
    "user",
    "username email"
  );

  if (!artist) {
    return next(new ErrorResponse("Artist not found", 404));
  }

  res.status(200).json({
    success: true,
    data: { artist },
  });
});

/* =====================================================
   UPDATE Artist Profile
===================================================== */
export const updateArtistProfile = asyncHandler(async (req, res, next) => {
  const { name, city, genre, biography } = req.body;
  const normalizedGenre = genre?.toLowerCase();

  const updateData = {
    name,
    city,
    genre: normalizedGenre,
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
  };

  const artist = await Artist.findOneAndUpdate(
    { user: req.user.id },
    updateData,
    { new: true, runValidators: true }
  );

  if (!artist) {
    return next(new ErrorResponse("Artist profile not found", 404));
  }

  res.status(200).json({
    success: true,
    message: "Artist profile updated successfully",
    data: { artist },
  });
});

/* =====================================================
   DELETE Artist Profile
===================================================== */
export const deleteArtistProfile = asyncHandler(async (req, res, next) => {
  const artist = await Artist.findOne({ user: req.user.id });

  if (!artist) {
    return next(new ErrorResponse("Artist profile not found", 404));
  }

  await artist.deleteOne();

  res.status(200).json({
    success: true,
    message: "Artist profile deleted successfully",
  });
});


 //  UPDATE Artist by Admin

export const updateArtistByAdmin = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { name, city, genre, biography, website, phone, isActive } = req.body;
  
  const normalizedGenre = genre?.toLowerCase();

  const updateData = {
    ...(name && { name }),
    ...(city && { city }),
    ...(genre && { genre: normalizedGenre }),
    ...(biography && { biography }),
    ...(website && { website }),
    ...(phone && { phone }),
    ...(isActive !== undefined && { isActive }),
    updatedAt: Date.now()
  };

  const artist = await Artist.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  ).populate("user", "username email");

  if (!artist) {
    return next(new ErrorResponse("Artist not found", 404));
  }

  res.status(200).json({
    success: true,
    message: "Artist profile updated successfully",
    data: { artist },
  });
});


//  DELETE Artist by Admin

export const deleteArtistByAdmin = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const artist = await Artist.findById(id);

  if (!artist) {
    return next(new ErrorResponse("Artist not found", 404));
  }

  await artist.deleteOne();

  res.status(200).json({
    success: true,
    message: "Artist profile deleted successfully",
  });
});