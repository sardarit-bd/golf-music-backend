import { validationResult } from "express-validator";
import Artist from "../models/model.artist.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { SUBSCRIPTION_RULES } from "../config/subscriptionRules.js";
import User from "../models/model.user.js";
import { cloudinary } from "../config/cloudinary.js";
import { sanitizeArtistForPlan } from "../utils/sanitizeArtist.js";


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

  if (rules.photos === 0) removedPhotos = [];
  if (rules.mp3 === 0) removedAudios = [];

  for (const filename of removedPhotos) {
    const photo = artist.photos.find(p => p.filename === filename);

    if (photo?.publicId) {
      await cloudinary.uploader.destroy(photo.publicId, {
        resource_type: "image",
      });
    }
  }


  for (const filename of removedAudios) {
    const audio = artist.mp3Files.find(a => a.filename === filename);

    if (audio?.publicId) {
      await cloudinary.uploader.destroy(audio.publicId, {
        resource_type: "video",
      });
    }
  }


  const oldPhotos =
    artist?.photos?.filter((p) => !removedPhotos.includes(p.filename)) || [];

  const oldAudios =
    artist?.mp3Files?.filter((a) => !removedAudios.includes(a.filename)) || [];

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
      filename: file.originalname,
      publicId: file.filename,
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
      filename: file.originalname,
      originalName: file.originalname,
      publicId: file.filename,
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

  const finalBiography = rules.biography
    ? biography
    : artist?.biography || "";

  const artistData = {
    name,
    city,
    genre: normalizedGenre,
    biography: finalBiography,
    photos: mergedPhotos,
    mp3Files: mergedAudios,
    photosLimit: rules.photos,
    mp3Limit: rules.mp3,
    featuresLocked: Object.values({
      biography: rules.biography,
      photos: rules.photos > 0,
      mp3: rules.mp3 > 0,
    }).every(v => v === false)
  };

  artist = artist
    ? await Artist.findByIdAndUpdate(artist._id, artistData, {
      new: true,
      runValidators: true,
    })
    : await Artist.create({ user: user.id, ...artistData });

  const safeArtist = sanitizeArtistForPlan(artist, rules);

  return res.status(200).json({
    success: true,
    message: `Artist profile updated successfully (${user.subscriptionPlan.toUpperCase()} Plan)`,
    data: { artist: safeArtist },
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


//  GET Artists by Genre

export const getArtistsByGenre = asyncHandler(async (req, res, next) => {
  const { genre } = req.query;
  let query = { isActive: true };

  if (genre && genre !== "all") query.genre = genre.toLowerCase();

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



//  UPDATE Artist Profile

// export const updateArtistProfile = asyncHandler(async (req, res, next) => {
//   const { name, city, genre, biography } = req.body;
//   const normalizedGenre = genre?.toLowerCase();

//   const updateData = {
//     name,
//     city,
//     genre: normalizedGenre,
//     biography,
//     photos: req.files?.photos
//       ? req.files.photos.map((file) => ({
//         url: `/uploads/${file.filename}`,
//         filename: file.filename,
//       }))
//       : undefined,
//     mp3Files: req.files?.mp3Files
//       ? req.files.mp3Files.map((file) => ({
//         url: `/uploads/${file.filename}`,
//         filename: file.filename,
//         originalName: file.originalname,
//       }))
//       : undefined,
//   };

//   const artist = await Artist.findOneAndUpdate(
//     { user: req.user.id },
//     updateData,
//     { new: true, runValidators: true }
//   );

//   if (!artist) {
//     return next(new ErrorResponse("Artist profile not found", 404));
//   }

//   res.status(200).json({
//     success: true,
//     message: "Artist profile updated successfully",
//     data: { artist },
//   });
// });


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

  const rules =
    SUBSCRIPTION_RULES.artist[subscriptionPlan] ||
    SUBSCRIPTION_RULES.artist.free;

  artist.photosLimit = rules.photos;
  artist.mp3Limit = rules.mp3;

  artist.featuresLocked = !(
    rules.biography ||
    rules.photos > 0 ||
    rules.mp3 > 0
  );

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
