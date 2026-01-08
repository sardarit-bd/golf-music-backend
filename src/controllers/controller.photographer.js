import mongoose from "mongoose";
import Photographer from "../models/model.photographer.js";
import User from "../models/model.user.js"; //
import { asyncHandler } from "../utils/asyncHandler.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import { cloudinary } from "../config/cloudinary.js";
import { SUBSCRIPTION_RULES } from "../config/subscriptionRules.js";
import { sanitizePhotographerForPlan } from "../utils/sanitizePhotographer.js";




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

  const { name, city, biography } = req.body;

  let photographer = await Photographer.findOne({ user: user.id });
  if (!photographer) return next(new ErrorResponse("Photographer profile not found", 404));

  if (name !== undefined) photographer.name = name;
  if (city !== undefined) photographer.city = city.toLowerCase();

  // biography only if allowed
  if (rules.biography && biography !== undefined) {
    photographer.biography = biography;
  }

  // sync meta
  photographer.photosLimit = rules.photos;
  photographer.videosLimit = rules.videos;
  photographer.featuresLocked = !(
    rules.biography ||
    rules.services ||
    rules.photos > 0 ||
    rules.videos > 0
  );

  await photographer.save();

  const safe = sanitizePhotographerForPlan(photographer, rules);

  res.status(200).json({
    success: true,
    message: `Photographer profile updated successfully (${user.subscriptionPlan.toUpperCase()} Plan)`,
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

  if (!rules.services) {
    return next(new ErrorResponse("Upgrade to Pro to add services", 403));
  }

  const { service, price } = req.body;
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

  photographer.services.push({ service, price });
  await photographer.save();

  res.status(201).json({
    success: true,
    message: "Service added successfully",
    data: { services: photographer.services },
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
    return next(new ErrorResponse("Upgrade to Pro to manage services", 403));
  }

  const { serviceId } = req.params;
  const { service, price } = req.body;

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

  if (service) serviceToUpdate.service = service;
  if (price) serviceToUpdate.price = price;

  await photographer.save();

  res.status(200).json({
    success: true,
    message: "Service updated successfully",
    data: { services: photographer.services },
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

  if (!rules.services) {
    return next(new ErrorResponse("Upgrade to Pro to manage services", 403));
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
    data: { services: photographer.services },
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

  if (rules.photos === 0) {
    return next(new ErrorResponse("Upgrade to Pro to upload photos", 403));
  }

  if (!req.files || req.files.length === 0) {
    return next(new ErrorResponse("No photos uploaded", 400));
  }

  const photographer = await Photographer.findOne({ user: user.id });
  if (!photographer) {
    return next(new ErrorResponse("Photographer profile not found", 404));
  }

  if (photographer.photos.length + req.files.length > rules.photos) {
    return next(new ErrorResponse(`Maximum ${rules.photos} photos allowed`, 400));
  }

  const uploadedPhotos = [];

  for (const file of req.files) {
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: "photographers/photos", resource_type: "image" },
          (error, uploadResult) => {
            if (error) reject(error);
            else resolve(uploadResult);
          }
        )
        .end(file.buffer);
    });

    uploadedPhotos.push({
      url: result.secure_url,
      public_id: result.public_id,
      caption: "", // optional
    });
  }

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
      // console.log("Deleting from Cloudinary:", photoToDelete.public_id);

      const result = await cloudinary.uploader.destroy(photoToDelete.public_id, {
        resource_type: "image",
        invalidate: true
      });

      // console.log("Cloudinary delete result:", result);

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

  if (rules.videos === 0) {
    return next(new ErrorResponse("Upgrade to Pro to add videos", 403));
  }

  const { url, title, public_id } = req.body;
  if (!url || !public_id) {
    return next(new ErrorResponse("Video URL and public ID are required", 400));
  }

  const photographer = await Photographer.findOne({ user: user.id });
  if (!photographer) {
    return next(new ErrorResponse("Photographer profile not found", 404));
  }

  if (photographer.videos.length >= rules.videos) {
    return next(
      new ErrorResponse(`Maximum video limit reached (${rules.videos} videos)`, 400)
    );
  }

  photographer.videos.push({
    url,
    title: title || "Untitled Video",
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
  const { city, page = 1, limit = 10 } = req.query;

  let query = { isActive: true, isVerified: true };

  if (city) {
    query.city = city.toLowerCase();
  }

  const photographers = await Photographer.find(query)
    .populate("user", "username email")
    .select("-__v")
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const total = await Photographer.countDocuments(query);

  res.status(200).json({
    success: true,
    message: "Photographers fetched successfully",
    data: {
      photographers,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    },
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
