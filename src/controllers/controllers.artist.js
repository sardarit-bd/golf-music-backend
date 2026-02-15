import { validationResult } from "express-validator";
import path from "path";
import Artist from "../models/model.artist.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { SUBSCRIPTION_RULES } from "../config/subscriptionRules.js";
import { deleteFromCloudinary, extractPublicIdFromUrl } from "../config/cloudinary.js";
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

/**
 * Helper: Extract filename from Cloudinary URL
 */
const extractFilenameFromUrl = (url) => {
  if (!url) return null;
  try {
    const parts = url.split('/');
    const filename = parts[parts.length - 1].split('?')[0];
    return filename;
  } catch (error) {
    return null;
  }
};

/**
 * Helper: Extract public ID from Cloudinary URL
 */
const extractPublicIdHelper = (url) => {
  if (!url || !url.includes('cloudinary.com')) return null;
  
  try {
    // Use the existing extractPublicIdFromUrl function from cloudinary config
    return extractPublicIdFromUrl(url);
  } catch (error) {
    console.error('Error extracting public ID:', error);
    return null;
  }
};

/**
 * Helper: Delete single file from Cloudinary
 */
const deleteFile = async (fileUrl) => {
  if (!fileUrl || !fileUrl.includes('cloudinary.com')) {
    return { success: false, message: 'Invalid URL' };
  }

  try {
    const result = await deleteFromCloudinary(fileUrl, 'auto');
    return { 
      success: result.result === 'ok',
      result 
    };
  } catch (error) {
    console.error('❌ Delete failed:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Helper: Delete multiple files from Cloudinary
 */
const deleteMultipleFiles = async (urls) => {
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return { success: true, deleted: 0 };
  }

  const results = [];
  for (const url of urls) {
    const result = await deleteFile(url);
    results.push(result);
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const successful = results.filter(r => r.success).length;
  console.log(`✅ Deleted ${successful}/${urls.length} files`);

  return {
    success: successful === urls.length,
    deleted: successful,
    failed: urls.length - successful
  };
};

/**
 * CREATE or UPDATE Artist Profile - FIXED VERSION
 */
export const createOrUpdateProfile = asyncHandler(async (req, res, next) => {
  // Validation
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

  // Get existing artist
  let artist = await Artist.findOne({ user: user.id });

  /* =========================
     HANDLE DELETED FILES
  ========================= */
  let photosToDelete = [];
  let audiosToDelete = [];

  // Parse photos to delete
  if (req.body.photosToDelete) {
    try {
      photosToDelete = JSON.parse(req.body.photosToDelete);
    } catch {
      photosToDelete = Array.isArray(req.body.photosToDelete) 
        ? req.body.photosToDelete 
        : [req.body.photosToDelete];
    }
  }

  // Parse audios to delete
  if (req.body.audiosToDelete) {
    try {
      audiosToDelete = JSON.parse(req.body.audiosToDelete);
    } catch {
      audiosToDelete = Array.isArray(req.body.audiosToDelete) 
        ? req.body.audiosToDelete 
        : [req.body.audiosToDelete];
    }
  }

  console.log('📸 Photos to delete:', photosToDelete.length);
  console.log('🎵 Audios to delete:', audiosToDelete.length);

  /* =========================
     DELETE FILES FROM CLOUDINARY
  ========================= */
  if (photosToDelete.length > 0) {
    await deleteMultipleFiles(photosToDelete);
  }

  if (audiosToDelete.length > 0) {
    await deleteMultipleFiles(audiosToDelete);
  }

  /* =========================
     FILTER EXISTING FILES
  ========================= */
  // Filter out deleted photos
  const existingPhotos = artist?.photos?.filter(photo => 
    photo && photo.url && !photosToDelete.includes(photo.url)
  ) || [];

  // Filter out deleted audios
  const existingAudios = artist?.mp3Files?.filter(audio => 
    audio && audio.url && !audiosToDelete.includes(audio.url)
  ) || [];

  /* =========================
     PROCESS NEW FILES
  ========================= */
  let newPhotos = [];
  let newAudios = [];

  // Handle new photo uploads
  if (req.files?.photos?.length) {
    const totalPhotos = existingPhotos.length + req.files.photos.length;
    if (totalPhotos > 5) {
      return next(
        new ErrorResponse("You can only upload up to 5 photos.", 400)
      );
    }

    newPhotos = req.files.photos.map((file) => {
      // Prepare photo object
      const photoObj = {
        url: file.path, // Cloudinary URL
        filename: file.originalname || extractFilenameFromUrl(file.path),
      };
      
      // Add publicId if available (from Cloudinary filename or extracted)
      const publicId = file.filename || extractPublicIdHelper(file.path);
      if (publicId) {
        photoObj.publicId = publicId;
      }
      
      return photoObj;
    });
  }

  // Handle new audio uploads
  if (req.files?.mp3Files?.length) {
    const totalAudios = existingAudios.length + req.files.mp3Files.length;
    if (totalAudios > 5) {
      return next(
        new ErrorResponse("You can only upload up to 5 audio files.", 400)
      );
    }

    newAudios = req.files.mp3Files.map((file) => {
      // Prepare audio object
      const audioObj = {
        url: file.path, // Cloudinary URL
        filename: file.originalname || extractFilenameFromUrl(file.path),
        originalName: file.originalname,
      };
      
      // Add publicId if available (from Cloudinary filename or extracted)
      const publicId = file.filename || extractPublicIdHelper(file.path);
      if (publicId) {
        audioObj.publicId = publicId;
      }
      
      return audioObj;
    });
  }

  /* =========================
     MERGE FILES (WITH LIMITS)
  ========================= */
  const mergedPhotos = [...existingPhotos, ...newPhotos].slice(0, 5);
  const mergedAudios = [...existingAudios, ...newAudios].slice(0, 5);

  const finalBiography = biography || artist?.biography || "";

  /* =========================
     PREPARE ARTIST DATA
  ========================= */
  const artistData = {
    name,
    city: normalizedCity,
    state,
    genre: normalizedGenre,
    biography: finalBiography,
    photos: mergedPhotos,
    mp3Files: mergedAudios,
    subscriptionPlan: user.subscriptionPlan,
    isActive: true,
    updatedAt: Date.now(),
  };

  /* =========================
     SAVE TO DATABASE
  ========================= */
  let updatedArtist;

  if (artist) {
    // Update existing artist
    updatedArtist = await Artist.findByIdAndUpdate(
      artist._id, 
      artistData, 
      { new: true, runValidators: true }
    ).populate("user", "username email subscriptionPlan");
  } else {
    // Create new artist
    updatedArtist = await Artist.create({ 
      user: user.id, 
      ...artistData 
    });
    updatedArtist = await Artist.populate(updatedArtist, {
      path: "user",
      select: "username email subscriptionPlan"
    });
  }

  const safeArtist = sanitizeArtistForPlan(updatedArtist, rules);

  console.log('✅ Profile saved. Photos:', mergedPhotos.length, 'Audios:', mergedAudios.length);

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

/**
 * GET My Artist Profile
 */
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

/**
 * GET Artists by Genre and Location
 */
export const getArtistsByGenre = asyncHandler(async (req, res, next) => {
  const { genre, state, city } = req.query;
  let query = { isActive: true };

  // Genre filter
  if (genre && genre !== "all") query.genre = genre.toLowerCase();
  
  // State filter
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

/**
 * GET Single Artist by ID
 */
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

/**
 * DELETE Artist Profile - FIXED
 */
export const deleteArtistProfile = asyncHandler(async (req, res, next) => {
  const artist = await Artist.findOne({ user: req.user.id });

  if (!artist) {
    return next(new ErrorResponse("Artist profile not found", 404));
  }

  // Collect all files to delete
  const filesToDelete = [
    ...(artist.photos?.map(p => p.url) || []),
    ...(artist.mp3Files?.map(a => a.url) || [])
  ];

  console.log(`🗑️ Deleting ${filesToDelete.length} files...`);

  // Delete all files from Cloudinary
  if (filesToDelete.length > 0) {
    await deleteMultipleFiles(filesToDelete);
  }

  // Delete from database
  await artist.deleteOne();

  res.status(200).json({
    success: true,
    message: "Artist profile deleted successfully",
  });
});

/**
 * UPDATE Artist by Admin
 */
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

/**
 * DELETE Artist by Admin - FIXED
 */
export const deleteArtistByAdmin = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const artist = await Artist.findById(id);

  if (!artist) {
    return next(new ErrorResponse("Artist not found", 404));
  }

  // Collect all files to delete
  const filesToDelete = [
    ...(artist.photos?.map(p => p.url) || []),
    ...(artist.mp3Files?.map(a => a.url) || [])
  ];

  console.log(`🗑️ Deleting ${filesToDelete.length} files...`);

  // Delete all files from Cloudinary
  if (filesToDelete.length > 0) {
    await deleteMultipleFiles(filesToDelete);
  }

  // Delete from database
  await artist.deleteOne();

  res.status(200).json({
    success: true,
    message: "Artist profile deleted successfully",
  });
});

/**
 * Change Artist Plan by Admin
 */
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

/**
 * Get Artists for Admin
 */
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

  // State filter
  if (state !== "all") {
    query.state = state;
  }

  // Plan filter
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

  // Get state-wise counts
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

/**
 * Get artists by location (for homepage dropdown)
 */
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
    .limit(50);

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