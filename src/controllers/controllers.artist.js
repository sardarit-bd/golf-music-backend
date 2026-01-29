import { validationResult } from "express-validator";
import Artist from "../models/model.artist.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { SUBSCRIPTION_RULES } from "../config/subscriptionRules.js";
import User from "../models/model.user.js";
import { cloudinary } from "../config/cloudinary.js";
import { sanitizeArtistForPlan } from "../utils/sanitizeArtist.js";


// Helper function to get state from city
const getStateFromCity = (city) => {
  if (!city) return '';
  
  const cityLower = city.toLowerCase();
  
  // Map cities to states based on client requirement
  const stateMap = {
    // Louisiana cities
    'new orleans': 'Louisiana',
    'baton rouge': 'Louisiana',
    'lafayette': 'Louisiana',
    'shreveport': 'Louisiana',
    'lake charles': 'Louisiana',
    'monroe': 'Louisiana',
    
    // Mississippi cities
    'jackson': 'Mississippi',
    'biloxi': 'Mississippi',
    'gulfport': 'Mississippi',
    'oxford': 'Mississippi',
    'hattiesburg': 'Mississippi',
    
    // Alabama cities
    'birmingham': 'Alabama',
    'mobile': 'Alabama',
    'huntsville': 'Alabama',
    'tuscaloosa': 'Alabama',
    
    // Florida cities
    'tampa': 'Florida',
    'st. petersburg': 'Florida',
    'clearwater': 'Florida',
    'pensacola': 'Florida',
    'panama city': 'Florida',
    'fort myers': 'Florida',
  };
  
  return stateMap[cityLower] || '';
};

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
  const normalizedCity = city?.toLowerCase();
  const state = getStateFromCity(normalizedCity);

  let artist = await Artist.findOne({ user: user.id });

  let removedPhotos = [];
  let removedAudios = [];

  // Parse removed files
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

  // Delete photos from Cloudinary
  for (const filename of removedPhotos) {
    try {
      const publicId = filename.replace(/\.[^/.]+$/, "");
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      console.log("Failed to delete photo:", filename);
    }
  }

  // Delete audios from Cloudinary
  for (const filename of removedAudios) {
    try {
      const publicId = filename.replace(/\.[^/.]+$/, "");
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      console.log("Failed to delete audio:", filename);
    }
  }

  // Filter out removed photos and audios
  const oldPhotos = artist?.photos?.filter((p) => 
    p && p.filename && !removedPhotos.includes(p.filename)
  ) || [];

  const oldAudios = artist?.mp3Files?.filter((a) => 
    a && a.filename && !removedAudios.includes(a.filename)
  ) || [];

  let newPhotos = [];
  let newAudios = [];

  // Handle new photo uploads - CLIENT REQUIREMENT: Max 5 photos for all users
  if (req.files?.photos?.length) {
    // Check if total photos exceed 5 (client requirement)
    const totalPhotos = oldPhotos.length + req.files.photos.length;
    if (totalPhotos > 5) {
      return next(
        new ErrorResponse(
          `You can only upload up to 5 photos.`,
          400
        )
      );
    }

    newPhotos = req.files.photos.map((file) => ({
      url: file.path,
      filename: file.filename,
    }));
  }

  // Handle new audio uploads - CLIENT REQUIREMENT: Max 1 audio for all users
  if (req.files?.mp3Files?.length) {
    // Check if total audio files exceed 1 (client requirement)
    const totalAudios = oldAudios.length + req.files.mp3Files.length;
    if (totalAudios > 5) {
      return next(
        new ErrorResponse(
          `You can only upload up to 5 audio files.`,
          400
        )
      );
    }

    newAudios = req.files.mp3Files.map((file) => ({
      url: file.path,
      filename: file.originalname,
      originalName: file.originalname,
    }));
  }

  const mergedPhotos = [...oldPhotos, ...newPhotos].slice(0, 5); // Max 5 photos
  const mergedAudios = [...oldAudios, ...newAudios].slice(0, 5); // Max 1 audio

  const finalBiography = biography || artist?.biography || "";

  const artistData = {
    name,
    city: normalizedCity,
    state,
    genre: normalizedGenre,
    biography: finalBiography,
    photos: mergedPhotos,
    mp3Files: mergedAudios,
    subscriptionPlan: user.subscriptionPlan,
    isActive: true, // All artists are active by default
  };

  const options = {
    new: true,
    runValidators: true,
    upsert: !artist
  };

  if (artist) {
    artist = await Artist.findByIdAndUpdate(artist._id, artistData, options);
  } else {
    artist = await Artist.create({ user: user.id, ...artistData });
  }

  const safeArtist = sanitizeArtistForPlan(artist, rules);

  return res.status(200).json({
    success: true,
    message: `Artist profile ${artist ? 'updated' : 'created'} successfully`,
    data: { 
      artist: safeArtist,
      limits: {
        photos: 5,
        mp3: 5,
        biography: true
      }
    },
  });
});



//  GET My Artist Profile

export const getMyArtistProfile = asyncHandler(async (req, res, next) => {
  const artist = await Artist.findOne({ user: req.user.id }).populate(
    "user",
    "username email subscriptionPlan"
  );

  if (!artist) return next(new ErrorResponse("Artist profile not found", 404));

  const rules = req.rules || (SUBSCRIPTION_RULES.artist[req.user.subscriptionPlan] || SUBSCRIPTION_RULES.artist.free);
  const safeArtist = sanitizeArtistForPlan(artist, rules);

  res.status(200).json({
    success: true,
    data: { artist: safeArtist },
  });
});


//  GET Artists by Genre and Location

export const getArtistsByGenre = asyncHandler(async (req, res, next) => {
  const { genre, state, city } = req.query;
  let query = { isActive: true };

  // Genre filter
  if (genre && genre !== "all") query.genre = genre.toLowerCase();
  
  // State filter (for location-based categorization)
  if (state && state !== "all") query.state = state;
  
  // City filter
  if (city && city !== "all") query.city = city.toLowerCase();

  const artists = await Artist.find(query)
    .populate("user", "username email subscriptionPlan")
    .sort({ name: 1 });

  const safeArtists = artists.map((a) => {
    const ownerPlan = a.user?.subscriptionPlan || "free";
    const rules = SUBSCRIPTION_RULES.artist[ownerPlan] || SUBSCRIPTION_RULES.artist.free;
    return sanitizeArtistForPlan(a, rules);
  });

  res.status(200).json({
    success: true,
    data: { artists: safeArtists },
  });
});



//  GET Single Artist by ID

export const getArtist = asyncHandler(async (req, res, next) => {
  const artist = await Artist.findById(req.params.id).populate(
    "user", "username email subscriptionPlan"
  );

  if (!artist) return next(new ErrorResponse("Artist not found", 404));

  const ownerPlan = artist.user?.subscriptionPlan || "free";
  const rules = SUBSCRIPTION_RULES.artist[ownerPlan] || SUBSCRIPTION_RULES.artist.free;
  const safeArtist = sanitizeArtistForPlan(artist, rules);

  res.status(200).json({
    success: true,
    data: { artist: safeArtist },
  });
});



//  DELETE Artist Profile

export const deleteArtistProfile = asyncHandler(async (req, res, next) => {
  const artist = await Artist.findOne({ user: req.user.id });

  if (!artist) {
    return next(new ErrorResponse("Artist profile not found", 404));
  }

  // Delete photos from Cloudinary
  if (artist.photos && artist.photos.length > 0) {
    for (const photo of artist.photos) {
      if (photo.publicId) {
        try {
          await cloudinary.uploader.destroy(photo.publicId);
        } catch (err) {
          console.log("Failed to delete photo:", photo.publicId);
        }
      }
    }
  }

  // Delete audios from Cloudinary
  if (artist.mp3Files && artist.mp3Files.length > 0) {
    for (const audio of artist.mp3Files) {
      if (audio.publicId) {
        try {
          await cloudinary.uploader.destroy(audio.publicId);
        } catch (err) {
          console.log("Failed to delete audio:", audio.publicId);
        }
      }
    }
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
  const { name, city, genre, biography, isActive } = req.body;

  const normalizedGenre = genre?.toLowerCase();
  const normalizedCity = city?.toLowerCase();
  const state = getStateFromCity(normalizedCity);

  const updateData = {
    ...(name && { name }),
    ...(city && { city: normalizedCity }),
    ...(city && { state }),
    ...(genre && { genre: normalizedGenre }),
    ...(biography !== undefined && { biography }),
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

  // Delete photos from Cloudinary
  if (artist.photos && artist.photos.length > 0) {
    for (const photo of artist.photos) {
      if (photo.publicId) {
        try {
          await cloudinary.uploader.destroy(photo.publicId);
        } catch (err) {
          console.log("Failed to delete photo:", photo.publicId);
        }
      }
    }
  }

  // Delete audios from Cloudinary
  if (artist.mp3Files && artist.mp3Files.length > 0) {
    for (const audio of artist.mp3Files) {
      if (audio.publicId) {
        try {
          await cloudinary.uploader.destroy(audio.publicId);
        } catch (err) {
          console.log("Failed to delete audio:", audio.publicId);
        }
      }
    }
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

  if (!["pro", "free"].includes(subscriptionPlan)) {
    return next(new ErrorResponse("Invalid subscription plan", 400));
  }

  const artist = await Artist.findById(id).populate("user");
  if (!artist) return next(new ErrorResponse("Artist not found", 404));
  if (!artist.user) return next(new ErrorResponse("Artist owner not found", 404));

  const user = artist.user;

  if (user.subscriptionPlan === subscriptionPlan) {
    return next(
      new ErrorResponse(`Artist is already on ${subscriptionPlan} plan`, 400)
    );
  }

  if (subscriptionPlan === "pro") {
    const trialDays = SUBSCRIPTION_RULES.artist.pro.trialDays || 0;

    user.subscriptionPlan = "pro";

    if (!user.trialUsed && trialDays > 0) {
      user.subscriptionStatus = "trialing";
      user.trialStartedAt = new Date();
      user.trialEndsAt = new Date(
        Date.now() + trialDays * 24 * 60 * 60 * 1000
      );
      user.trialUsed = true;
    } else {
      user.subscriptionStatus = "active";
      user.trialEndsAt = null;
    }
  }

  if (subscriptionPlan === "free") {
    user.subscriptionPlan = "free";
    user.subscriptionStatus = "none";
    user.trialEndsAt = null;
  }

  await user.save();

  // Update artist subscription plan
  artist.subscriptionPlan = subscriptionPlan;
  artist.updatedAt = Date.now();
  await artist.save();

  const updatedArtist = await Artist.findById(id).populate(
    "user",
    "username email subscriptionPlan subscriptionStatus trialEndsAt trialUsed"
  );

  res.status(200).json({
    success: true,
    message:
      subscriptionPlan === "pro"
        ? "Artist upgraded successfully"
        : "Artist downgraded successfully",
    data: { artist: updatedArtist },
  });
});



export const getArtistsForAdmin = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    status = "all",
    city = "",
    state = "all",
    plan = "all",
    type = "artists"
  } = req.query;

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

  // State filter (location-based categorization)
  if (state !== "all") {
    query.state = state;
  }

  // Plan filter - via user subscription plan or artist subscriptionPlan
  if (plan !== "all") {
    query.subscriptionPlan = plan;
  }

  const skip = (Number(page) - 1) * Number(limit);

  // Get artists with populated user info
  const artists = await Artist.find(query)
    .populate("user", "username email createdAt")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  // Get total count for pagination
  const total = await Artist.countDocuments(query);

  // Calculate stats
  const proCount = await Artist.countDocuments({ subscriptionPlan: "pro" });
  const freeCount = await Artist.countDocuments({ subscriptionPlan: "free" });
  const activeCount = await Artist.countDocuments({ isActive: true });
  const inactiveCount = await Artist.countDocuments({ isActive: false });

  // Get state-wise counts for location categorization
  const stateCounts = {
    Louisiana: await Artist.countDocuments({ state: 'Louisiana' }),
    Mississippi: await Artist.countDocuments({ state: 'Mississippi' }),
    Alabama: await Artist.countDocuments({ state: 'Alabama' }),
    Florida: await Artist.countDocuments({ state: 'Florida' }),
  };

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
        byState: stateCounts
      }
    },
  });
});

// Get artists by location (for homepage dropdown)
export const getArtistsByLocation = asyncHandler(async (req, res, next) => {
  const { state, city } = req.query;
  
  if (!state) {
    return next(new ErrorResponse("State parameter is required", 400));
  }

  let query = { 
    state: state,
    isActive: true 
  };

  if (city && city !== "all") {
    query.city = city.toLowerCase();
  }

  const artists = await Artist.find(query)
    .populate("user", "username email subscriptionPlan")
    .sort({ name: 1 })
    .limit(50); // Limit for performance

  const safeArtists = artists.map((a) => {
    const ownerPlan = a.user?.subscriptionPlan || "free";
    const rules = SUBSCRIPTION_RULES.artist[ownerPlan] || SUBSCRIPTION_RULES.artist.free;
    return sanitizeArtistForPlan(a, rules);
  });

  res.status(200).json({
    success: true,
    data: { 
      artists: safeArtists,
      location: { state, city },
      count: safeArtists.length
    },
  });
});