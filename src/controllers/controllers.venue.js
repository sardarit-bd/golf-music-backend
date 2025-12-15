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


// Color palette for venue verification
const venueColors = [
  "#FF6B6B",
  "#4ECDC4",
  "#FFD166",
  "#06D6A0",
  "#118AB2",
  "#073B4C",
  "#EF476F",
  "#7209B7",
  "#FF9E00",
  "#8338EC",
];

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

    const venueData = {
      venueName: req.body.venueName,
      city: req.body.city.toLowerCase(),

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
    res.status(500).json({
      success: false,
      message: error.message,
    });
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

  // Create event
  const event = await Event.create({
    artistBandName: req.body.artist,
    time: req.body.time,
    date: utcDate,
    image: imageData,
    venue: venue._id,
    city: venue.city,
    color: venue.colorCode || "#000000",
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
  } = req.body;

  let venue = await Venue.findById(id).populate("user");

  if (!venue) {
    return next(new ErrorResponse("Venue not found", 404));
  }

  // Auto color assign only when verifying FIRST time
  if (isActive === true && venue.verifiedOrder === 0) {
    const verifiedCount = await Venue.countDocuments({
      isActive: true,
      city: venue.city,
      verifiedOrder: { $gt: 0 },
    });

    venue.verifiedOrder = verifiedCount + 1;

    const colorIndex = (venue.verifiedOrder - 1) % venueColors.length;
    venue.colorCode = venueColors[colorIndex];
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
      venue.colorCode = undefined;
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

  // Get count of verified venues in the same city
  const verifiedCount = await Venue.countDocuments({
    city: venue.city,
    verifiedOrder: { $gt: 0 },
  });

  // Assign verification order and color
  venue.verifiedOrder = verifiedCount + 1;
  venue.isActive = true;

  const colorIndex = (venue.verifiedOrder - 1) % venueColors.length;
  venue.colorCode = venueColors[colorIndex];

  venue.updatedAt = Date.now();
  await venue.save();

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
