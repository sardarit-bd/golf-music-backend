import { validationResult } from "express-validator";
import Artist from "../models/model.artist.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { SUBSCRIPTION_RULES } from "../config/subscriptionRules.js";
import User from "../models/model.user.js";
import { cloudinary } from "../config/cloudinary.js";


//  CREATE or UPDATE Artist Profile

export const createOrUpdateProfile = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));
    return next(
      new ErrorResponse("Validation failed", 400, { details: formatted })
    );
  }

  const user = req.user;
  const rules =
    SUBSCRIPTION_RULES.artist[user.subscriptionPlan] ||
    SUBSCRIPTION_RULES.artist.free;

  const { name, city, genre, biography } = req.body;
  const normalizedGenre = genre?.toLowerCase();

  let artist = await Artist.findOne({ user: user.id });

  let removedPhotos = [];
  let removedAudios = [];

  if (req.body.removedPhotos) {
    removedPhotos = Array.isArray(req.body.removedPhotos)
      ? req.body.removedPhotos
      : [req.body.removedPhotos];
  }

  if (req.body.removedAudios) {
    removedAudios = Array.isArray(req.body.removedAudios)
      ? req.body.removedAudios
      : [req.body.removedAudios];
  }

  // DELETE FROM CLOUDINARY (Correct public_id)
  for (const filename of removedPhotos) {
    try {
      // remove file extension
      const publicId = filename.replace(/\.[^/.]+$/, "");
      await cloudinary.uploader.destroy(publicId);
      console.log("Deleted Photo:", publicId);
    } catch (err) {
      console.log("Failed to delete photo:", filename, err);
    }
  }

  for (const filename of removedAudios) {
    try {
      // remove file extension
      const publicId = filename.replace(/\.[^/.]+$/, "");
      await cloudinary.uploader.destroy(publicId);
      console.log("Deleted Audio:", publicId);
    } catch (err) {
      console.log("Failed to delete audio:", filename, err);
    }
  }


  // FILTER EXISTING FILES TO REMOVE DELETED ONES
  const oldPhotos = artist?.photos?.filter(
    (p) => !removedPhotos.includes(p.filename)
  ) || [];

  const oldAudios = artist?.mp3Files?.filter(
    (a) => !removedAudios.includes(a.filename)
  ) || [];

  let newPhotos = [];
  let newAudios = [];

  if (req.files?.photos?.length) {
    if (rules.photos === 0) {
      return next(
        new ErrorResponse(
          "Free plan users cannot upload artist photos. Upgrade to Pro.",
          403
        )
      );
    }

    newPhotos = req.files.photos.map((file) => ({
      url: file.path,
      filename: file.filename,
    }));
  }

  if (req.files?.mp3Files?.length) {
    if (rules.mp3 === 0) {
      return next(
        new ErrorResponse(
          "Free plan users cannot upload audio files. Upgrade to Pro.",
          403
        )
      );
    }

    newAudios = req.files.mp3Files.map((file) => ({
      url: file.path,
      filename: file.filename,
      originalName: file.originalname,
    }));
  }

  const mergedPhotos =
    rules.photos > 0
      ? [...oldPhotos, ...newPhotos].slice(0, rules.photos)
      : oldPhotos;

  const mergedAudios =
    rules.mp3 > 0
      ? [...oldAudios, ...newAudios].slice(0, rules.mp3)
      : oldAudios;

  // Biography restriction
  const finalBiography =
    rules.biography ? biography : artist?.biography || "";

  // FINAL PAYLOAD
  const artistData = {
    name,
    city,
    genre: normalizedGenre,
    biography: finalBiography,
    photos: mergedPhotos,
    mp3Files: mergedAudios,
    photosLimit: rules.photos,
    mp3Limit: rules.mp3,
    featuresLocked:
      !rules.biography && rules.photos === 0 && rules.mp3 === 0,
  };

  // CREATE OR UPDATE
  artist = artist
    ? await Artist.findByIdAndUpdate(artist._id, artistData, {
      new: true,
      runValidators: true,
    })
    : await Artist.create({ user: user.id, ...artistData });

  return res.status(200).json({
    success: true,
    message: `Artist profile updated successfully (${user.subscriptionPlan.toUpperCase()} Plan)`,
    data: { artist },
  });
});




//  GET My Artist Profile

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


//  GET Artists by Genre

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


//  GET Single Artist by ID

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


//  UPDATE Artist Profile

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
    mp3Files: req.files?.mp3Files
      ? req.files.mp3Files.map((file) => ({
        url: `/uploads/${file.filename}`,
        filename: file.filename,
        originalName: file.originalname,
      }))
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


//  DELETE Artist Profile

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



export const changeArtistPlanByAdmin = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { subscriptionPlan, notifyUser } = req.body;

  console.log("Changing artist plan:", { id, subscriptionPlan, notifyUser });

  // Validate subscription plan
  if (!["pro", "free"].includes(subscriptionPlan)) {
    return next(new ErrorResponse("Invalid subscription plan. Must be 'pro' or 'free'", 400));
  }

  // Find artist with populated user
  const artist = await Artist.findById(id).populate("user");

  if (!artist) {
    return next(new ErrorResponse("Artist not found", 404));
  }

  if (!artist.user) {
    return next(new ErrorResponse("Artist owner not found", 404));
  }

  // Check if plan is already the same
  if (artist.user.subscriptionPlan === subscriptionPlan) {
    return next(new ErrorResponse(`Artist is already on ${subscriptionPlan} plan`, 400));
  }

  // Update user's subscription plan
  artist.user.subscriptionPlan = subscriptionPlan;
  artist.user.subscriptionStatus = subscriptionPlan === "pro" ? "active" : "none";
  artist.user.updatedAt = Date.now();

  try {
    await artist.user.save();
    console.log("User plan updated successfully");
  } catch (error) {
    console.error("Error saving user:", error);
    return next(new ErrorResponse("Failed to update user subscription", 500));
  }

  // Update artist's limits based on plan
  if (subscriptionPlan === "pro") {
    // Pro plan features
    artist.photosLimit = 5;
    artist.mp3Limit = 5;
    artist.featuresLocked = false;

  } else {
    // Free plan restrictions
    artist.photosLimit = 0;
    artist.mp3Limit = 0;
    artist.featuresLocked = true;

  }

  artist.updatedAt = Date.now();

  try {
    await artist.save();
    console.log("Artist updated successfully");
  } catch (error) {
    console.error("Error saving artist:", error);
    return next(new ErrorResponse("Failed to update artist limits", 500));
  }

  // TODO: Send notification email if notifyUser is true
  if (notifyUser) {
    console.log("Notification email should be sent to:", artist.user.email);
    // Implement email sending logic here
  }

  // Populate the updated artist with user data
  const updatedArtist = await Artist.findById(id)
    .populate("user", "username email subscriptionPlan subscriptionStatus");

  res.status(200).json({
    success: true,
    message: `Artist plan changed to ${subscriptionPlan.toUpperCase()} successfully`,
    data: {
      artist: updatedArtist,
      updatedUser: updatedArtist.user,
      newPlan: subscriptionPlan
    }
  });
});


export const getArtistsForAdmin = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    status = "all",
    city = "",
    plan = "all",
    type = "artists"
  } = req.query;

  console.log("Admin fetching artists with params:", req.query);

  // Build query
  let query = {};

  // Search filter
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { city: { $regex: search, $options: "i" } },
      { genre: { $regex: search, $options: "i" } },
    ];
  }

  // Status filter
  if (status !== "all") {
    if (status === "active") query.isActive = true;
    else if (status === "inactive") query.isActive = false;
  }

  // City filter
  if (city) {
    query.city = city.toLowerCase();
  }

  // Plan filter - via user subscription plan
  if (plan !== "all") {
    const users = await User.find({ subscriptionPlan: plan }).select("_id");
    const userIds = users.map(u => u._id);
    query.user = { $in: userIds };
  }

  const skip = (Number(page) - 1) * Number(limit);

  // Get artists with populated user info
  const artists = await Artist.find(query)
    .populate("user", "username email subscriptionPlan subscriptionStatus createdAt")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  // Get total count for pagination
  const total = await Artist.countDocuments(query);

  // Calculate stats
  const proCount = await Artist.countDocuments({
    user: { $in: await User.find({ subscriptionPlan: "pro" }).select("_id") }
  });

  const freeCount = await Artist.countDocuments({
    user: { $in: await User.find({ subscriptionPlan: "free" }).select("_id") }
  });

  const activeCount = await Artist.countDocuments({ isActive: true });
  const inactiveCount = await Artist.countDocuments({ isActive: false });

  res.status(200).json({
    success: true,
    data: {
      content: artists,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total,
      },
      stats: {
        total,
        pro: proCount,
        free: freeCount,
        active: activeCount,
        inactive: inactiveCount,
      }
    },
  });
});
