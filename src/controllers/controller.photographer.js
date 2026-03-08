import mongoose from "mongoose";
import Photographer from "../models/model.photographer.js";
import User from "../models/model.user.js"; //
import { asyncHandler } from "../utils/asyncHandler.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import { cloudinary } from "../config/cloudinary.js";
import { SUBSCRIPTION_RULES } from "../config/subscriptionRules.js";
import { sanitizePhotographerForPlan } from "../utils/sanitizePhotographer.js";




/* ========================================================
   CREATE PHOTOGRAPHER PROFILE
======================================================== */
export const createPhotographerProfile = asyncHandler(async (req, res, next) => {
  const user = req.user;

  // Check if profile already exists
  const existingProfile = await Photographer.findOne({ user: user.id });
  if (existingProfile) {
    return next(new ErrorResponse("Photographer profile already exists", 400));
  }

  const { name, state, city, biography } = req.body;

  // Validation
  if (!name || name.trim().length < 2) {
    return next(new ErrorResponse("Name is required and must be at least 2 characters", 400));
  }

  if (!state) {
    return next(new ErrorResponse("State is required", 400));
  }

  if (!city) {
    return next(new ErrorResponse("City is required", 400));
  }

  // Validate state (now using acronyms)
  const validStates = ["LA", "MS", "AL", "FL"];
  const normalizedState = state.toUpperCase().trim();
  if (!validStates.includes(normalizedState)) {
    return next(new ErrorResponse(
      "State must be one of: LA, MS, AL, FL",
      400
    ));
  }

  // Validate city based on state
  const stateCityMapping = {
    LA: ["new orleans"],
    MS: ["biloxi", "gulfport"],
    AL: ["mobile"],
    FL: ["pensacola"]
  };
  const normalizedCity = city.toLowerCase().trim();
  const validCities = stateCityMapping[normalizedState];

  if (!validCities.includes(normalizedCity)) {
    return next(new ErrorResponse(
      `City "${city}" is not valid for state "${state}". ` +
      `Valid city for ${state}: ${validCities.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(", ")}`,
      400
    ));
  }

  const rules =
    SUBSCRIPTION_RULES.photographer[user.subscriptionPlan] ||
    SUBSCRIPTION_RULES.photographer.free;

  // Create photographer profile
  const photographer = await Photographer.create({
    user: user.id,
    name: name.trim(),
    state: normalizedState,
    city: normalizedCity,
    biography: biography || "",
    photosLimit: rules.photos,
    videosLimit: rules.videos,
    featuresLocked: false,
    isActive: true,
    isVerified: false
  });

  const safePhotographer = sanitizePhotographerForPlan(photographer, rules);

  res.status(201).json({
    success: true,
    message: "Photographer profile created successfully",
    data: {
      photographer: safePhotographer,
    },
  });
});

export const getPhotographerProfile = asyncHandler(async (req, res, next) => {
  const user = req.user;

  const photographer = await Photographer.findOne({ user: user.id })
    .populate(
      "user",
      "username email userType isVerified subscriptionPlan subscriptionStatus"
    );

  if (!photographer) {
    return next(new ErrorResponse("Photographer profile not found", 404));
  }

  const rules =
    SUBSCRIPTION_RULES.photographer[user.subscriptionPlan] ||
    SUBSCRIPTION_RULES.photographer.free;

  const safePhotographer = sanitizePhotographerForPlan(
    photographer,
    rules
  );

  res.status(200).json({
    success: true,
    message: "Photographer profile fetched successfully",
    data: {
      photographer: safePhotographer,
    },
  });
});

/* ========================================================
   UPDATE PHOTOGRAPHER PROFILE
======================================================== */
export const updatePhotographerProfile = asyncHandler(async (req, res, next) => {
  const user = req.user;
  const rules =
    SUBSCRIPTION_RULES.photographer[user.subscriptionPlan] ||
    SUBSCRIPTION_RULES.photographer.free;

  const { name, biography } = req.body;

  let photographer = await Photographer.findOne({ user: user.id });
  if (!photographer) return next(new ErrorResponse("Photographer profile not found", 404));

  // Update name only
  if (name !== undefined) {
    if (name.trim().length < 2) {
      return next(new ErrorResponse("Name must be at least 2 characters", 400));
    }
    photographer.name = name.trim();
  }

  if (req.body.state !== undefined && req.body.state !== photographer.state) {
    console.log("State update ignored - immutable after creation");
    // Do nothing - state cannot be changed
  }

  if (req.body.city !== undefined && req.body.city !== photographer.city) {
    console.log("City update ignored - immutable after creation");
    // Do nothing - city cannot be changed
  }

  // Biography always allowed
  if (biography !== undefined) {
    photographer.biography = biography;
  }

  // Sync limits
  photographer.photosLimit = rules.photos;
  photographer.videosLimit = rules.videos;
  photographer.featuresLocked = false;

  // FIX: Ensure state is valid before saving
  const validStates = ["LA", "MS", "AL", "FL"];

  // Fix state if it's invalid
  if (photographer.state && !validStates.includes(photographer.state)) {
    const stateMapping = {
      "louisiana": "LA",
      "mississippi": "MS",
      "alabama": "AL",
      "florida": "FL"
    };

    const lowerState = photographer.state.toLowerCase();
    if (stateMapping[lowerState]) {
      photographer.state = stateMapping[lowerState];
      console.log(`Fixed state from ${lowerState} to ${photographer.state}`);
    } else {
      // If state is completely invalid, set a default
      photographer.state = "LA";
      console.log(`Invalid state reset to LA`);
    }
  }

  // Fix locationTags
  if (photographer.locationTags && photographer.locationTags.length > 0) {
    const stateMapping = {
      "louisiana": "LA",
      "mississippi": "MS",
      "alabama": "AL",
      "florida": "FL"
    };

    photographer.locationTags = photographer.locationTags.map(tag => {
      if (tag && tag.toLowerCase() in stateMapping) {
        return stateMapping[tag.toLowerCase()];
      }
      return tag;
    });
  } else if (photographer.state) {
    // Ensure locationTags has at least the state
    photographer.locationTags = [photographer.state];
  }

  try {
    await photographer.save();
  } catch (error) {
    console.error("Save error details:", error);

    if (error.name === 'ValidationError') {
      photographer = await Photographer.findOne({ user: user.id });

      if (name !== undefined) photographer.name = name.trim();
      if (biography !== undefined) photographer.biography = biography;

      try {
        await photographer.save();
      } catch (innerError) {
        console.error("Inner save error:", innerError);
        return next(new ErrorResponse("Profile validation failed. Please contact support.", 400));
      }
    } else {
      throw error;
    }
  }

  const safe = sanitizePhotographerForPlan(photographer, rules);

  res.status(200).json({
    success: true,
    message: "Photographer profile updated successfully",
    data: { photographer: safe },
  });
});

/* ========================================================
   ADD SERVICE
======================================================== */
export const addService = asyncHandler(async (req, res, next) => {
  const user = req.user;
  const rules =
    SUBSCRIPTION_RULES.photographer[user.subscriptionPlan] ||
    SUBSCRIPTION_RULES.photographer.free;

  let { service, price, description, category, contact } = req.body;

  // Trim service
  service = service?.trim();

  // Remove $ and spaces from price
  price = price?.toString().replace("$", "").trim();

  // Validate numeric price
  if (isNaN(price) || Number(price) <= 0) {
    return next(new ErrorResponse("Price must be a valid positive number", 400));
  }


  if (!service || !price) {
    return next(new ErrorResponse("Service and price are required", 400));
  }

  const photographer = await Photographer.findOne({ user: user.id });
  if (!photographer) {
    return next(new ErrorResponse("Photographer profile not found", 404));
  }

  const serviceExists = photographer.services.some(
    (s) => s.service.toLowerCase() === service.toLowerCase()
  );
  if (serviceExists) {
    return next(new ErrorResponse("Service already exists", 400));
  }

  photographer.services.push({
    service,
    price: Number(price),
    description: description || "",
    // duration removed
    category: category || "photography",
    contact: {
      email: contact?.email || photographer.user.email,
      phone: contact?.phone || "",
      preferredContact: contact?.preferredContact || "email",
      showPhonePublicly: contact?.showPhonePublicly || false,
    },
  });

  await photographer.save();

  res.status(201).json({
    success: true,
    message: "Service added successfully",
    data: {
      service: photographer.services.at(-1),
    },
  });
});

/* ========================================================
   UPDATE SERVICE
======================================================== */
export const updateService = asyncHandler(async (req, res, next) => {
  const user = req.user;
  const rules =
    SUBSCRIPTION_RULES.photographer[user.subscriptionPlan] ||
    SUBSCRIPTION_RULES.photographer.free;

  if (!rules.services) {
    // Allow anyway per PDF
    console.log("Services update allowed per PDF requirement");
  }

  const { serviceId } = req.params;
  let { service, price, description, category, contact } = req.body;

  if (price !== undefined) {
    price = price.toString().replace("$", "").trim();

    if (isNaN(price) || Number(price) <= 0) {
      return next(new ErrorResponse("Price must be a valid positive number", 400));
    }
  }


  if (!service && !price) {
    return next(
      new ErrorResponse(
        "At least one field (service or price) is required to update",
        400
      )
    );
  }

  const photographer = await Photographer.findOne({ user: user.id });
  if (!photographer) {
    return next(new ErrorResponse("Photographer profile not found", 404));
  }

  const serviceToUpdate = photographer.services.id(serviceId);
  if (!serviceToUpdate) {
    return next(new ErrorResponse("Service not found", 404));
  }

  if (service !== undefined) serviceToUpdate.service = service;
  if (price !== undefined) serviceToUpdate.price = Number(price);
  if (description !== undefined) serviceToUpdate.description = description;
  // if (duration !== undefined) serviceToUpdate.duration = duration;
  if (category !== undefined) serviceToUpdate.category = category;

  if (contact !== undefined) {
    serviceToUpdate.contact = {
      ...serviceToUpdate.contact,
      ...contact,
    };
  }

  await photographer.save();

  res.status(200).json({
    success: true,
    message: "Service updated successfully",
    data: {
      service: serviceToUpdate,
    },
  });

});

/* ========================================================
   DELETE SERVICE
======================================================== */
export const deleteService = asyncHandler(async (req, res, next) => {
  const user = req.user;
  const rules =
    SUBSCRIPTION_RULES.photographer[user.subscriptionPlan] ||
    SUBSCRIPTION_RULES.photographer.free;

  // PDF: All features for free accounts
  if (!rules.services) {
    // Allow anyway per PDF
    console.log("Services delete allowed per PDF requirement");
  }

  const { serviceId } = req.params;

  const photographer = await Photographer.findOne({ user: user.id });
  if (!photographer) {
    return next(new ErrorResponse("Photographer profile not found", 404));
  }

  const serviceToDelete = photographer.services.id(serviceId);
  if (!serviceToDelete) {
    return next(new ErrorResponse("Service not found", 404));
  }

  photographer.services.pull(serviceId);
  await photographer.save();

  res.status(200).json({
    success: true,
    message: "Service deleted successfully",
    data: {
      serviceId,
    },
  });

});

/* ========================================================
   ADD PHOTO
======================================================== */
export const addPhoto = asyncHandler(async (req, res, next) => {
  const user = req.user;
  const rules =
    SUBSCRIPTION_RULES.photographer[user.subscriptionPlan] ||
    SUBSCRIPTION_RULES.photographer.free;

  // PDF: All features for free accounts
  // So photos are always allowed, just check limit
  const photoLimit = rules.photos || 5; // Default 5 if not specified

  if (!req.files || req.files.length === 0) {
    return next(new ErrorResponse("No photos uploaded", 400));
  }

  const photographer = await Photographer.findOne({ user: user.id });
  if (!photographer) {
    return next(new ErrorResponse("Photographer profile not found", 404));
  }

  if (photographer.photos.length + req.files.length > photoLimit) {
    return next(new ErrorResponse(`Maximum ${photoLimit} photos allowed`, 400));
  }

  // const uploadedPhotos = [];

  // for (const file of req.files) {
  //   const result = await new Promise((resolve, reject) => {
  //     cloudinary.uploader
  //       .upload_stream(
  //         { folder: "photographers/photos", resource_type: "image" },
  //         (error, uploadResult) => {
  //           if (error) reject(error);
  //           else resolve(uploadResult);
  //         }
  //       )
  //       .end(file.buffer);
  //   });

  //   uploadedPhotos.push({
  //     url: result.secure_url,
  //     public_id: result.public_id,
  //     caption: "",
  //   });
  // }

  // photographer.photos.push(...uploadedPhotos);
  // await photographer.save();


  // if (!photographer.state || !photographer.city) {
  //   return next(
  //     new ErrorResponse("Photographer location missing", 400)
  //   );
  // }

  // ✅ Use files already uploaded by middleware
  const uploadedPhotos = req.files.map(file => ({
    url: file.path,        // Cloudinary URL
    public_id: file.filename,
    caption: "",
  }));

  photographer.photos.push(...uploadedPhotos);
  await photographer.save();

  res.status(200).json({
    success: true,
    message: "Photos uploaded successfully",
    data: { photos: photographer.photos },
  });
});

/* ========================================================
   DELETE PHOTO - WITH CLOUDINARY CLEANUP
======================================================== */
export const deletePhoto = asyncHandler(async (req, res, next) => {
  const { photoId } = req.params;

  const photographer = await Photographer.findOne({ user: req.user.id });

  if (!photographer) {
    return next(new ErrorResponse("Photographer profile not found", 404));
  }

  const photoToDelete = photographer.photos.id(photoId);
  if (!photoToDelete) {
    return next(new ErrorResponse("Photo not found", 404));
  }

  try {
    // Delete from Cloudinary
    if (photoToDelete.public_id) {
      const result = await cloudinary.uploader.destroy(photoToDelete.public_id, {
        resource_type: "image",
        invalidate: true
      });

      if (result.result !== 'ok') {
        console.warn("Cloudinary deletion may have failed:", result);
      }
    }

    // Remove from database
    photographer.photos.pull(photoId);
    await photographer.save();

    res.status(200).json({
      success: true,
      message: "Photo deleted successfully",
      data: {
        photos: photographer.photos,
      },
    });
  } catch (error) {
    console.error("Delete photo error:", error);
    return next(new ErrorResponse("Failed to delete photo from Cloudinary: " + error.message, 500));
  }
});
/* ========================================================
   ADD VIDEO
======================================================== */
export const addVideo = asyncHandler(async (req, res, next) => {
  const user = req.user;
  const rules =
    SUBSCRIPTION_RULES.photographer[user.subscriptionPlan] ||
    SUBSCRIPTION_RULES.photographer.free;

  // PDF: All features for free accounts
  const videoLimit = rules.videos || 5; // Default 5 if not specified

  const { url, title, description, public_id } = req.body;

  if (!url || !public_id) {
    return next(new ErrorResponse("Video URL and public ID are required", 400));
  }

  const photographer = await Photographer.findOne({ user: user.id });
  if (!photographer) {
    return next(new ErrorResponse("Photographer profile not found", 404));
  }

  if (photographer.videos.length >= videoLimit) {
    return next(
      new ErrorResponse(`Maximum video limit reached (${videoLimit} videos)`, 400)
    );
  }

  photographer.videos.push({
    url,
    title: title || "Untitled Video",
    description: description || "",
    public_id,
  });


  await photographer.save();

  res.status(201).json({
    success: true,
    message: "Video added successfully",
    data: { videos: photographer.videos },
  });
});

/* ========================================================
   UPDATE VIDEO (TITLE / DESCRIPTION)
======================================================== */
export const updateVideo = asyncHandler(async (req, res, next) => {
  const { videoId } = req.params;
  const { title, description } = req.body;

  const photographer = await Photographer.findOne({ user: req.user.id });
  if (!photographer) {
    return next(new ErrorResponse("Photographer profile not found", 404));
  }

  const video = photographer.videos.id(videoId);
  if (!video) {
    return next(new ErrorResponse("Video not found", 404));
  }

  if (title !== undefined) video.title = title;
  if (description !== undefined) video.description = description;

  await photographer.save();

  res.status(200).json({
    success: true,
    message: "Video updated successfully",
    data: { video },
  });
});


/* ========================================================
   DELETE VIDEO FROM CLOUDINARY AND DATABASE
======================================================== */
export const deleteVideo = asyncHandler(async (req, res, next) => {
  const { videoId } = req.params;
  const { public_id } = req.body;

  const photographer = await Photographer.findOne({ user: req.user.id });

  if (!photographer) {
    return next(new ErrorResponse("Photographer profile not found", 404));
  }

  const videoToDelete = photographer.videos.id(videoId);
  if (!videoToDelete) {
    return next(new ErrorResponse("Video not found", 404));
  }

  try {
    // Delete from Cloudinary
    await cloudinary.uploader.destroy(public_id || videoToDelete.public_id, {
      resource_type: "video"
    });

    // Remove from Database
    photographer.videos.pull(videoId);
    await photographer.save();

    res.status(200).json({
      success: true,
      message: "Video deleted successfully",
      data: { videos: photographer.videos },
    });

  } catch (error) {
    console.error("Cloudinary delete error:", error);
    return next(new ErrorResponse("Failed to delete video", 500));
  }
});

/* ========================================================
   GET ALL PHOTOGRAPHERS (PUBLIC)
======================================================== */
export const getAllPhotographers = asyncHandler(async (req, res, next) => {
  const {
    state,
    city,
    page = 1,
    limit = 10
  } = req.query;

  let query = { isActive: true, isVerified: true };

  // STATE FILTERING with acronyms
  if (state) {
    const validStates = ["LA", "MS", "AL", "FL"];
    const normalizedState = state.toUpperCase().trim();

    if (validStates.includes(normalizedState)) {
      query.state = normalizedState;
    }
  }

  // CITY FILTER
  if (city) {
    query.city = city.toLowerCase();
  }

  const photographers = await Photographer.find(query)
    .populate("user", "username email subscriptionPlan")
    .select("-__v")
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const total = await Photographer.countDocuments(query);

  // Get state counts for dropdown
  const stateCounts = await Photographer.aggregate([
    { $match: { isActive: true, isVerified: true } },
    {
      $group: {
        _id: "$state",
        count: { $sum: 1 }
      }
    }
  ]);

  // Create state dropdown data with full names for display
  const stateFullNames = {
    LA: "Louisiana",
    MS: "Mississippi",
    AL: "Alabama",
    FL: "Florida"
  };

  const stateDropdown = [
    { value: "LA", label: "Louisiana", code: "LA", count: stateCounts.find(s => s._id === "LA")?.count || 0 },
    { value: "MS", label: "Mississippi", code: "MS", count: stateCounts.find(s => s._id === "MS")?.count || 0 },
    { value: "AL", label: "Alabama", code: "AL", count: stateCounts.find(s => s._id === "AL")?.count || 0 },
    { value: "FL", label: "Florida", code: "FL", count: stateCounts.find(s => s._id === "FL")?.count || 0 }
  ];

  res.status(200).json({
    success: true,
    message: "Photographers fetched successfully",
    data: {
      photographers,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
      filters: {
        states: stateDropdown,
        cities: ["Mobile", "Biloxi", "Pensacola"] // Note: Mobile appears for both AL and LA
      }
    },
  });
});

/* ========================================================
   GET PHOTOGRAPHERS BY STATE (FOR DROPDOWN)
======================================================== */
export const getPhotographersByState = asyncHandler(async (req, res, next) => {
  const { state } = req.params;

  // const validStates = ["louisiana", "mississippi", "alabama", "florida"];
  const validStates = ["LA", "MS", "AL", "FL"];
  if (!validStates.includes(state.toLowerCase())) {
    return next(new ErrorResponse(
      "Invalid state. Must be: louisiana, mississippi, alabama, or florida",
      400
    ));
  }

  const photographers = await Photographer.find({
    state: state.toLowerCase(),
    isActive: true,
    isVerified: true
  })
    .populate("user", "username email subscriptionPlan")
    .select("name city state biography services photos videos")
    .sort({ createdAt: -1 })
    .limit(50);

  res.status(200).json({
    success: true,
    message: `Photographers in ${state}`,
    data: {
      state: state,
      count: photographers.length,
      photographers
    }
  });
});

/* ========================================================
   GET PHOTOGRAPHER BY ID (PUBLIC)
======================================================== */
export const getPhotographerById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const photographer = await Photographer.findById(id)
    .populate("user", "username email subscriptionPlan")
    .select("-__v");

  if (!photographer) {
    return next(new ErrorResponse("Photographer not found", 404));
  }

  if (!photographer.isActive || !photographer.isVerified) {
    return next(new ErrorResponse("Photographer profile is not available", 404));
  }

  const ownerPlan = photographer.user?.subscriptionPlan || "free";
  const rules =
    SUBSCRIPTION_RULES.photographer[ownerPlan] ||
    SUBSCRIPTION_RULES.photographer.free;

  const safePhotographer = sanitizePhotographerForPlan(
    photographer,
    rules
  );

  res.status(200).json({
    success: true,
    message: "Photographer profile fetched successfully",
    data: {
      photographer: safePhotographer,
    },
  });
});

/* ========================================================
   GET STATE DISTRIBUTION STATS
======================================================== */
export const getStateDistribution = asyncHandler(async (req, res, next) => {
  const stateStats = await Photographer.aggregate([
    { $match: { isActive: true, isVerified: true } },
    {
      $group: {
        _id: "$state",
        total: { $sum: 1 }
      }
    },
    {
      $project: {
        state: "$_id",
        total: 1,
        _id: 0
      }
    },
    { $sort: { total: -1 } }
  ]);

  // Format for dropdown with full names
  const allStates = ["LA", "MS", "AL", "FL"];
  const stateFullNames = {
    LA: "Louisiana",
    MS: "Mississippi",
    AL: "Alabama",
    FL: "Florida"
  };

  const formattedStats = allStates.map(state => {
    const stat = stateStats.find(s => s.state === state);
    return {
      state,
      code: state,
      label: stateFullNames[state],
      total: stat?.total || 0
    };
  });

  res.status(200).json({
    success: true,
    data: {
      stateDistribution: formattedStats,
      totalPhotographers: stateStats.reduce((sum, stat) => sum + stat.total, 0)
    }
  });
});


export const changePhotographerPlanByAdmin = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { subscriptionPlan, notifyUser } = req.body;

  if (!["pro", "free"].includes(subscriptionPlan)) {
    return next(
      new ErrorResponse("Invalid subscription plan. Must be 'pro' or 'free'", 400)
    );
  }

  const photographer = await Photographer.findById(id).populate("user");
  if (!photographer) return next(new ErrorResponse("Photographer not found", 404));
  if (!photographer.user) return next(new ErrorResponse("Photographer owner not found", 404));

  const user = photographer.user;

  if (user.userType !== "photographer") {
    return next(new ErrorResponse("User is not a photographer", 400));
  }

  if (user.subscriptionPlan === subscriptionPlan) {
    return next(
      new ErrorResponse(`Photographer is already on ${subscriptionPlan} plan`, 400)
    );
  }

  if (subscriptionPlan === "pro") {
    const trialDays = SUBSCRIPTION_RULES.photographer.pro.trialDays || 0;

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
    SUBSCRIPTION_RULES.photographer[subscriptionPlan] ||
    SUBSCRIPTION_RULES.photographer.free;

  photographer.photosLimit = rules.photos;
  photographer.videosLimit = rules.videos;

  photographer.featuresLocked = !(
    rules.biography ||
    rules.services ||
    rules.photos > 0 ||
    rules.videos > 0
  );

  if (subscriptionPlan === "pro") photographer.isActive = true;

  photographer.updatedAt = Date.now();
  await photographer.save();

  const updatedPhotographer = await Photographer.findById(id).populate(
    "user",
    "username email subscriptionPlan subscriptionStatus trialEndsAt trialUsed"
  );

  res.status(200).json({
    success: true,
    message:
      subscriptionPlan === "pro"
        ? "Photographer upgraded successfully"
        : "Photographer downgraded successfully",
    data: {
      photographer: updatedPhotographer,
    },
  });
});
/* ========================================================
   GET ALL PHOTOGRAPHERS FOR ADMIN
======================================================== */
export const getPhotographersForAdmin = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    status = "all",
    plan = "all",
    search = ""
  } = req.query;

  let query = {};

  if (status !== "all") {
    query.isActive = status === "active";
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { city: { $regex: search, $options: "i" } },
      { biography: { $regex: search, $options: "i" } }
    ];
  }

  const photographers = await Photographer.find(query)
    .populate({
      path: "user",
      select: "username email subscriptionPlan subscriptionStatus isVerified"
    })
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .skip((page - 1) * limit);

  const total = await Photographer.countDocuments(query);

  /* ======================
     FIXED STATS LOGIC
  ====================== */
  const proUsers = await User.find({ subscriptionPlan: "pro" }).select("_id");
  const freeUsers = await User.find({ subscriptionPlan: "free" }).select("_id");

  const proCount = await Photographer.countDocuments({
    user: { $in: proUsers.map(u => u._id) }
  });

  const freeCount = await Photographer.countDocuments({
    user: { $in: freeUsers.map(u => u._id) }
  });

  const activeCount = await Photographer.countDocuments({ isActive: true });
  const inactiveCount = await Photographer.countDocuments({ isActive: false });

  /* ======================
     PLAN FILTER (POST POPULATE)
  ====================== */
  let filteredPhotographers = photographers;
  if (plan !== "all") {
    filteredPhotographers = photographers.filter(
      p => p.user?.subscriptionPlan === plan
    );
  }

  res.status(200).json({
    success: true,
    data: {
      photographers: filteredPhotographers,
      pagination: {
        current: Number(page),
        pages: Math.ceil(total / limit),
        total
      },
      stats: {
        total,
        pro: proCount,
        free: freeCount,
        active: activeCount,
        inactive: inactiveCount
      }
    }
  });
});

/* ========================================================
   GET SINGLE PHOTOGRAPHER FOR ADMIN
======================================================== */
export const getPhotographerForAdmin = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const photographer = await Photographer.findById(id)
    .populate({
      path: "user",
      select: "username email subscriptionPlan subscriptionStatus isVerified createdAt"
    })
    .populate({
      path: "services"
    });

  if (!photographer) {
    return next(new ErrorResponse("Photographer not found", 404));
  }

  res.status(200).json({
    success: true,
    data: { photographer }
  });
});

/* ========================================================
   TOGGLE PHOTOGRAPHER STATUS
======================================================== */
export const togglePhotographerStatusAdmin = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const photographer = await Photographer.findByIdAndUpdate(
    id,
    { isActive },
    { new: true, runValidators: true }
  ).populate("user");

  if (!photographer) {
    return next(new ErrorResponse("Photographer not found", 404));
  }

  // Also update user status if needed
  if (photographer.user) {
    photographer.user.isActive = isActive;
    await photographer.user.save();
  }

  res.status(200).json({
    success: true,
    message: `Photographer ${isActive ? 'activated' : 'deactivated'} successfully`,
    data: { photographer }
  });
});

/* ========================================================
   DELETE PHOTOGRAPHER (ADMIN)
======================================================== */
export const deletePhotographerAdmin = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const photographer = await Photographer.findById(id);
  if (!photographer) {
    return next(new ErrorResponse("Photographer not found", 404));
  }

  // Delete associated user
  await User.findByIdAndDelete(photographer.user);

  // Delete photos from Cloudinary
  if (photographer.photos?.length) {
    for (const photo of photographer.photos) {
      try {
        await cloudinary.uploader.destroy(photo.public_id);
      } catch (err) {
        console.warn(`Failed to delete photo: ${photo.public_id}`);
      }
    }
  }

  // Delete videos from Cloudinary
  if (photographer.videos?.length) {
    for (const video of photographer.videos) {
      try {
        await cloudinary.uploader.destroy(video.public_id, {
          resource_type: "video"
        });
      } catch (err) {
        console.warn(`Failed to delete video: ${video.public_id}`);
      }
    }
  }

  // Delete photographer
  await Photographer.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: "Photographer deleted successfully"
  });
});
