import { validationResult } from "express-validator";
import Venue from "../models/model.venue.js";
import User from "../models/model.user.js";
import { cloudinary } from "../config/cloudinary.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import Event from "../models/models.event.js";
import { generateToken } from "../utils/helpers.js";
import { SUBSCRIPTION_RULES } from "../config/subscriptionRules.js";
import { sanitizeVenueForPlan } from "../utils/sanitize.js";

// Helper function for extracting uploaded photos
const extractUploadedPhotos = (req) => {
  if (!req.files) return [];

  if (Array.isArray(req.files)) {
    return req.files.map((file) => ({
      url: file.path,
      filename: file.filename,
    }));
  }

  if (req.files.photos && Array.isArray(req.files.photos)) {
    return req.files.photos.map((file) => ({
      url: file.path,
      filename: file.filename,
    }));
  }

  return [];
};

// Color palette for venue verification (20 colors per city)
const CITY_COLOR_PALETTES = {
  'new orleans': [
    "#FF6B6B", "#4ECDC4", "#FFD166", "#06D6A0", "#118AB2",
    "#073B4C", "#EF476F", "#7209B7", "#FF9E00", "#8338EC",
    "#3A86FF", "#FB5607", "#FF006E", "#8338EC", "#3A86FF",
    "#06D6A0", "#FFD166", "#EF476F", "#118AB2", "#7209B7"
  ],
  'biloxi': [
    "#E74C3C", "#3498DB", "#2ECC71", "#F39C12", "#9B59B6",
    "#1ABC9C", "#D35400", "#C0392B", "#27AE60", "#8E44AD",
    "#16A085", "#E67E22", "#2980B9", "#D68910", "#A569BD",
    "#138D75", "#CA6F1E", "#7D3C98", "#117A65", "#B9770E"
  ],
  'mobile': [
    "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF",
    "#00FFFF", "#FFA500", "#800080", "#008000", "#800000",
    "#008080", "#000080", "#808000", "#808080", "#C0C0C0",
    "#FFD700", "#DA70D6", "#32CD32", "#FF4500", "#9400D3"
  ],
  'pensacola': [
    "#1F77B4", "#FF7F0E", "#2CA02C", "#D62728", "#9467BD",
    "#8C564B", "#E377C2", "#7F7F7F", "#BCBD22", "#17BECF",
    "#393B79", "#637939", "#8C6D31", "#843C39", "#7B4173",
    "#5254A3", "#8CA252", "#BD9E39", "#AD494A", "#A55194"
  ]
};

// Helper function to get next available color for a city
const getNextAvailableColor = async (city) => {
  try {
    const usedColors = await Venue.find({ 
      city: city.toLowerCase(),
      colorCode: { $exists: true, $ne: null }
    }).distinct('colorCode');
    
    const cityColors = CITY_COLOR_PALETTES[city.toLowerCase()] || CITY_COLOR_PALETTES['mobile'];
    const availableColors = cityColors.filter(
      color => !usedColors.includes(color)
    );
    
    if (availableColors.length > 0) {
      return availableColors[0];
    }
    
    // If all colors are used, recycle from beginning
    return cityColors[0];
  } catch (error) {
    console.error('Error getting next available color:', error);
    return CITY_COLOR_PALETTES['mobile'][0];
  }
};

// Helper to validate color assignment
const validateAndAssignColor = async (city, colorCode, excludeVenueId = null) => {
  const cityColors = CITY_COLOR_PALETTES[city.toLowerCase()] || CITY_COLOR_PALETTES['mobile'];
  
  if (!cityColors.includes(colorCode)) {
    throw new Error(`Invalid color for ${city}. Must be one of the 20 city colors.`);
  }
  
  // Check if color is already taken in this city
  const query = {
    city: city.toLowerCase(),
    colorCode: colorCode
  };
  
  if (excludeVenueId) {
    query._id = { $ne: excludeVenueId };
  }
  
  const existingVenue = await Venue.findOne(query);
  
  if (existingVenue) {
    throw new Error(`Color ${colorCode} is already assigned to ${existingVenue.venueName} in ${city}`);
  }
  
  return colorCode;
};

// CREATE or UPDATE Venue Profile
export const createOrUpdateProfile = async (req, res, next) => {
  try {
    const user = req.user;

    const rules =
      SUBSCRIPTION_RULES.venue[user.subscriptionPlan] ||
      SUBSCRIPTION_RULES.venue.free;

    let venue = await Venue.findOne({ user: user._id });

    const oldPhotos = venue?.photos || [];

    let mergedPhotos = oldPhotos;

    if (rules.photos > 0) {
      const newPhotos = req.files
        ? req.files.map((file) => ({
            url: file.path,
            filename: file.filename,
          }))
        : [];

      mergedPhotos = [...oldPhotos, ...newPhotos].slice(0, rules.photos);
    } else {
      if (req.files?.length > 0) {
        return next(
          new ErrorResponse(
            "Free plan users cannot upload photos. Upgrade to Pro.",
            403
          )
        );
      }
    }

    const biography = rules.biography
      ? (req.body.biography ?? venue?.biography ?? "")
      : (venue?.biography ?? "");

    const openHours = rules.openHours
      ? (req.body.openHours ?? venue?.openHours ?? "")
      : (venue?.openHours ?? "");

    const openDays = rules.openHours
      ? (req.body.openDays ?? venue?.openDays ?? "")
      : (venue?.openDays ?? "");

    const seatingCapacity = rules.seatingCapacity
      ? (req.body.seatingCapacity
          ? parseInt(req.body.seatingCapacity)
          : (venue?.seatingCapacity || 0))
      : (venue?.seatingCapacity || 0);

    const address = rules.address
      ? (req.body.address ?? venue?.address ?? "")
      : (venue?.address ?? "");

    const city = req.body.city ? req.body.city.toLowerCase() : (venue?.city || 'mobile');

    const venueData = {
      venueName: req.body.venueName,
      city: city,
      address,
      seatingCapacity,
      biography,
      openHours,
      openDays,
      photos: mergedPhotos,
      photosLimit: rules.photos,
      showLimit: Number.isFinite(rules.shows) ? rules.shows : 1,
      featuresLocked: !(
        rules.biography ||
        rules.openHours ||
        rules.photos > 0 ||
        rules.address ||
        rules.seatingCapacity
      ),
      updatedAt: Date.now(),
    };

    // Handle color assignment
    try {
      if (req.body.colorCode) {
        venueData.colorCode = await validateAndAssignColor(
          city, 
          req.body.colorCode, 
          venue?._id
        );
      } else if (!venue || !venue.colorCode) {
        // Auto-assign color for new venues or venues without color
        venueData.colorCode = await getNextAvailableColor(city);
      }
    } catch (colorError) {
      return next(new ErrorResponse(colorError.message, 400));
    }

    if (venue) {
      Object.assign(venue, venueData);
      await venue.save();
    } else {
      venue = await Venue.create({
        user: user._id,
        ...venueData,
        isActive: false,
        verifiedOrder: 0,
      });
    }

    const safeVenue = sanitizeVenueForPlan(venue, rules);

    res.status(200).json({
      success: true,
      message: `Venue profile saved successfully (${user.subscriptionPlan.toUpperCase()} Plan)`,
      data: { venue: safeVenue },
    });
  } catch (error) {
    console.error("VENUE PROFILE ERROR:", error);
    next(error);
  }
};

export const getCalendarByCity = asyncHandler(async (req, res, next) => {
  const { city } = req.query;

  if (!city) {
    return next(new ErrorResponse("City is required", 400));
  }

  const venues = await Venue.find({ city: city.toLowerCase() })
    .select("venueName colorCode shows");

  res.status(200).json({
    success: true,
    data: { venues },
  });
});

const buildUtcDateOnly = (dateInput) => {
  const d = new Date(dateInput);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};

export const addShow = asyncHandler(async (req, res, next) => {
  const user = req.user;

  // Unified subscription rules
  const rules = SUBSCRIPTION_RULES.venue[user.subscriptionPlan];

  const venue = await Venue.findOne({ user: user.id });

  if (!venue) {
    throw new ErrorResponse("Venue not found", 404);
  }

  // MONTHLY SHOW LIMIT CHECK
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const endOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59));

  const showsThisMonth = await Event.countDocuments({
    venue: venue._id,
    date: { $gte: startOfMonth, $lte: endOfMonth },
    isActive: true,
  });

  if (showsThisMonth >= rules.shows) {
    return next(
      new ErrorResponse(
        "Your plan's monthly show limit has been reached. Upgrade to Pro for unlimited shows.",
        403
      )
    );
  }

  // Upload show image
  const imageData = req.file
    ? { url: req.file.path, filename: req.file.filename }
    : null;

  const utcDate = buildUtcDateOnly(req.body.date);

  // Create event (without color field - it will come from venue populate)
  const event = await Event.create({
    artistBandName: req.body.artist,
    time: req.body.time,
    date: utcDate,
    image: imageData,
    venue: venue._id,
    city: venue.city,
  });

  // Push to venue show list
  venue.shows.push({
    artist: req.body.artist,
    date: utcDate,
    time: req.body.time,
  });

  await venue.save();

  res.status(200).json({
    success: true,
    message: "Show added successfully",
    data: { venue, event },
  });
});

export const deleteVenueProfile = asyncHandler(async (req, res, next) => {
  const venue = await Venue.findOne({ user: req.user.id });

  if (!venue) {
    throw new ErrorResponse("Venue profile not found", 404);
  }

  if (venue.photos?.length) {
    for (const p of venue.photos) {
      await cloudinary.uploader.destroy(p.filename).catch(() => { });
    }
  }

  await venue.deleteOne();

  res.status(200).json({
    success: true,
    message: "Venue profile deleted successfully",
  });
});

export const getVenuesByCity = asyncHandler(async (req, res, next) => {
  const { city } = req.query;
  const query = { isActive: true };

  if (city && city !== "all") {
    query.city = city.toLowerCase();
  }

  const venues = await Venue.find(query)
    .populate("user", "username email subscriptionPlan")
    .sort({ venueName: 1 });

  const safeVenues = venues.map((v) => {
    const ownerPlan = v.user?.subscriptionPlan || "free";
    const rules =
    SUBSCRIPTION_RULES.venue[ownerPlan] || SUBSCRIPTION_RULES.venue.free;
    return sanitizeVenueForPlan(v, rules);
  });

  res.status(200).json({
    success: true,
    data: { venues: safeVenues },
  });
});

export const getVenue = asyncHandler(async (req, res, next) => {
  const venue = await Venue.findById(req.params.id)
    .populate("user", "username email subscriptionPlan");

  if (!venue) throw new ErrorResponse("Venue not found", 404);

  const ownerPlan = venue.user?.subscriptionPlan || "free";
  const rules =
    SUBSCRIPTION_RULES.venue[ownerPlan] || SUBSCRIPTION_RULES.venue.free;

  const safeVenue = sanitizeVenueForPlan(venue, rules);

  res.status(200).json({
    success: true,
    data: { venue: safeVenue },
  });
});

// GET My Venue Profile
export const getMyVenueProfile = asyncHandler(async (req, res) => {
  const venue = await Venue.findOne({ user: req.user.id })
    .populate("user", "username email subscriptionPlan");

  if (!venue) throw new ErrorResponse("Venue profile not found", 404);

  const safeVenue = sanitizeVenueForPlan(venue, req.rules);

  res.status(200).json({ success: true, data: { venue: safeVenue } });
});

// UPDATE Venue Profile (PUT)
export const updateVenueProfile = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));
    return next(new ErrorResponse("Validation failed", 400, { details: formatted }));
  }

  const user = req.user;

  const rules =
    SUBSCRIPTION_RULES.venue[user.subscriptionPlan] ||
    SUBSCRIPTION_RULES.venue.free;

  let venue = await Venue.findOne({ user: user.id });
  if (!venue) return next(new ErrorResponse("Venue profile not found", 404));

  // Handle color validation if provided
  if (req.body.colorCode && req.body.colorCode !== venue.colorCode) {
    try {
      req.body.colorCode = await validateAndAssignColor(
        req.body.city || venue.city,
        req.body.colorCode,
        venue._id
      );
    } catch (colorError) {
      return next(new ErrorResponse(colorError.message, 400));
    }
  }

  const existingPhotos = venue.photos || [];

  // normalize removedPhotos
  let removedPhotos = [];
  if (req.body.removedPhotos) {
    removedPhotos = Array.isArray(req.body.removedPhotos)
      ? req.body.removedPhotos
      : [req.body.removedPhotos];
  }

  let mergedPhotos = existingPhotos;

  if (rules.photos > 0) {
    const newPhotos = extractUploadedPhotos(req);

    const keptPhotos = existingPhotos.filter(
      (photo) => !removedPhotos.includes(photo.filename)
    );

    mergedPhotos = [...keptPhotos, ...newPhotos].slice(0, rules.photos);

    for (const filename of removedPhotos) {
      try {
        await cloudinary.uploader.destroy(filename);
      } catch {
        console.log("Cloudinary delete failed:", filename);
      }
    }
  } else {
    const attemptedNewPhotos = extractUploadedPhotos(req);
    if (attemptedNewPhotos.length > 0) {
      return next(
        new ErrorResponse("Free plan users cannot upload photos. Upgrade to Pro.", 403)
      );
    }
  }

  const {
    venueName,
    city,
    address,
    seatingCapacity,
    biography,
    openHours,
    openDays,
    colorCode,
  } = req.body;

  const updateData = {
    venueName,
    city: (city || venue.city).toLowerCase(),
    address: rules.address ? address : venue.address,
    seatingCapacity: rules.seatingCapacity
      ? Number.parseInt(seatingCapacity || "0")
      : venue.seatingCapacity,
    biography: rules.biography ? biography : venue.biography,
    openHours: rules.openHours ? openHours : venue.openHours,
    openDays: rules.openHours ? openDays : venue.openDays,
    photos: mergedPhotos,
    photosLimit: rules.photos,
    showLimit: Number.isFinite(rules.shows) ? rules.shows : venue.showLimit,
    featuresLocked: !(
      rules.biography ||
      rules.openHours ||
      rules.photos > 0 ||
      rules.address ||
      rules.seatingCapacity
    ),
    updatedAt: Date.now(),
  };

  // Only update color if provided and validated
  if (colorCode) {
    updateData.colorCode = colorCode;
  }

  venue = await Venue.findOneAndUpdate({ user: user.id }, updateData, {
    new: true,
    runValidators: true,
  });

  const safeVenue = sanitizeVenueForPlan(venue, rules);

  return res.status(200).json({
    success: true,
    message: `Venue profile updated successfully (${user.subscriptionPlan.toUpperCase()} Plan)`,
    data: { venue: safeVenue },
  });
});

// GET Venues for Admin (with pagination and filters)
export const getVenuesForAdmin = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10, search = "", status = "all", city = "", plan = "all" } = req.query;

  // Build query
  let query = {};

  // Search filter
  if (search) {
    query.$or = [
      { venueName: { $regex: search, $options: "i" } },
      { city: { $regex: search, $options: "i" } },
      { address: { $regex: search, $options: "i" } },
    ];
  }

  // Status filter
  if (status !== "all") {
    if (status === "active") query.isActive = true;
    else if (status === "inactive") query.isActive = false;
    else if (status === "verified") query.verifiedOrder = { $gt: 0 };
    else if (status === "unverified") query.verifiedOrder = 0;
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

  // Get venues with populated user info
  const venues = await Venue.find(query)
    .populate("user", "username email subscriptionPlan createdAt")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  // Get total count for pagination
  const total = await Venue.countDocuments(query);

  // Get event counts for each venue
  const venuesWithCounts = await Promise.all(
    venues.map(async (venue) => {
      const eventCount = await Event.countDocuments({ venue: venue._id });
      return {
        ...venue.toObject(),
        eventCount,
      };
    })
  );

  res.status(200).json({
    success: true,
    data: {
      content: venuesWithCounts,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / Number(limit)),
        total,
      },
    },
  });
});

// UPDATE Venue by Admin
export const updateVenueByAdmin = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const {
    venueName,
    city,
    address,
    seatingCapacity,
    biography,
    openHours,
    openDays,
    phone,
    website,
    isActive,
    colorCode,
  } = req.body;

  let venue = await Venue.findById(id).populate("user");

  if (!venue) {
    return next(new ErrorResponse("Venue not found", 404));
  }

  // Handle manual color assignment
  if (colorCode && colorCode !== venue.colorCode) {
    try {
      await validateAndAssignColor(
        city || venue.city,
        colorCode,
        id
      );
      venue.colorCode = colorCode;
      
      // Update all events for this venue with new color
      await Event.updateMany(
        { venue: venue._id },
        { $set: { color: colorCode } }
      );
    } catch (colorError) {
      return next(new ErrorResponse(colorError.message, 400));
    }
  }

  // Auto color assign only when verifying FIRST time
  if (isActive === true && venue.verifiedOrder === 0) {
    const verifiedCount = await Venue.countDocuments({
      isActive: true,
      city: venue.city,
      verifiedOrder: { $gt: 0 },
    });

    venue.verifiedOrder = verifiedCount + 1;

    // Auto-assign color if not already assigned
    if (!venue.colorCode) {
      venue.colorCode = await getNextAvailableColor(venue.city);
      
      // Update events with the new color
      await Event.updateMany(
        { venue: venue._id },
        { $set: { color: venue.colorCode } }
      );
    }
  }

  // Update fields
  if (venueName) venue.venueName = venueName;
  if (city) venue.city = city.toLowerCase();
  if (address) venue.address = address;
  if (seatingCapacity !== undefined) venue.seatingCapacity = seatingCapacity;
  if (biography !== undefined) venue.biography = biography;
  if (openHours !== undefined) venue.openHours = openHours;
  if (openDays !== undefined) venue.openDays = openDays;
  if (phone !== undefined) venue.phone = phone;
  if (website !== undefined) venue.website = website;
  if (isActive !== undefined) {
    venue.isActive = isActive;
    // If deactivating, also reset verification?
    if (!isActive && venue.verifiedOrder > 0) {
      venue.verifiedOrder = 0;
      // Don't reset color when deactivating - keep it assigned
    }
  }

  venue.updatedAt = Date.now();
  await venue.save();

  res.status(200).json({
    success: true,
    message: "Venue updated successfully",
    data: { venue },
  });
});

// VERIFY Venue by Admin (with color assignment)
export const verifyVenueByAdmin = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const venue = await Venue.findById(id).populate("user");

  if (!venue) {
    return next(new ErrorResponse("Venue not found", 404));
  }

  // Check if already verified
  if (venue.verifiedOrder > 0) {
    return next(new ErrorResponse("Venue is already verified", 400));
  }

  // Get or assign color
  let colorCode;
  if (req.body.colorCode) {
    try {
      colorCode = await validateAndAssignColor(venue.city, req.body.colorCode, id);
    } catch (colorError) {
      return next(new ErrorResponse(colorError.message, 400));
    }
  } else {
    // Auto-assign next available color
    colorCode = await getNextAvailableColor(venue.city);
  }

  // Get count of verified venues in the same city
  const verifiedCount = await Venue.countDocuments({
    city: venue.city,
    verifiedOrder: { $gt: 0 },
  });

  // Assign verification order and color
  venue.verifiedOrder = verifiedCount + 1;
  venue.isActive = true;
  venue.colorCode = colorCode;

  venue.updatedAt = Date.now();
  await venue.save();

  // Update all events for this venue with the new color
  await Event.updateMany(
    { venue: venue._id },
    { $set: { color: colorCode } }
  );

  res.status(200).json({
    success: true,
    message: "Venue verified successfully",
    data: { venue },
  });
});

// DELETE Venue by Admin
export const deleteVenueByAdmin = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const venue = await Venue.findById(id);

  if (!venue) {
    return next(new ErrorResponse("Venue not found", 404));
  }

  // Delete associated events
  await Event.deleteMany({ venue: venue._id });

  // Delete photos from Cloudinary
  if (venue.photos?.length) {
    for (const photo of venue.photos) {
      try {
        await cloudinary.uploader.destroy(photo.filename);
      } catch (err) {
        console.warn("Failed to delete image from Cloudinary:", photo.filename);
      }
    }
  }

  await venue.deleteOne();

  res.status(200).json({
    success: true,
    message: "Venue profile deleted successfully",
  });
});

export const changeVenuePlanByAdmin = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { subscriptionPlan, notifyUser } = req.body;

  if (!["pro", "free"].includes(subscriptionPlan)) {
    return next(new ErrorResponse("Invalid subscription plan", 400));
  }

  const venue = await Venue.findById(id).populate("user");
  if (!venue) return next(new ErrorResponse("Venue not found", 404));
  if (!venue.user) return next(new ErrorResponse("Venue owner not found", 404));

  const user = venue.user;

  if (user.subscriptionPlan === subscriptionPlan) {
    return next(
      new ErrorResponse(`Venue is already on ${subscriptionPlan}`, 400)
    );
  }

  /* =========================
     PRO PLAN + ONE-TIME TRIAL
  ========================= */
  if (subscriptionPlan === "pro") {
    const trialDays = SUBSCRIPTION_RULES.venue.pro.trialDays || 0;

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
    SUBSCRIPTION_RULES.venue[subscriptionPlan] ||
    SUBSCRIPTION_RULES.venue.free;

  venue.photosLimit = rules.photos;
  venue.showLimit = Number.isFinite(rules.shows) ? rules.shows : 1;

  venue.featuresLocked = !(
    rules.biography ||
    rules.openHours ||
    rules.photos > 0 ||
    rules.address ||
    rules.seatingCapacity
  );

  venue.updatedAt = Date.now();
  await venue.save();

  const updatedVenue = await Venue.findById(id).populate(
    "user",
    "username email subscriptionPlan subscriptionStatus trialEndsAt trialUsed"
  );

  res.status(200).json({
    success: true,
    message:
      subscriptionPlan === "pro"
        ? "Venue upgraded successfully"
        : "Venue downgraded successfully",
    data: { venue: updatedVenue },
  });
});

// NEW: Get available colors for a city (for admin UI)
export const getAvailableColorsForCity = asyncHandler(async (req, res, next) => {
  const { city } = req.query;
  
  if (!city) {
    return next(new ErrorResponse("City is required", 400));
  }

  const cityColors = CITY_COLOR_PALETTES[city.toLowerCase()] || CITY_COLOR_PALETTES['mobile'];
  
  // Get used colors in this city
  const usedColors = await Venue.find({ 
    city: city.toLowerCase(),
    colorCode: { $exists: true, $ne: null }
  }).distinct('colorCode');
  
  const availableColors = cityColors.filter(
    color => !usedColors.includes(color)
  );
  
  const venuesWithColors = await Venue.find({ 
    city: city.toLowerCase(),
    colorCode: { $exists: true, $ne: null }
  }).select('venueName colorCode');
  
  res.status(200).json({
    success: true,
    data: {
      city: city.toLowerCase(),
      totalColors: cityColors.length,
      usedColors: usedColors.length,
      availableColors: availableColors.length,
      colorPalette: cityColors,
      availableColorsList: availableColors,
      venuesWithColors: venuesWithColors.map(v => ({
        venueName: v.venueName,
        colorCode: v.colorCode,
        isAvailable: false
      }))
    }
  });
});

export default {
  createOrUpdateProfile,
  getCalendarByCity,
  addShow,
  deleteVenueProfile,
  getVenuesByCity,
  getVenue,
  getMyVenueProfile,
  updateVenueProfile,
  getVenuesForAdmin,
  updateVenueByAdmin,
  verifyVenueByAdmin,
  deleteVenueByAdmin,
  changeVenuePlanByAdmin,
  getAvailableColorsForCity
};