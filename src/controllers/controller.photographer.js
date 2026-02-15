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

  // Validate state
  const validStates = ["louisiana", "mississippi", "alabama", "florida"];
  const normalizedState = state.toLowerCase();
  if (!validStates.includes(normalizedState)) {
    return next(new ErrorResponse(
      "State must be one of: Louisiana, Mississippi, Alabama, Florida",
      400
    ));
  }

  // Validate city based on state (PDF requirement)
  const stateCityMapping = {
    louisiana: ["new orleans"],
    mississippi: ["biloxi"],
    alabama: ["mobile"],
    florida: ["pensacola"]
  };

  const normalizedCity = city.toLowerCase();
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
    featuresLocked: false, // All features unlocked per PDF
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

  const { name, state, city, biography } = req.body;

  let photographer = await Photographer.findOne({ user: user.id });
  if (!photographer) return next(new ErrorResponse("Photographer profile not found", 404));

  // Update name
  if (name !== undefined) photographer.name = name;

  // Update state if provided
  if (state !== undefined) {
    const validStates = ["louisiana", "mississippi", "alabama", "florida"];
    if (!validStates.includes(state.toLowerCase())) {
      return next(new ErrorResponse(
        "State must be one of: Louisiana, Mississippi, Alabama, Florida",
        400
      ));
    }
    photographer.state = state.toLowerCase();
  }

  // Update city if provided
  if (city !== undefined) {
    const validCities = ["new orleans", "biloxi", "mobile", "pensacola"];
    if (!validCities.includes(city.toLowerCase())) {
      return next(new ErrorResponse(
        "City must be one of: New Orleans, Biloxi, Mobile, Pensacola",
        400
      ));
    }
    photographer.city = city.toLowerCase();
  }

  // Biography always allowed (PDF: All features for free)
  if (biography !== undefined) {
    photographer.biography = biography;
  }

  // Sync meta (PDF: All features for free accounts)
  photographer.photosLimit = rules.photos;
  photographer.videosLimit = rules.videos;
  photographer.featuresLocked = false; // All features unlocked per PDF

  await photographer.save();

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

  // PDF: All features for free accounts
  // So services are always allowed
  if (!rules.services) {
    // Even if rules don't have services, allow it per PDF
    console.log("Services feature check bypassed per PDF requirement");
  }

  const { service, price, description, duration, category, contact } = req.body;
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
    price,
    description: description || "",
    duration: duration || "",
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

  // PDF: All features for free accounts
  // So services are always allowed
  if (!rules.services) {
    // Allow anyway per PDF
    console.log("Services update allowed per PDF requirement");
  }

  const { serviceId } = req.params;
  const { service, price, description, duration, category, contact } = req.body;

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
  if (price !== undefined) serviceToUpdate.price = price;
  if (description !== undefined) serviceToUpdate.description = description;
  if (duration !== undefined) serviceToUpdate.duration = duration;
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
    state, // PDF: Louisiana, Mississippi, Alabama, Florida
    city,
    page = 1,
    limit = 10
  } = req.query;

  let query = { isActive: true, isVerified: true };

  // STATE FILTERING (PDF REQUIREMENT)
  if (state) {
    const validStates = ["louisiana", "mississippi", "alabama", "florida"];
    const normalizedState = state.toLowerCase().trim();

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

  // Create state dropdown data
  const stateDropdown = [
    { value: "louisiana", label: "Louisiana", count: stateCounts.find(s => s._id === "louisiana")?.count || 0 },
    { value: "mississippi", label: "Mississippi", count: stateCounts.find(s => s._id === "mississippi")?.count || 0 },
    { value: "alabama", label: "Alabama", count: stateCounts.find(s => s._id === "alabama")?.count || 0 },
    { value: "florida", label: "Florida", count: stateCounts.find(s => s._id === "florida")?.count || 0 }
  ];

  res.status(200).json({
    success: true,
    message: "Photographers fetched successfully",
    data: {
      photographers,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
      // PDF: State-based dropdown data
      filters: {
        states: stateDropdown,
        cities: ["New Orleans", "Biloxi", "Mobile", "Pensacola"]
      }
    },
  });
});

/* ========================================================
   GET PHOTOGRAPHERS BY STATE (FOR DROPDOWN)
======================================================== */
export const getPhotographersByState = asyncHandler(async (req, res, next) => {
  const { state } = req.params;

  const validStates = ["louisiana", "mississippi", "alabama", "florida"];
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

  // Format for dropdown
  const allStates = ["louisiana", "mississippi", "alabama", "florida"];
  const formattedStats = allStates.map(state => {
    const stat = stateStats.find(s => s.state === state);
    return {
      state,
      label: state.charAt(0).toUpperCase() + state.slice(1),
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
