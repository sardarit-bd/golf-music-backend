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
import { ColorAssigner } from "../utils/colorAssigner.js";
import { formatCityName } from "../utils/formatCityName.js";
import StateCity from "../models/stateCity.model.js";
import { parseEventDate } from "./controller.event.js";
import { STATE_CITY_MAPPING } from "../utils/constants.js";
import { getPlanRules, isSubscriptionEnabled, SUBSCRIPTION_CONFIG } from "../config/SUBSCRIPTION_CONFIG.js";

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

// CREATE or UPDATE Venue Profile
export const createOrUpdateProfile = async (req, res, next) => {
  try {
    const user = req.user;

    // Centralized plan management
    let userPlan = user.subscriptionPlan || SUBSCRIPTION_CONFIG.SYSTEM_WIDE.DEFAULT_PLAN;

    if (SUBSCRIPTION_CONFIG.SYSTEM_WIDE.FORCE_FREE_FOR_ALL) {
      userPlan = "free";
      // Optionally update user in database
      user.subscriptionPlan = "free";
      await user.save();
    }

    // Get rules based on config
    const rules = getPlanRules("venue", userPlan);

    let venue = await Venue.findOne({ user: user._id });

    const { state, city } = req.body;

    if (state && city) {
      const stateCities = STATE_CITY_MAPPING[state];

      if (!stateCities) {
        return res.status(400).json({
          success: false,
          message: `Invalid state: "${state}"`
        });
      }

      const normalizedCity = city.toLowerCase().trim();

      if (!stateCities.includes(normalizedCity)) {
        return res.status(400).json({
          success: false,
          message: `City "${city}" is not valid for state "${state}"`
        });
      }
    }

    // Photo handling
    const oldPhotos = venue?.photos || [];
    let mergedPhotos = oldPhotos;

    if (rules.photos > 0 && req.files?.length > 0) {
      const newPhotos = req.files.map((file) => ({
        url: file.path,
        filename: file.filename,
      }));

      mergedPhotos = [...oldPhotos, ...newPhotos].slice(0, rules.photos);
    }

    // All fields (always enabled based on config)
    const venueData = {
      venueName: req.body.venueName,
      state: state || venue?.state || "Alabama",
      city: (city || venue?.city || "mobile").toLowerCase(),
      address: req.body.address ?? venue?.address ?? "",
      seatingCapacity: req.body.seatingCapacity
        ? parseInt(req.body.seatingCapacity)
        : (venue?.seatingCapacity || 0),
      biography: req.body.biography ?? venue?.biography ?? "",
      openHours: req.body.openHours ?? venue?.openHours ?? "",
      openDays: req.body.openDays ?? venue?.openDays ?? "",
      phone: req.body.phone || venue?.phone || "",
      website: req.body.website || venue?.website || "",
      photos: mergedPhotos,
      photosLimit: rules.photos,
      showLimit: rules.shows,
      featuresLocked: false,
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
        colorCode: null,
      });
    }

    res.status(200).json({
      success: true,
      message: `Venue profile saved successfully`,
      data: { venue },
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
  const { state, city } = req.query;

  if (!state || !city) {
    return next(new ErrorResponse("State and City are required", 400));
  }

  // Validate state-city combination
  const validCity = await StateCity.findOne({
    state: state,
    city: city.toLowerCase(),
    isActive: true
  });

  if (!validCity) {
    return next(new ErrorResponse("Invalid city for the selected state", 400));
  }

  const venues = await Venue.find({
    state: state,
    city: city.toLowerCase(),
    isActive: true
  })
    .select("venueName state city colorCode shows");

  res.status(200).json({
    success: true,
    data: {
      venues,
      state,
      city,
      cityDisplayName: validCity.displayName
    },
  });
});

export const addShow = asyncHandler(async (req, res, next) => {
  const user = req.user;

  // Get rules based on config
  const rules = getPlanRules("venue", user.subscriptionPlan);

  const venue = await Venue.findOne({ user: user.id });

  if (!venue) {
    throw new ErrorResponse("Venue profile not found", 404);
  }

  // MONTHLY SHOW LIMIT CHECK (based on config)
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const endOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59));

  const showsThisMonth = await Event.countDocuments({
    venue: venue._id,
    dateOnly: { $gte: startOfMonth, $lte: endOfMonth },
    isActive: true,
  });

  // Dynamic limit from config
  const showLimit = rules.shows;

  if (showsThisMonth >= showLimit) {
    const message = showLimit === 999
      ? "Unexpected error occurred"
      : `Monthly show limit reached (max ${showLimit} shows).`;

    return next(new ErrorResponse(message, 403));
  }

  // Rest of the function remains same...
  // Upload show image
  const imageData = req.file
    ? { url: req.file.path, filename: req.file.filename }
    : null;

  const parsedDate = parseEventDate(req.body.date, req.body.time);

  const event = await Event.create({
    artistBandName: req.body.artist,
    eventTime: req.body.time,
    date: parsedDate.fullDate,
    dateOnly: parsedDate.dateOnly,
    description: req.body.description || "",
    image: imageData,
    venue: venue._id,
    state: venue.state,
    city: venue.city,
    color: venue.colorCode || "#000000",
  });

  venue.shows.push({
    artist: req.body.artist,
    date: parsedDate.fullDate,
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
  const { state, city } = req.query;
  const query = { isActive: true };

  if (state) {
    query.state = state;
  }

  if (city && city !== "all") {
    query.city = city.toLowerCase();
  } 
  else if (state) {
    const stateCities = STATE_CITY_MAPPING[state] || [];
    query.city = { $in: stateCities };
  }

  const venues = await Venue.find(query)
    .populate("user", "username email subscriptionPlan")
    .sort({ venueName: 1 });

  const rules = SUBSCRIPTION_RULES.venue.free;
  const safeVenues = venues.map((v) =>
    sanitizeVenueForPlan(v, rules)
  );

  res.status(200).json({
    success: true,
    data: {
      venues: safeVenues,
      filters: {
        currentState: state || "all",
        currentCity: city || "all",
        availableStates: Object.keys(STATE_CITY_MAPPING),
      },
    },
  });
});


export const getVenue = asyncHandler(async (req, res, next) => {
  const venue = await Venue.findById(req.params.id)
    .populate("user", "username email subscriptionPlan");

  if (!venue) throw new ErrorResponse("Venue not found", 404);

  const rules = SUBSCRIPTION_RULES.venue.free;
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

  const rules = SUBSCRIPTION_RULES.venue.free;
  const safeVenue = sanitizeVenueForPlan(venue, rules);

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

  const rules = SUBSCRIPTION_RULES.venue.free;

  let venue = await Venue.findOne({ user: user.id });
  if (!venue) return next(new ErrorResponse("Venue profile not found", 404));

  // NEW: State-City validation
  const { state, city } = req.body;

  if (state || city) {
    const checkState = state || venue.state;
    const checkCity = city ? city.toLowerCase() : venue.city;

    const validCity = await StateCity.findOne({
      state: checkState,
      city: checkCity,
      isActive: true
    });

    if (!validCity) {
      return next(new ErrorResponse(
        `City "${checkCity}" is not valid for state "${checkState}"`,
        400
      ));
    }
  }

  const existingPhotos = venue.photos || [];
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
  }

  const {
    venueName,
    address,
    seatingCapacity,
    biography,
    openHours,
    openDays,
    phone,
    website,
  } = req.body;

  const updateData = {
    venueName: venueName || venue.venueName,
    // NEW: Update state and city
    state: state || venue.state,
    city: city ? city.toLowerCase() : venue.city,
    address: address || venue.address,
    seatingCapacity: seatingCapacity ? Number.parseInt(seatingCapacity || "0") : venue.seatingCapacity,
    biography: biography || venue.biography,
    openHours: openHours || venue.openHours,
    openDays: openDays || venue.openDays,
    // NEW: Phone and website
    phone: phone !== undefined ? phone : venue.phone,
    website: website !== undefined ? website : venue.website,
    photos: mergedPhotos,
    photosLimit: rules.photos,
    showLimit: rules.shows,
    featuresLocked: false,
    updatedAt: Date.now(),
  };

  venue = await Venue.findOneAndUpdate({ user: user.id }, updateData, {
    new: true,
    runValidators: true,
  });

  const safeVenue = sanitizeVenueForPlan(venue, rules);

  return res.status(200).json({
    success: true,
    message: `Venue profile updated successfully`,
    data: { venue: safeVenue },
  });
});

// GET Venues for Admin (with pagination and filters)
export const getVenuesForAdmin = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10, search = "", status = "all", city = "" } = req.query;

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
    state,
    address,
    seatingCapacity,
    biography,
    openHours,
    openDays,
    phone,
    website,
    isActive,
    colorCode,
    verifiedOrder,
  } = req.body;


  let venue = await Venue.findById(id).populate("user");

  if (!venue) {
    return next(new ErrorResponse("Venue not found", 404));
  }

  // Track changes for audit log
  const changes = [];
  const oldValues = {
    city: venue.city,
    isActive: venue.isActive,
    verifiedOrder: venue.verifiedOrder,
    colorCode: venue.colorCode,
  };

  if (colorCode !== undefined) {
    
    const isValidColor = /^#[0-9A-F]{6}$/i.test(colorCode);
    if (!isValidColor) {
      return next(new ErrorResponse(`Invalid color format: ${colorCode}. Must be hex color like #FF0000`, 400));
    }
    
    venue.colorCode = colorCode;
    changes.push(`Color updated from ${oldValues.colorCode || 'none'} to ${colorCode}`);
  }

  // CITY CHANGE HANDLING - If city changes, assign new color from that city's palette
  if (city && city.toLowerCase() !== venue.city) {
    const newCity = city.toLowerCase();
    changes.push(`City changed from ${formatCityName(venue.city)} to ${formatCityName(newCity)}`);

    try {
      if (colorCode) {
        const isValidColor = ColorAssigner.isValidColorForCity(colorCode, newCity);
        
        if (!isValidColor) {
          return next(
            new ErrorResponse(
              `Color ${colorCode} is not valid for ${formatCityName(newCity)}. ` +
              `Please choose from the city's color palette.`,
              400
            )
          );
        }
        
        const isAvailable = await ColorAssigner.isColorAvailable(colorCode, newCity, id, venue.state);
        
        if (!isAvailable) {
          const existingVenue = await Venue.findOne({
            city: newCity,
            colorCode: colorCode,
            _id: { $ne: id }
          });
          
          return next(
            new ErrorResponse(
              `Color ${colorCode} is already taken by "${existingVenue?.venueName || 'another venue'}" ` +
              `in ${formatCityName(newCity)}. Choose a different color.`,
              400
            )
          );
        }
        
        venue.colorCode = colorCode;
        changes.push(`Color manually set to ${colorCode} for new city`);
      } else {
        const newColor = await ColorAssigner.getNextAvailableColor(newCity, venue.state);
        venue.colorCode = newColor;
        changes.push(`Auto-assigned color ${newColor} for new city`);
      }
    } catch (error) {
      console.error("Error assigning new city color:", error);
      return next(new ErrorResponse("Failed to assign color: " + error.message, 500));
    }

    venue.city = newCity;
  }

  if (state && state !== venue.state) {
    venue.state = state;
    changes.push(`State changed from ${oldValues.state || 'none'} to ${state}`);
  }

  // VERIFICATION HANDLING - Auto color assign when verifying FIRST time
  if (isActive === true && venue.verifiedOrder === 0 && !venue.colorCode) {
    try {
      const assignedColor = await ColorAssigner.getNextAvailableColor(venue.city, venue.state);

      // Get verified count for this city
      const verifiedCount = await Venue.countDocuments({
        city: venue.city,
        state: venue.state,
        verifiedOrder: { $gt: 0 },
      });

      venue.verifiedOrder = verifiedCount + 1;
      venue.colorCode = assignedColor;

      changes.push(`Venue verified (order: ${venue.verifiedOrder}) with color: ${assignedColor}`);
    } catch (error) {
      console.error("Error in verification color assignment:", error);
      // Fallback to sequential color
      const verifiedCount = await Venue.countDocuments({
        city: venue.city,
        state: venue.state,
        verifiedOrder: { $gt: 0 },
      });
      venue.verifiedOrder = verifiedCount + 1;
      
      // Use fallback color
      const cityColors = ColorAssigner.getCityColors(venue.city);
      const colorIndex = (venue.verifiedOrder - 1) % cityColors.length;
      venue.colorCode = cityColors[colorIndex];
      changes.push(`Fallback color assigned: ${venue.colorCode}`);
    }
  }

  // MANUAL VERIFICATION ORDER - Admin wants to set specific order
  if (verifiedOrder !== undefined && verifiedOrder !== venue.verifiedOrder) {
    if (verifiedOrder < 0) {
      return next(new ErrorResponse("Verification order must be 0 or positive", 400));
    }

    // If setting verifiedOrder > 0, ensure venue is active
    if (verifiedOrder > 0) {
      venue.isActive = true;

      // If no color assigned yet, get one
      if (!venue.colorCode) {
        try {
          const assignedColor = await ColorAssigner.getNextAvailableColor(venue.city, venue.state);
          venue.colorCode = assignedColor;
          changes.push(`Auto-assigned color ${assignedColor} for verification`);
        } catch (error) {
          console.error("Error assigning color for manual verification:", error);
        }
      }
    }

    venue.verifiedOrder = parseInt(verifiedOrder);
    changes.push(`Verification order set to ${venue.verifiedOrder}`);
  }

  // DEACTIVATION HANDLING
  if (isActive !== undefined) {
    venue.isActive = isActive;
    changes.push(`Venue ${isActive ? 'activated' : 'deactivated'}`);
  }

  // BASIC FIELD UPDATES
  if (venueName) venue.venueName = venueName;
  if (address !== undefined) venue.address = address;
  if (seatingCapacity !== undefined) venue.seatingCapacity = parseInt(seatingCapacity) || 0;
  if (biography !== undefined) venue.biography = biography;
  if (openHours !== undefined) venue.openHours = openHours;
  if (openDays !== undefined) venue.openDays = openDays;
  if (phone !== undefined) venue.phone = phone;
  if (website !== undefined) venue.website = website;

  venue.updatedAt = Date.now();


  // SAVE VENUE
  await venue.save();

  // UPDATE ALL EVENTS WITH NEW COLOR (if color changed)
  if (oldValues.colorCode !== venue.colorCode && venue.colorCode) {
    try {
      const updateResult = await Event.updateMany(
        { venue: venue._id },
        { $set: { color: venue.colorCode } }
      );
      changes.push(`Updated ${updateResult.modifiedCount} events with new color`);
    } catch (error) {
      console.error("Error updating event colors:", error);
      changes.push("Warning: Failed to update event colors");
    }
  }

  // REFRESH POPULATED DATA
  const updatedVenue = await Venue.findById(id)
    .populate("user", "username email subscriptionPlan")
    .lean();

  // ADDITIONAL DATA FOR RESPONSE
  const colorInfo = {
    oldColor: oldValues.colorCode,
    newColor: venue.colorCode,
    city: venue.city,
    verificationOrder: venue.verifiedOrder,
    isColorChanged: oldValues.colorCode !== venue.colorCode,
  };

  res.status(200).json({
    success: true,
    message: "Venue updated successfully",
    data: {
      venue: updatedVenue,
      colorInfo,
      changes,
    },
  });
});

// VERIFY Venue by Admin (with color assignment)
export const verifyVenueByAdmin = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const venue = await Venue.findById(id).populate("user");
  if (!venue) {
    return next(new ErrorResponse("Venue not found", 404));
  }

  if (venue.verifiedOrder > 0) {
    return next(new ErrorResponse("Venue is already verified", 400));
  }

  try {
    const assignedColor = await ColorAssigner.getNextAvailableColor(venue.city);

    // Update venue
    const verifiedCount = await Venue.countDocuments({
      city: venue.city,
      verifiedOrder: { $gt: 0 },
    });

    venue.verifiedOrder = verifiedCount + 1;
    venue.isActive = true;
    venue.colorCode = assignedColor;

    await venue.save();

    res.status(200).json({
      success: true,
      message: "Venue verified successfully",
      data: { venue },
    });

  } catch (error) {
    next(new ErrorResponse("Failed to assign color: " + error.message, 500));
  }
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


// Check subscription status (helper function)
export const checkSubscriptionStatus = (req, res, next) => {
  try {
    const user = req.user;
    
    const status = {
      systemWide: {
        subscriptionsEnabled: isSubscriptionEnabled(),
        forceFree: SUBSCRIPTION_CONFIG.SYSTEM_WIDE.FORCE_FREE_FOR_ALL,
        defaultPlan: SUBSCRIPTION_CONFIG.SYSTEM_WIDE.DEFAULT_PLAN,
      },
      user: {
        currentPlan: user?.subscriptionPlan || "free",
        effectivePlan: SUBSCRIPTION_CONFIG.SYSTEM_WIDE.FORCE_FREE_FOR_ALL ? "free" : (user?.subscriptionPlan || "free"),
        rules: getPlanRules(user?.userType || "venue", user?.subscriptionPlan || "free"),
      },
      features: {
        marketplace: SUBSCRIPTION_CONFIG.FEATURES.ENABLE_MARKETPLACE,
        payments: SUBSCRIPTION_CONFIG.FEATURES.ENABLE_PAYMENTS,
        analytics: SUBSCRIPTION_CONFIG.FEATURES.ENABLE_ANALYTICS,
        maxPhotos: SUBSCRIPTION_CONFIG.FEATURES.MAX_PHOTOS,
        maxShows: SUBSCRIPTION_CONFIG.FEATURES.MAX_SHOWS_PER_MONTH,
      },
      ui: SUBSCRIPTION_CONFIG.UI,
    };
    
    // Attach to request for use in other middleware
    req.subscriptionStatus = status;
    
    if (next) {
      next();
    } else {
      return status;
    }
  } catch (error) {
    console.error("Subscription status check error:", error);
    if (next) {
      next();
    }
  }
};


export const getVenuesByState = asyncHandler(async (req, res, next) => {
  const { state } = req.query;

  if (!state) {
    return next(new ErrorResponse("State parameter is required", 400));
  }

  // Validate state
  if (!STATE_CITY_MAPPING[state]) {
    return next(new ErrorResponse(`Invalid state: "${state}"`, 400));
  }

  // Get venues in this state
  const venues = await Venue.find({
    state: state,
    isActive: true
  })
    .select("venueName state city address seatingCapacity photos biography openHours openDays phone website isActive verifiedOrder colorCode")
    .populate("user", "username email subscriptionPlan")
    .sort({ verifiedOrder: 1, venueName: 1 });

  // Group by city
  const venuesByCity = {};
  venues.forEach(venue => {
    const city = venue.city;
    if (!venuesByCity[city]) {
      venuesByCity[city] = [];
    }
    venuesByCity[city].push(venue);
  });

  // Get cities for this state from mapping
  const cities = STATE_CITY_MAPPING[state] || [];

  res.status(200).json({
    success: true,
    data: {
      state,
      totalVenues: venues.length,
      cities: cities.map(city => ({
        name: city,
        displayName: formatCityName(city),
        venueCount: venuesByCity[city]?.length || 0,
        venues: venuesByCity[city] || []
      }))
    }
  });
});


export const getVenuesStatesSummary = asyncHandler(async (req, res, next) => {
  try {
    // Aggregate venue counts by state
    const stateSummary = await Venue.aggregate([
      {
        $match: {
          isActive: true
        }
      },
      {
        $group: {
          _id: "$state",
          totalVenues: { $sum: 1 },
          cities: { $addToSet: "$city" },
          verifiedVenues: {
            $sum: { $cond: [{ $gt: ["$verifiedOrder", 0] }, 1, 0] }
          }
        }
      },
      {
        $sort: { totalVenues: -1 }
      }
    ]);

    // Format the response
    const formattedSummary = stateSummary.map(state => {
      const stateName = state._id;
      const availableCities = STATE_CITY_MAPPING[stateName] || [];
      
      return {
        state: stateName,
        totalVenues: state.totalVenues,
        verifiedVenues: state.verifiedVenues,
        availableCities: availableCities.map(city => ({
          name: city,
          displayName: formatCityName(city),
          venueCount: state.cities.filter(c => c === city).length
        })),
        hasVenues: state.totalVenues > 0
      };
    });

    // Filter only states that exist in STATE_CITY_MAPPING
    const validStates = formattedSummary.filter(state => 
      STATE_CITY_MAPPING[state.state]
    );

    // Add states with no venues but in mapping
    const allStates = Object.keys(STATE_CITY_MAPPING);
    const existingStates = validStates.map(state => state.state);
    
    const statesWithNoVenues = allStates
      .filter(state => !existingStates.includes(state))
      .map(state => ({
        state: state,
        totalVenues: 0,
        verifiedVenues: 0,
        availableCities: STATE_CITY_MAPPING[state].map(city => ({
          name: city,
          displayName: formatCityName(city),
          venueCount: 0
        })),
        hasVenues: false
      }));

    const completeSummary = [...validStates, ...statesWithNoVenues]
      .sort((a, b) => {
        // Sort by total venues (descending), then by state name
        if (b.totalVenues !== a.totalVenues) {
          return b.totalVenues - a.totalVenues;
        }
        return a.state.localeCompare(b.state);
      });

    res.status(200).json({
      success: true,
      data: {
        summary: completeSummary,
        totalStates: completeSummary.length,
        totalVenues: completeSummary.reduce((sum, state) => sum + state.totalVenues, 0),
        totalVerifiedVenues: completeSummary.reduce((sum, state) => sum + state.verifiedVenues, 0)
      }
    });
  } catch (error) {
    next(error);
  }
});


// Subscription status endpoint
export const getSubscriptionStatus = asyncHandler(async (req, res, next) => {
  const status = checkSubscriptionStatus(req, res);
  
  res.status(200).json({
    success: true,
    data: status
  });
});


export const getAvailableColorsForCity = asyncHandler(async (req, res, next) => {
  try {
    const { city, state, excludeVenueId } = req.query;
    
    if (!city) {
      return next(new ErrorResponse("City parameter is required", 400));
    }
    
    // ভ্যালিডেট সিটি
    const normalizedCity = city.toLowerCase();
    let isValidCity = false;
    let cityState = state;
    
    // যদি state দেওয়া থাকে, তাহলে সেই state-এ city আছে কিনা চেক করুন
    if (state) {
      isValidCity = ColorAssigner.isValidCityForState(state, normalizedCity);
    } else {
      // state না থাকলে সব state-এ খুঁজুন
      const states = ColorAssigner.getStates();
      for (const s of states) {
        if (ColorAssigner.isValidCityForState(s, normalizedCity)) {
          isValidCity = true;
          cityState = s;
          break;
        }
      }
    }
    
    if (!isValidCity) {
      return next(new ErrorResponse(`Invalid city: ${city}`, 400));
    }
    
    // কালার ইনফরমেশন পাওয়া
    const colorInfo = await ColorAssigner.getAvailableColorsForCity(
      normalizedCity, 
      excludeVenueId || null,
      cityState
    );
    
    // কনট্রাস্ট কালার বের করার ফাংশন
    const getContrastColor = (hexColor) => {
      if (!hexColor || hexColor.length < 7) return "#000000";
      
      const r = parseInt(hexColor.substring(1, 3), 16);
      const g = parseInt(hexColor.substring(3, 5), 16);
      const b = parseInt(hexColor.substring(5, 7), 16);
      
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5 ? "#000000" : "#FFFFFF";
    };
    
    // প্রতিটি কালারের জন্য অতিরিক্ত তথ্য
    const colorsWithDetails = colorInfo.allColors.map(color => {
      const isUsed = colorInfo.usedColors.includes(color);
      const isAvailable = colorInfo.availableColors.includes(color);
      const usedByVenue = colorInfo.colorUsage[color] || null;
      
      return {
        color,
        isUsed,
        isAvailable,
        usedByVenue,
        textColor: getContrastColor(color)
      };
    });
    
    res.status(200).json({
      success: true,
      data: {
        city: normalizedCity,
        state: cityState,
        totalColors: colorInfo.totalColors,
        usedColors: colorInfo.usedCount,
        availableColors: colorInfo.availableCount,
        colors: colorsWithDetails,
        // গ্রুপ ভিত্তিক কালার
        grouped: {
          available: colorsWithDetails.filter(c => c.isAvailable),
          used: colorsWithDetails.filter(c => c.isUsed)
        }
      }
    });
    
  } catch (error) {
    console.error("Error in getAvailableColorsForCity:", error);
    next(new ErrorResponse("Failed to fetch colors: " + error.message, 500));
  }
});



//
// Now Just FREE plan 
/*
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
*/